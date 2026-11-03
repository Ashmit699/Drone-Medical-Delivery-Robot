"""
MediDrop drone bridge: connects the app backend to the real drone.

    app backend (Node)  <--WebSocket JSON-->  this bridge  <--MAVLink (SiK radio)-->  CrossFlight FC

Status: SKELETON for the exhibition. Telemetry forwarding works; mission upload and the
drop sequence are marked TODO. Protocol: server/src/drone/README.md

Run:
    pip install pymavlink websockets
    python bridge.py --mavlink /dev/tty.usbserial-XXXX --baud 57600     # real SiK radio
    python bridge.py --mavlink udp:127.0.0.1:14550                       # ArduPilot SITL
Then in the app: Ops -> Fleet -> MDR-01 -> switch adapter to "bridge".
"""

import argparse
import asyncio
import json

import websockets
from pymavlink import mavutil

COPTER_MODES = {v: k for k, v in mavutil.mode_mapping_acm.items()}  # 3 -> 'AUTO', ...


class Bridge:
    def __init__(self, mavlink_url: str, baud: int):
        self.master = mavutil.mavlink_connection(mavlink_url, baud=baud)
        self.telemetry: dict = {"payload": {"gripper": "closed", "winch": "homed", "ropeM": 0, "loaded": False}}
        self.mission_id = None
        self.clients: set = set()

    # ---------- MAVLink -> telemetry ----------

    def read_mavlink(self):
        """Drain pending MAVLink messages into self.telemetry (non-blocking)."""
        while (msg := self.master.recv_match(blocking=False)) is not None:
            t = msg.get_type()
            if t == "HEARTBEAT" and msg.get_srcComponent() == 1:
                self.telemetry["armed"] = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
                self.telemetry["mode"] = COPTER_MODES.get(msg.custom_mode, str(msg.custom_mode))
            elif t == "GLOBAL_POSITION_INT":
                self.telemetry["position"] = {"lat": msg.lat / 1e7, "lon": msg.lon / 1e7}
                self.telemetry["altM"] = msg.relative_alt / 1000
                self.telemetry["headingDeg"] = msg.hdg / 100 if msg.hdg != 65535 else 0
            elif t == "VFR_HUD":
                self.telemetry["groundSpeedMs"] = msg.groundspeed
            elif t == "SYS_STATUS":
                self.telemetry["batteryV"] = msg.voltage_battery / 1000
                self.telemetry["batteryPct"] = max(msg.battery_remaining, 0)
            elif t == "GPS_RAW_INT":
                self.telemetry["gpsSats"] = msg.satellites_visible
            elif t == "MISSION_ITEM_REACHED":
                pass  # TODO: when the drop waypoint is reached -> emit phase 'approach' / 'aligning'
            elif t == "NAMED_VALUE_FLOAT":
                pass  # TODO: payload status from the Raspberry Pi / ESP32 (rope length, winch state)
        self.telemetry["missionId"] = self.mission_id

    # ---------- backend -> drone ----------

    async def start_mission(self, plan: dict):
        self.mission_id = plan["missionId"]
        # TODO (see docs/01 + docs/04):
        #  1. upload mission: TAKEOFF(cruiseAltM) -> WAYPOINT(target) -> (Pi takes over the drop)
        #  2. set mode GUIDED, arm, set mode AUTO
        #  3. emit phases as they happen: preflight, takeoff, cruise, approach, ...
        await self.emit_phase("preflight", "Mission received by drone bridge (upload not implemented yet)")

    async def command(self, cmd: dict):
        kind = cmd.get("type")
        if kind == "RTL":
            self.master.set_mode("RTL")
        elif kind == "PAUSE":
            self.master.set_mode("LOITER")
        elif kind == "RESUME":
            self.master.set_mode("AUTO")
        elif kind == "CLEARANCE":
            # TODO: forward to the Raspberry Pi mission agent (it starts the winch sequence)
            pass

    # ---------- WebSocket plumbing ----------

    async def emit_phase(self, phase: str, message: str):
        await self.broadcast({"type": "phase", "missionId": self.mission_id, "phase": phase, "message": message})

    async def broadcast(self, obj: dict):
        data = json.dumps(obj)
        for ws in list(self.clients):
            try:
                await ws.send(data)
            except websockets.ConnectionClosed:
                self.clients.discard(ws)

    async def handle_client(self, ws):
        self.clients.add(ws)
        try:
            async for raw in ws:
                msg = json.loads(raw)
                if msg["type"] == "start_mission":
                    await self.start_mission(msg["plan"])
                elif msg["type"] == "command":
                    await self.command(msg["command"])
        except Exception as err:  # keep the bridge alive, report to the app
            await ws.send(json.dumps({"type": "error", "message": str(err)}))
        finally:
            self.clients.discard(ws)

    async def telemetry_loop(self):
        while True:
            self.read_mavlink()
            await self.broadcast({"type": "telemetry", "telemetry": self.telemetry})
            await asyncio.sleep(0.25)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mavlink", default="udp:127.0.0.1:14550")
    ap.add_argument("--baud", type=int, default=57600)
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    bridge = Bridge(args.mavlink, args.baud)
    print(f"Waiting for heartbeat on {args.mavlink} ...")
    bridge.master.wait_heartbeat()
    print(f"Drone connected. WebSocket on ws://0.0.0.0:{args.port}")
    async with websockets.serve(bridge.handle_client, "0.0.0.0", args.port):
        await bridge.telemetry_loop()


if __name__ == "__main__":
    asyncio.run(main())
