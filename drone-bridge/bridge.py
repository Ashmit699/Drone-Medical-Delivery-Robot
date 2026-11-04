"""
MediDrop drone bridge: turns app orders into ArduCopter AUTO missions and flies them.

    app backend (Node)  <--WebSocket JSON-->  this bridge  <--MAVLink (SiK radio)-->  CrossFlight FC
                                                   \\--UDP--> Mission Planner / QGC (optional, monitoring)

On "start_mission" the backend sends the full mission (built by server/src/drone/mission.ts).
This bridge uploads it with the MAVLink mission protocol, arms, takes off in GUIDED, switches to
AUTO and reports progress back as app phases. "Area clear" skips the hover item; Pause/RTL are
mode changes. Protocol with the backend: server/src/drone/README.md. Setup: docs/08-ardupilot-auto-missions.md

Run:
    uv venv -p 3.12 && uv pip install -r requirements.txt
    python bridge.py --check --mavlink /dev/tty.usbserial-XXXX           # print firmware/GPS, then exit
    python bridge.py --mavlink /dev/tty.usbserial-XXXX --baud 57600       # real SiK radio
    python bridge.py --mavlink udp:127.0.0.1:14550                        # ArduPilot SITL
    python bridge.py ... --forward udp:192.168.1.20:14550                 # also feed Mission Planner
Then in the app: Ops -> Fleet -> MDR-01 -> adapter "Radio bridge".
"""

import argparse
import asyncio
import json
import math
import queue
import threading
import time

import websockets
from pymavlink import mavutil

mav = mavutil.mavlink
MODE_NAMES = mavutil.mode_mapping_acm  # 3 -> 'AUTO', 4 -> 'GUIDED', ...
COPTER_MODES = {v: k for k, v in MODE_NAMES.items()}  # 'AUTO' -> 3
# Our mission files use the float frames; MISSION_ITEM_INT needs the *_INT variants.
INT_FRAME = {mav.MAV_FRAME_GLOBAL: mav.MAV_FRAME_GLOBAL_INT, mav.MAV_FRAME_GLOBAL_RELATIVE_ALT: mav.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT}
# App phases in flight order; a flight only ever moves forward through them.
PHASE_ORDER = ["preflight", "takeoff", "cruise", "approach", "aligning", "awaiting_clearance", "lowering",
               "releasing", "retracting", "returning", "landing", "completed", "aborted"]
INBOX_MSGS = {"MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK", "COMMAND_ACK", "AUTOPILOT_VERSION"}


def distance_m(lat1, lon1, lat2, lon2):
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


