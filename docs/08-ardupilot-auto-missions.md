# 8. App orders → ArduPilot auto-missions

**Goal:** when someone orders from the app, the drone plans its own route and flies the whole
delivery automatically: take off, fly, hover, winch the package down, return, land. A human
stays in the loop only for "area clear" and as the RC safety pilot.

## 8.1 The short answer: Mission Planner is not the API, MAVLink is

**Mission Planner** is a Windows desktop ground-control program. It has no API that our server can call:

- Its scripting runs **inside** the Mission Planner window (IronPython; `Script.ChangeMode`,
  `MAV.doARM`, `MAV.getWPCount`, …) and is meant for a person sitting at that PC
  ([docs](https://ardupilot.org/planner/docs/using-python-scripts-in-mission-planner.html)).
  Teams who automate with it end up passing files around
  ([example](https://uwarg-docs.atlassian.net/wiki/spaces/CV/pages/2261319712/Mission+Planner+Automated+Missions)).
- What Mission Planner itself does is speak **MAVLink** to the flight controller. Our bridge
  does exactly the same thing in Python (`pymavlink`), so the app talks to ArduPilot directly.

Mission Planner still has a job: it's the **operator's monitoring and safety screen**, and the
tool for calibration/parameters. Our bridge can mirror all MAVLink traffic to it, and every order's
plan can be downloaded as a Mission Planner `.waypoints` file.

## 8.2 How an order becomes a flight

```
Customer app ── order ──► Backend ── approve + dispatch ──► buildMission()  (server/src/drone/mission.ts)
                                                                │ same items
                       ┌────────────────────────────────────────┼──────────────────────────┐
                       ▼                                        ▼                          ▼
           Ops UI: flight-plan preview          drone-bridge/bridge.py              Download .waypoints
                                                  │ MAVLink over SiK radio           → Mission Planner
                                                  ▼                                     "Load WP File"
                                         CrossFlight (ArduCopter)
                                                  │ --forward udp:<laptop>:14550
                                                  └──────────────► Mission Planner / QGC (live monitor)
```

### The generated mission (ESP32 payload mode, our planned hardware)

| # | MAVLink command | What it does | App phase |
|---|-----------------|--------------|-----------|
| 0 | `NAV_WAYPOINT` (16) | Home placeholder (ArduPilot replaces it on arming) | |
| 1 | `NAV_TAKEOFF` (22) | Climb to 60 m (cruise height; clears 40–60 m towers) | takeoff |
| 2 | `DO_CHANGE_SPEED` (178) | 15 m/s ground speed | |
| 3 | `NAV_WAYPOINT` (16) | Fly to the drop point at 60 m | cruise |
| 4 | `NAV_WAYPOINT` (16) | Descend to the 4 m hover, hold 2 s | approach |
| 5 | `NAV_LOITER_UNLIM` (17) | **Hover until "area clear"** | awaiting_clearance |
| 6 | `DO_SET_SERVO` (183) | **SERVO8 = OPEN → storage box opens** ([doc 11](11-storage-box-servo.md)) | |
| 7 | `NAV_LOITER_TIME` (19) | Hold 2 s while the box opens | lowering |
| 8 | `DO_SET_SERVO` (183) | SERVO9 = 1900 µs → ESP32 runs lower → release → reel in | |
| 9 | `NAV_LOITER_TIME` (19) | Hold ~36 s while the ESP32 works | lowering |
| 10 | `DO_SET_SERVO` (183) | SERVO9 = 1500 µs → ESP32 idle | |
| 11 | `DO_SET_SERVO` (183) | **SERVO8 = CLOSED → storage box closes** | |
| 12 | `NAV_LOITER_TIME` (19) | Hold 2 s while the box closes | retracting |
| 13 | `NAV_WAYPOINT` (16) | Climb back to cruise height above the drop zone | returning |
| 14 | `NAV_RETURN_TO_LAUNCH` (20) | Fly home at cruise height and land (the bridge sets `RTL_ALT` = cruise height before take-off) | returning |

With `PAYLOAD_MODE=ardupilot-winch` the drop instead uses ArduPilot's own winch and gripper:
`DO_WINCH` (42600, action 1 = length, positive = pay out) and `DO_GRIPPER` (211, 0 = release),
each followed by a `NAV_LOITER_TIME` hold ([mission command reference](https://ardupilot.org/copter/docs/common-mavlink-mission-command-messages-mav_cmd.html),
[winch over MAVLink](https://ardupilot.org/dev/docs/mavlink-winch.html)).

> **Alternative without a winch:** `NAV_PAYLOAD_PLACE` makes the copter descend until the payload
> touches the ground, release the gripper and climb back. It's simpler, but the drone comes much
> closer to people and objects than our rope drop.

### What the bridge does, step by step

1. **Pre-flight:** recent heartbeat, not already armed, 3D GPS fix. Otherwise it refuses and the app shows why.
2. **Upload** with the MAVLink mission protocol: `MISSION_CLEAR_ALL` → `MISSION_COUNT` → answer
   each `MISSION_REQUEST_INT` with a `MISSION_ITEM_INT` → wait for `MISSION_ACK`. Then set the current item to 1.
3. **Launch:** `DO_SET_MODE` GUIDED → arm → `NAV_TAKEOFF` → at 2 m switch to **AUTO**. This works
   on older ArduCopter builds and doesn't depend on `AUTO_OPTIONS`. Newer firmware can instead arm and
   take off directly in AUTO with `AUTO_OPTIONS = 3`
   ([forum](https://discuss.ardupilot.org/t/auto-mode-auto-take-off/90538),
   [arming docs](https://ardupilot.org/copter/docs/arming_the_motors.html)).
4. **Track:** `MISSION_CURRENT` → app phase. Only NAV items appear there (DO items run instantly
   between them), so phases are attached to NAV items. Phases only ever move forward.
5. **"Area clear"** from the customer/operator → `MISSION_SET_CURRENT` jumps past the hover item.
   No confirmation within 180 s → the drone goes home.
6. **Pause / resume** → LOITER / AUTO (ArduCopter resumes the mission where it left off).
7. **Abort (RTL):** if the package is on the rope, it first sends SERVO9 = 1100 µs (ESP32: reel in now),
   holds in LOITER, and only then switches to RTL. The order is marked *failed: package back at base*.
8. **GCS heartbeat** every second, so ArduPilot's GCS failsafe notices if the bridge or radio dies.

## 8.3 ⚠️ CrossFlight caveat: verify your firmware first

ArduPilot's docs list the **Radiolink CrossFlight as not officially supported**. It ships a
RadioLink-branded ArduCopter build, and firmware can only be updated with **RadioLink's own Mission
Planner** ([ArduPilot on RadioLink boards](https://ardupilot.org/copter/docs/common-radiolink-minipix.html),
[RadioLink manual](https://www.manualslib.com/manual/3778760/Radiolink-Rlka001028.html)).
It still speaks MAVLink, so this design works, but check what your build supports:

```bash
cd drone-bridge && uv venv -p 3.12 && uv pip install -r requirements.txt
.venv/bin/python bridge.py --check --mavlink /dev/tty.usbserial-XXXX --baud 57600
```

It prints the ArduCopter version, mode, GPS fix and battery. Then confirm on the bench (props off):
- Mission Planner → Plan → **Load WP File** with a downloaded order → **Write WPs**. Check it's accepted, then **Read WPs** and check it matches.
- `DO_SET_SERVO` on SERVO9 actually changes the output (use the ESP32 or a servo tester).
- If you want `ardupilot-winch` mode: the `WINCH_*` and `GRIP_*` parameters exist on your build.

## 8.4 Flight controller parameters (set once in Mission Planner)

| Parameter | Value | Why |
|-----------|-------|-----|
| `SERIALx_PROTOCOL` / `SERIALx_BAUD` | 2 / 57 | MAVLink2 on the SiK telemetry port |
| `SERVO9_FUNCTION` | 0 (or 1) | Lets `DO_SET_SERVO` drive the ESP32 trigger output |
| `RTL_ALT` | 2500 (cm) | Return above trees/buildings in the demo zone |
| `RTL_ALT_FINAL` | 0 | Land at home after RTL (the bridge waits for disarm) |
| `WPNAV_SPEED` | 1200 (cm/s) | Matches the 12 m/s cruise in the plan |
| `MIS_RESTART` | 0 | Resuming after Pause continues where it left off |
| `FENCE_ENABLE`, `FENCE_RADIUS`, `FENCE_ALT_MAX`, `FENCE_ACTION` | 1, 1500, 40, RTL | Hard limit around the 1.3 km demo zone |
| `FS_GCS_ENABLE` | 1 (RTL) | Bridge/radio lost → come home |
| `FS_THR_ENABLE` | 1 (RTL) | RC lost → come home |
| `BATT_FS_LOW_ACT` / `BATT_FS_CRT_ACT` | RTL / Land | Battery failsafes |
| *(ardupilot-winch mode)* `WINCH_TYPE`, `SERVOn_FUNCTION`=88, `GRIP_ENABLE`, `GRIP_TYPE`, `SERVOm_FUNCTION`=28 | per your winch | ArduPilot-driven winch + gripper ([Daiwa example](https://ardupilot.org/copter/docs/common-daiwa-winch.html)) |

`x`, `n`, `m` depend on how the CrossFlight's ports are wired. Read them in Mission Planner first.

## 8.5 Mission Planner workflows

1. **Watch a flight live while the app flies it:** run the bridge with
   `--forward udp:<mission-planner-laptop-ip>:14550`, then in Mission Planner choose **UDP**, port 14550, **Connect**.
   Mission Planner is Windows-only. On a Mac use **QGroundControl** (same UDP port) or a Windows laptop.
2. **Review a plan before launch:** Ops → Orders → open an approved order → *ArduPilot flight plan* →
   **.waypoints**. In Mission Planner: Flight Plan → **Load WP File**.
3. **Fly a plan by hand** (testing without the app): load the file → **Write WPs** → arm → AUTO from your RC transmitter.

## 8.6 How to run it with the app

```bash
# 1. Bridge, next to the SiK radio
cd drone-bridge && .venv/bin/python bridge.py --mavlink /dev/tty.usbserial-XXXX --baud 57600 --forward udp:192.168.1.20:14550
# 2. Backend pointing at the bridge (default ws://127.0.0.1:8765)
npm run dev
# 3. App: Ops → Fleet → MDR-01 → "Radio bridge". Dispatch an order to MDR-01.
```

## 8.7 Testing ladder: never skip a rung

| Step | Status | What it proves |
|------|--------|----------------|
| Mock flight controller (MAVLink responder) | ✅ done | App → backend → bridge → MAVLink upload/arm/mode/clearance/abort wiring; 3 back-to-back flights including an abort while lowering |
| **ArduPilot SITL** (the real ArduCopter code, simulated) | ⏳ next | ArduCopter's real behaviour for this exact mission. Needs ArduPilot built locally (`./waf configure --board sitl && ./waf copter`), then `bridge.py --mavlink tcp:127.0.0.1:5760` |
| Bench, props **off** | ⏳ | CrossFlight accepts the mission, mode changes and arming; SERVO9 trigger reaches the ESP32 |
| Tethered / low hover with safety pilot | ⏳ | Takeoff → hover → drop with the RC pilot ready to switch to LOITER |
| Short field route (50–100 m), then the demo zone | ⏳ | The full delivery |

**Safety rule:** the RC safety pilot can always take over by flipping the mode switch to LOITER or
STABILIZE. ArduPilot gives the RC transmitter priority over the bridge.
