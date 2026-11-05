"""
Pretend flight controller for testing drone-bridge WITHOUT a drone (testing plan, stage 2).

It answers MAVLink the way ArduCopter does for the messages the bridge uses: heartbeats, GPS,
mission upload, mode changes, arming, takeoff, MISSION_SET_CURRENT, DO_SET_SERVO. Then it
walks through the uploaded mission 10x faster than real time. It is NOT a flight simulator and
does not prove how real ArduPilot behaves (that is stage 3, ArduPilot SITL).

    terminal 1:  .venv/bin/python mock_fc.py
    terminal 2:  .venv/bin/python bridge.py --mavlink udpin:127.0.0.1:14560
    terminal 3:  npm run dev   (repo root), then Ops -> Fleet -> MDR-01 -> "Radio bridge"
"""
import math, sys, time
from pymavlink import mavutil

mav = mavutil.mavlink
SPEED = 10  # time multiplier
m = mavutil.mavlink_connection(sys.argv[1] if len(sys.argv) > 1 else "udpout:127.0.0.1:14560", source_system=1, source_component=1)
HOME = (28.645189, 77.381497)
st = dict(armed=False, mode=0, lat=HOME[0], lon=HOME[1], alt=0.0, seq=0, items=[], expect=0, count=0, hold_until=None, servo={})
log = lambda *a: print("[mock]", *a, flush=True)

def ack(cmd, res=mav.MAV_RESULT_ACCEPTED): m.mav.command_ack_send(cmd, res)

def move_to(lat, lon, alt, dt, v=12):
    d = math.hypot((lat - st["lat"]) * 110540, (lon - st["lon"]) * 111320 * math.cos(math.radians(lat)))
    step = v * dt * SPEED
    if d <= step: st["lat"], st["lon"] = lat, lon
    else: st["lat"] += (lat - st["lat"]) * step / d; st["lon"] += (lon - st["lon"]) * step / d
    st["alt"] += max(-2 * dt * SPEED, min(2.5 * dt * SPEED, alt - st["alt"]))
    return d <= step and abs(alt - st["alt"]) < 0.3

def step_mission(dt):
    if st["mode"] == 6 or st.get("mission_rtl"):  # RTL (mode switch or the mission's RTL item, which stays AUTO)
        if move_to(*HOME, max(st["alt"], 15) if math.hypot(st["lat"] - HOME[0], st["lon"] - HOME[1]) > 1e-5 else 0, dt) or (st["alt"] < 0.2 and st["lat"] == HOME[0]):
            if st["alt"] < 0.2 and st["armed"]:
                st["armed"] = False; st["mission_rtl"] = False; log("landed + disarmed")
        return
    if st["mode"] == 4 and st["armed"]:  # GUIDED takeoff
        st["alt"] = min(st["alt"] + 2.5 * dt * SPEED, st.get("takeoff", 0)); return
    if st["mode"] != 3 or not st["items"] or not st["armed"]: return
    if st["seq"] == 0: st["seq"] = 1
    it = st["items"][st["seq"]]; c = it.command
    lat, lon = it.x / 1e7, it.y / 1e7
    done = False
    if c == 22: done = abs(st["alt"] - it.z) < 0.5 or bool(move_to(st["lat"], st["lon"], it.z, dt))
    elif c == 16: done = move_to(lat, lon, it.z, dt)
    elif c == 17: move_to(lat, lon, it.z, dt)  # loiter forever
    elif c == 19:
        if move_to(lat, lon, it.z, dt):
            st["hold_until"] = st["hold_until"] or time.time() + it.param1 / SPEED
            done = time.time() >= st["hold_until"]
    elif c == 20: st["mission_rtl"] = True; log("mission RTL item (mode stays AUTO)"); return
    else: done = True  # DO_* commands
    if c == 183: st["servo"][int(it.param1)] = int(it.param2); log(f"SERVO{int(it.param1)} = {int(it.param2)}")
    if done:
        st["hold_until"] = None
        st["seq"] = min(st["seq"] + 1, len(st["items"]) - 1)

last = time.time(); tele = 0
while True:
    now = time.time(); dt = now - last; last = now
    step_mission(dt)
    if now - tele > 0.25:
        tele = now
        base = mav.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED | (mav.MAV_MODE_FLAG_SAFETY_ARMED if st["armed"] else 0)
        m.mav.heartbeat_send(mav.MAV_TYPE_QUADROTOR, mav.MAV_AUTOPILOT_ARDUPILOTMEGA, base, st["mode"], mav.MAV_STATE_ACTIVE)
        m.mav.global_position_int_send(0, int(st["lat"] * 1e7), int(st["lon"] * 1e7), int((214 + st["alt"]) * 1000), int(st["alt"] * 1000), 0, 0, 0, 9000)
        m.mav.vfr_hud_send(0, 12.0 if st["armed"] else 0, 90, 50, 0, 0)
        m.mav.sys_status_send(0, 0, 0, 500, 15800, 0, 82, 0, 0, 0, 0, 0, 0)
        m.mav.gps_raw_int_send(0, 3, int(st["lat"] * 1e7), int(st["lon"] * 1e7), 0, 100, 100, 0, 0, 14)
        m.mav.mission_current_send(st["seq"])
        m.mav.servo_output_raw_send(int(now * 1e6) & 0xFFFFFFFF, 0, *[st["servo"].get(n, 0) for n in range(1, 9)])
    msg = m.recv_match(blocking=True, timeout=0.05)
    if not msg: continue
    t = msg.get_type()
    if t == "MISSION_CLEAR_ALL": st["items"] = []; m.mav.mission_ack_send(255, 190, 0)
    elif t == "MISSION_COUNT":
        st["count"], st["items"], st["seq"] = msg.count, [], 0; m.mav.mission_request_int_send(255, 190, 0); log("upload", msg.count, "items")
    elif t == "MISSION_ITEM_INT":
        st["items"].append(msg)
        if len(st["items"]) < st["count"]: m.mav.mission_request_int_send(255, 190, len(st["items"]))
        else: m.mav.mission_ack_send(255, 190, 0); log("mission accepted:", [i.command for i in st["items"]])
    elif t == "SET_MODE": st["mode"] = msg.custom_mode; log("mode ->", mavutil.mode_mapping_acm.get(msg.custom_mode))
    elif t == "MISSION_SET_CURRENT": st["seq"] = msg.seq; st["hold_until"] = None; log("set current ->", msg.seq)
    elif t == "COMMAND_LONG":
        if msg.command == mav.MAV_CMD_COMPONENT_ARM_DISARM: st["armed"] = msg.param1 == 1; log("armed", st["armed"])
        elif msg.command == mav.MAV_CMD_DO_SET_MODE: st["mode"] = int(msg.param2); log("mode ->", mavutil.mode_mapping_acm.get(int(msg.param2)))
        elif msg.command == mav.MAV_CMD_NAV_TAKEOFF: st["takeoff"] = msg.param7; log("takeoff to", msg.param7)
        elif msg.command == mav.MAV_CMD_DO_SET_SERVO: st["servo"][int(msg.param1)] = int(msg.param2); log(f"SERVO{int(msg.param1)} = {int(msg.param2)} (direct)")
        elif msg.command == mav.MAV_CMD_REQUEST_AUTOPILOT_CAPABILITIES:
            m.mav.autopilot_version_send(0, (4 << 24) | (5 << 16) | (7 << 8), 0, 0, 0, b"\0" * 8, b"\0" * 8, b"\0" * 8, 0, 0, 0)
        ack(msg.command)