class Vehicle:
    """Owns the MAVLink link. One reader thread; blocking helpers are called via asyncio.to_thread."""

    def __init__(self, url, baud, forward=None):
        self.m = mavutil.mavlink_connection(url, baud=baud, source_system=255, source_component=mav.MAV_COMP_ID_MISSIONPLANNER)
        self.fwd = mavutil.mavlink_connection(forward, input=False) if forward else None
        self.inbox = queue.Queue()
        self.on_message = lambda msg: None
        self.state = {"armed": False, "mode": "UNKNOWN", "lat": 0.0, "lon": 0.0, "alt": 0.0, "speed": 0.0, "heading": 0.0,
                      "batteryV": 0.0, "batteryPct": 0, "sats": 0, "fix": 0, "seq": -1, "last_hb": 0.0}

    def connect(self, timeout=30):
        hb = self.m.wait_heartbeat(timeout=timeout)
        if hb is None:
            raise TimeoutError("No heartbeat from the flight controller")
        # Ask for telemetry at 4 Hz (SiK at 57600 baud handles this comfortably).
        self.m.mav.request_data_stream_send(self.m.target_system, self.m.target_component, mav.MAV_DATA_STREAM_ALL, 4, 1)
        threading.Thread(target=self._reader, daemon=True).start()

    # ---------- reader thread ----------

    def _reader(self):
        s = self.state
        while True:
            msg = self.m.recv_match(blocking=True, timeout=1)
            if msg is None:
                continue
            if self.fwd:
                self.fwd.write(msg.get_msgbuf())
            t = msg.get_type()
            if t == "HEARTBEAT" and msg.get_srcComponent() == mav.MAV_COMP_ID_AUTOPILOT1:
                s["armed"] = bool(msg.base_mode & mav.MAV_MODE_FLAG_SAFETY_ARMED)
                s["mode"] = MODE_NAMES.get(msg.custom_mode, str(msg.custom_mode))
                s["last_hb"] = time.time()
            elif t == "GLOBAL_POSITION_INT":
                s["lat"], s["lon"], s["alt"] = msg.lat / 1e7, msg.lon / 1e7, msg.relative_alt / 1000
                s["heading"] = msg.hdg / 100 if msg.hdg != 65535 else s["heading"]
            elif t == "VFR_HUD":
                s["speed"] = msg.groundspeed
            elif t == "SYS_STATUS":
                s["batteryV"] = msg.voltage_battery / 1000
                s["batteryPct"] = max(msg.battery_remaining, 0)
            elif t == "GPS_RAW_INT":
                s["sats"], s["fix"] = msg.satellites_visible, msg.fix_type
            elif t == "MISSION_CURRENT":
                s["seq"] = msg.seq
            elif t == "STATUSTEXT":
                print("[FC]", msg.text)
            if t in INBOX_MSGS:
                self.inbox.put(msg)
            self.on_message(msg)

    def _wait(self, types, timeout, pred=lambda m: True):
        end = time.time() + timeout
        while time.time() < end:
            try:
                msg = self.inbox.get(timeout=max(0.05, end - time.time()))
            except queue.Empty:
                break
            if msg.get_type() in types and pred(msg):
                return msg
        return None

    def _drain(self):
        while not self.inbox.empty():
            self.inbox.get_nowait()

    # ---------- blocking actions ----------

    def command(self, cmd, *params, timeout=5):
        p = list(params) + [0] * (7 - len(params))
        self._drain()
        self.m.mav.command_long_send(self.m.target_system, self.m.target_component, cmd, 0, *p)
        ack = self._wait({"COMMAND_ACK"}, timeout, lambda a: a.command == cmd)
        if ack is None or ack.result != mav.MAV_RESULT_ACCEPTED:
            res = "timeout" if ack is None else mav.enums["MAV_RESULT"][ack.result].name
            raise RuntimeError(f"Command {cmd} failed: {res}")

    def set_mode(self, name, timeout=5):
        # DO_SET_MODE with the ArduCopter custom mode number; ACKed, then confirmed by heartbeat.
        self.command(mav.MAV_CMD_DO_SET_MODE, mav.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, COPTER_MODES[name])
        end = time.time() + timeout
        while time.time() < end:
            if self.state["mode"] == name:
                return
            time.sleep(0.1)
        raise RuntimeError(f"Flight controller did not switch to {name}")

    def upload(self, items):
        """MAVLink mission protocol: CLEAR_ALL, COUNT, answer each REQUEST, wait for ACK."""
        ts, tc = self.m.target_system, self.m.target_component
        self._drain()
        self.state["seq"] = -1  # forget the previous mission's progress
        self.m.mav.mission_clear_all_send(ts, tc)
        self._wait({"MISSION_ACK"}, 3)
        self.m.mav.mission_count_send(ts, tc, len(items))
        while True:
            msg = self._wait({"MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK"}, 5)
            if msg is None:
                raise TimeoutError("Mission upload timed out (radio link?)")
            if msg.get_type() == "MISSION_ACK":
                if msg.type == mav.MAV_MISSION_ACCEPTED:
                    return
                raise RuntimeError(f"Mission rejected: {mav.enums['MAV_MISSION_RESULT'][msg.type].name}")
            it = items[msg.seq]
            p1, p2, p3, p4 = it["params"]
            self.m.mav.mission_item_int_send(
                ts, tc, msg.seq, INT_FRAME.get(it["frame"], it["frame"]), it["command"], 0, 1,
                p1, p2, p3, p4, int(it["lat"] * 1e7), int(it["lon"] * 1e7), it["alt"],
            )

    def set_current(self, seq):
        self.m.mav.mission_set_current_send(self.m.target_system, self.m.target_component, seq)

    def set_servo(self, servo, pwm):
        self.command(mav.MAV_CMD_DO_SET_SERVO, servo, pwm)

    def firmware(self):
        self.m.mav.command_long_send(self.m.target_system, self.m.target_component,
                                     mav.MAV_CMD_REQUEST_AUTOPILOT_CAPABILITIES, 0, 1, 0, 0, 0, 0, 0, 0)
        v = self._wait({"AUTOPILOT_VERSION"}, 5)
        if v is None:
            return "unknown"
        sw = v.flight_sw_version
        return f"{(sw >> 24) & 0xFF}.{(sw >> 16) & 0xFF}.{(sw >> 8) & 0xFF}"


class Flight:
    """One delivery: drives the vehicle through the mission and reports app phases."""

    def __init__(self, vehicle, plan, emit):
        self.v, self.plan, self.emit = vehicle, plan, emit
        self.mission = plan["mission"]
        self.items = self.mission["items"]
        self.target = plan["target"]
        self.phase = None
        self.aborted = False
        self.delivered = False
        self.drop_started = None
        self.clearance_at = None
        self.started = False  # True once we have handed over to AUTO; until then ignore mission progress

    def set_phase(self, phase, message):
        if self.phase and PHASE_ORDER.index(phase) <= PHASE_ORDER.index(self.phase) and phase != "aborted":
            return
        self.phase = phase
        if phase in ("releasing", "retracting", "returning", "landing", "completed"):
            self.delivered = self.delivered or phase == "releasing"
        self.emit({"type": "phase", "missionId": self.plan["missionId"], "phase": phase, "message": message})

    def run(self):
        """Blocking: preflight checks, upload, arm, take off, hand over to AUTO."""
        s = self.v.state
        self.set_phase("preflight", "Drone bridge: pre-flight checks")
        if time.time() - s["last_hb"] > 3:
            raise RuntimeError("No recent heartbeat from the drone")
        if s["armed"]:
            raise RuntimeError("Drone is already armed")
        if s["fix"] < 3:
            raise RuntimeError(f"No 3D GPS fix (fix type {s['fix']}, {s['sats']} satellites)")
        self.v.upload(self.items)
        self.v.set_current(1)  # start at the takeoff item, whatever the previous mission left behind
        self.v.set_mode("GUIDED")
        self.v.command(mav.MAV_CMD_COMPONENT_ARM_DISARM, 1)  # pre-arm failures come back as an error
        self.set_phase("takeoff", f"Taking off to {self.plan['cruiseAltM']} m")
        self.v.command(mav.MAV_CMD_NAV_TAKEOFF, 0, 0, 0, 0, 0, 0, self.plan["cruiseAltM"])
        end = time.time() + 20
        while s["alt"] < 2 and time.time() < end:
            time.sleep(0.2)
        # Mission item 1 (NAV_TAKEOFF) completes as soon as we reach cruise altitude in AUTO.
        self.v.set_mode("AUTO")
        self.started = True

    def tick(self):
        """Called a few times per second: map mission progress + mode to app phases."""
        s, m = self.v.state, self.mission
        if not self.started:
            return False
        seq = s["seq"]
        # A mission's own RTL item keeps the mode AUTO; a failsafe/operator RTL switches mode.
        if 0 <= seq < len(self.items) and s["mode"] == "AUTO":
            if seq == m["clearanceSeq"] and self.clearance_at is None:
                self.clearance_at = time.time()
            if seq >= m["afterClearanceSeq"] and self.drop_started is None:
                self.drop_started = time.time()
            # The drop hold finished (mission moved on) without an abort: the package is down.
            # Checked before the current item's phase, because phases only move forward.
            last_drop_seq = max(i["seq"] for i in self.items if i.get("phase") in ("lowering", "releasing", "retracting"))
            if seq > last_drop_seq and self.drop_started and not self.aborted and not self.delivered:
                self.set_phase("releasing", "Package on the ground: hooks open")
                self.set_phase("retracting", "Rope reeled in")
            ph = self.items[seq].get("phase")
            if ph and not (self.aborted and ph != "returning"):
                self.set_phase(ph, self.items[seq]["label"])
        # Clearance timeout: nobody confirmed the area is clear.
        if self.phase == "awaiting_clearance" and self.clearance_at and time.time() - self.clearance_at > m["clearanceTimeoutS"]:
            self.abort("No 'area clear' confirmation: returning to base")
        # ESP32 mode has no separate release items, so estimate them from the drop timer.
        if m["payloadMode"] == "esp32" and self.drop_started and not self.aborted:
            dt = time.time() - self.drop_started
            if dt > m["lowerS"] and self.phase == "lowering":
                self.set_phase("releasing", "Package on the ground: hooks open")
            if dt > m["lowerS"] + 3 and self.phase == "releasing":
                self.set_phase("retracting", "Reeling the rope in")
        rtl_item = s["mode"] == "AUTO" and 0 <= seq < len(self.items) and self.items[seq]["command"] == 20
        if (s["mode"] in ("RTL", "LAND") or rtl_item) and s["armed"]:
            self.set_phase("returning" if s["alt"] > 3 else "landing", "Returning to base" if s["alt"] > 3 else "Landing")
        if self.phase in ("returning", "landing") and not s["armed"]:
            done = self.delivered and not self.aborted
            self.set_phase("completed" if done else "aborted", "Landed at base" + ("" if done else ": mission aborted"))
            return True
        return False

    def clearance(self):
        if self.v.state["seq"] != self.mission["clearanceSeq"]:
            raise RuntimeError("Drone is not waiting for clearance")
        self.v.set_current(self.mission["afterClearanceSeq"])

    def pause(self):
        self.v.set_mode("LOITER")

    def resume(self):
        self.v.set_mode("AUTO")  # ArduCopter resumes the mission at the current item

    def abort(self, reason="Operator ordered return to base"):
        if self.aborted:
            return
        self.aborted = not self.delivered
        trig = self.mission.get("trigger")
        if trig and self.drop_started and not self.delivered:
            # Package may be on the rope: tell the ESP32 to reel in, hold, then go home.
            self.v.set_servo(trig["servo"], trig["pwmAbort"])
            self.v.set_mode("LOITER")
            self.set_phase("retracting", "Abort: reeling the package back up")
            time.sleep(self.mission["retractS"])
            self.v.set_servo(trig["servo"], trig["pwmIdle"])
        self.v.set_mode("RTL")
        self.set_phase("returning", reason)


class Bridge:
    def __init__(self, vehicle, drone_id):
        self.v, self.drone_id = vehicle, drone_id
        self.clients = set()
        self.flight = None
        self.loop = None

    def emit(self, obj):
        """Thread-safe: queue a message for every connected backend."""
        data = json.dumps(obj)
        for ws in list(self.clients):
            asyncio.run_coroutine_threadsafe(self._send(ws, data), self.loop)

    async def _send(self, ws, data):
        try:
            await ws.send(data)
        except websockets.ConnectionClosed:
            self.clients.discard(ws)

    def telemetry(self):
        s, f = self.v.state, self.flight
        dist = distance_m(s["lat"], s["lon"], f.target["lat"], f.target["lon"]) if f else None
        eta = dist / s["speed"] + 20 if f and dist and s["speed"] > 1 and f.phase in ("takeoff", "cruise", "approach") else None
        dropping = f and f.phase in ("lowering", "releasing", "retracting")
        return {
            "connected": time.time() - s["last_hb"] < 3,
            "armed": s["armed"],
            "mode": s["mode"],
            "phase": f.phase if f else "idle",
            "missionId": f.plan["missionId"] if f else None,
            "position": {"lat": s["lat"], "lon": s["lon"]},
            "altM": s["alt"],
            "groundSpeedMs": s["speed"],
            "headingDeg": s["heading"],
            "batteryPct": s["batteryPct"],
            "batteryV": s["batteryV"],
            "gpsSats": s["sats"],
            "distanceToTargetM": round(dist) if dist is not None else None,
            "etaToDropS": round(eta) if eta else None,
            "paused": bool(f) and s["mode"] in ("LOITER", "BRAKE") and f.phase in ("cruise", "approach", "returning"),
            # Without ESP32 telemetry yet, payload state is inferred from the phase.
            "payload": {
                "gripper": "open" if f and f.phase in ("releasing",) else "closed",
                "winch": {"lowering": "lowering", "releasing": "holding", "retracting": "retracting"}.get(f.phase, "homed") if f else "homed",
                "ropeM": 0,
                "loaded": bool(f) and not f.delivered,
            },
            "markerErrorCm": None,
        }

    async def handle(self, ws):
        self.clients.add(ws)
        try:
            async for raw in ws:
                msg = json.loads(raw)
                try:
                    if msg["type"] == "start_mission":
                        await self.start(msg["plan"])
                    elif msg["type"] == "command":
                        await self.command(msg["command"]["type"])
                except Exception as err:  # report to the app, keep the bridge alive
                    await ws.send(json.dumps({"type": "error", "message": str(err)}))
        finally:
            self.clients.discard(ws)

    async def start(self, plan):
        if self.flight and self.flight.phase not in ("completed", "aborted"):
            raise RuntimeError("A mission is already in progress")
        if not plan.get("mission"):
            raise RuntimeError("Plan has no mission items (update the backend)")
        self.flight = Flight(self.v, plan, self.emit)
        try:
            await asyncio.to_thread(self.flight.run)
        except Exception as err:
            self.flight.set_phase("aborted", f"Launch failed: {err}")
            raise

    async def command(self, kind):
        f = self.flight
        if not f or f.phase in ("completed", "aborted"):
            raise RuntimeError("No active mission")
        action = {"CLEARANCE": f.clearance, "PAUSE": f.pause, "RESUME": f.resume, "RTL": f.abort}[kind]
        await asyncio.to_thread(action)

    async def loop_forever(self):
        last_hb = 0
        while True:
            # Ground-station heartbeat: lets ArduPilot's GCS failsafe (FS_GCS_ENABLE) notice if
            # this bridge or the radio link dies mid-flight.
            if time.time() - last_hb >= 1:
                self.v.m.mav.heartbeat_send(mav.MAV_TYPE_GCS, mav.MAV_AUTOPILOT_INVALID, 0, 0, 0)
                last_hb = time.time()
            if self.flight and self.flight.phase not in (None, "completed", "aborted"):
                await asyncio.to_thread(self.flight.tick)
            if self.clients:
                self.emit({"type": "telemetry", "telemetry": self.telemetry()})
            await asyncio.sleep(0.25)


async def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mavlink", default="udp:127.0.0.1:14550", help="serial port or udp:host:port")
    ap.add_argument("--baud", type=int, default=57600)
    ap.add_argument("--port", type=int, default=8765, help="WebSocket port for the app backend")
    ap.add_argument("--drone", default="MDR-01")
    ap.add_argument("--forward", help="also send all MAVLink to this address, e.g. udp:192.168.1.20:14550 for Mission Planner")
    ap.add_argument("--check", action="store_true", help="connect, print firmware/GPS/battery, and exit")
    args = ap.parse_args()

    v = Vehicle(args.mavlink, args.baud, args.forward)
    print(f"Waiting for heartbeat on {args.mavlink} ...")
    v.connect()
    if args.check:
        print("ArduCopter firmware:", v.firmware())
        time.sleep(2)
        s = v.state
        print(f"Mode {s['mode']} | armed {s['armed']} | GPS fix {s['fix']} with {s['sats']} sats | battery {s['batteryV']:.2f} V")
        print(f"Position {s['lat']:.6f}, {s['lon']:.6f}  (use as HUB_LAT / HUB_LON for the app when testing with SITL)")
        return

    bridge = Bridge(v, args.drone)
    bridge.loop = asyncio.get_running_loop()
    print(f"Drone connected. Backend WebSocket on ws://0.0.0.0:{args.port}")
    async with websockets.serve(bridge.handle, "0.0.0.0", args.port):
        await bridge.loop_forever()


if __name__ == "__main__":
    asyncio.run(main())
