# 5. Build Roadmap

## 5.1 The strategy in three sentences

1. **Four parallel tracks** (flight, payload, onboard/vision, app/backend) that only meet at
   planned integration points, so nobody waits on anybody.
2. **Simulate first, bench second, fly last:** every piece runs in SITL or on a desk (props off)
   before it goes on the drone.
3. **Add one new thing per flight.** If something goes wrong, we know exactly what caused it.

## 5.2 Tracks & team roles

| Track | Owner | Scope |
|-------|-------|-------|
| **A. Flight platform** | Flight/Electronics lead | Frame build, FC setup, calibration, tuning, failsafes, GPS missions, wiring harness, battery management. *Also the safety pilot.* |
| **B. Payload system** | Mechanical + firmware | CAD + print the winch/gripper, ESP32 firmware, bench rig, drop tests |
| **C. Onboard & precision** | Embedded/vision | Pi setup, mavlink-router, precision node, mission agent, payload bridge, camera calibration |
| **D. App & backend** | Software | FastAPI server, MAVLink link, React app (requester + operator), SITL + mock payload |

(Fewer people? Merge A+B and C+D. Everyone helps on test days.)

## 5.3 Phase plan (assumes ~12 weeks; stretch or squeeze to fit the deadline)

| Weeks | Phase | A. Flight | B. Payload | C. Onboard | D. App/backend | ✅ Exit criteria |
|-------|-------|-----------|------------|------------|----------------|------------------|
| 1–2 | **0. Foundations** | Assemble frame, wire power, flash/verify ArduCopter, calibrate accel/compass/RC/ESCs, props-off motor test | Measure the frame, sketch the winch + gripper, order parts | Flash Pi OS, set up SSH, install OpenCV, run SITL on a laptop | Repo scaffold, Figma wireframes, FastAPI + React skeletons, connect the server to SITL | Drone hovers in Stabilize/AltHold; server shows SITL telemetry |
| 3–5 | **1. Bench builds** | Loiter flights, PID autotune, failsafe tests (RC off → RTL), first AUTO waypoint mission | Print v1 winch + gripper; ESP32 firmware: homing, lower, retract, release; test with weights on a desk rig | Pi ↔ FC UART on the bench; mavlink-router; ArUco detection on a printed marker; camera calibration | Orders, inventory, auth; live map + HUD over WebSocket; pre-flight checklist; mock payload; full flow in SITL | Auto mission flown; winch lowers/retracts 300 g 20× without fault; full SITL demo |
| 6–7 | **2. Payload on the drone** | Mount the payload, re-balance, check vibration & CG, flight time test with dummy payload | Integrate with the FC PWM backup trigger; **low hover (3 m) drop tests via RC switch** | Precision node runs during manual hover; log marker error | Operator payload panel; requester tracking + clearance gate; events/logs | Drone hovers with payload ≥ 8 min; 10 successful RC-triggered drops |
| 8–9 | **3. Companion + precision** | Tune `PLND_*`; precision loiter tests | Slack-sensor tuning; stall/watchdog tests | Pi mounted on the drone; `LANDING_TARGET` loop; mission agent runs the full drop sequence (operator watching with RC override) | Mission upload from app; abort/RTL buttons wired to real commands | Holds over the marker within 30 cm; agent-run drop works 5× |
| 10–11 | **4. End-to-end** | Real routes 50 → 100 → 200 m in an open field | Reliability fixes | Link-loss + abort scenario tests | Polish UX, error states, replay logs | **Order in app → package delivered on the marker → drone home**, 5 runs in a row |
| 12 | **5. Demo** | Spare props/batteries, checklist | Spare gripper | Freeze code | Demo script, video, slides, docs | Rehearsed demo + backup video |

## 5.4 Test & safety rules (non-negotiable)

1. **Props off** for every bench test, firmware flash and config change.
2. **Safety pilot with RC transmitter** on every flight, with the flight-mode switch set to *Loiter/Stabilize* so they can
   take over from AUTO/GUIDED instantly.
3. **Geofence + RTL + battery failsafes** enabled before the first autonomous flight.
4. **Open field, no people under the flight path**, spectators ≥ 15 m behind the pilot.
   Drop zone handled by one person who steps back before giving "area clear".
5. **Pre-flight checklist** every time (it's built into the app; use the paper version until then).
6. LiPos: charge in a LiPo bag, never unattended, storage-charge when not flying, discard puffy packs.
7. **Regulations (India):** check the Digital Sky airspace map (fly in green zones, below 120 m,
   away from airports and restricted areas). Check whether the drone needs UIN registration
   for its weight class or qualifies for the R&D/educational exemption. Get written
   permission from the school and the ground owner.
8. Log every flight: date, battery, what was new, result, issues. Mission Planner's `.bin` logs
   are our best debugging tool.

## 5.5 Budget summary (approx., added parts only)

| Group | ₹ |
|-------|---|
| Pi 4 + SD + camera | 7,000–9,000 |
| TF-Luna rangefinder | 1,800–2,500 |
| ESP32 + motor + driver + servo + switches + sensors | 1,500–3,000 |
| UBECs, fuses, connectors, wire, hardware | 1,500–2,500 |
| PETG filament, rope, marker printing | 1,000–1,500 |
| Spare props + spare battery | 3,000–6,000 |
| *(If needed)* GPS module / RC set / charger | 1,500–15,000 |
| **Total (excluding the "if needed" row)** | **~16,000–25,000** |

Swapping to a Pi Zero 2 W and a cheaper camera brings this down by about ₹5,000.

## 5.6 Stretch goals (after the core works)

- 4G LTE dongle on the Pi → cloud server → real long-range operation + live video in the app
- Temperature logging inside the med box (for insulin/vaccines), shown in the app
- Autonomous pickup using the same marker + winch
- SMS/WhatsApp notifications to the requester
- RTK GPS for marker-free precision
- Multiple drones / multiple bases

## 5.7 Open questions (answer these before we start buying)

1. ~~What is the Radiolink PS100?~~ Answered: it's a **TS100 GPS + compass** (seen in the build photos).
2. Which **frame, props and battery** (S count, mAh) are we using?
3. Do we have an **RC transmitter + receiver**? Which model?
4. SiK telemetry **frequency** (433 or 915 MHz)?
5. **Deadline**, **team size**, and **budget**?
6. Target **delivery distance** for the demo (100 m? 500 m?) and **maximum package weight**?
7. Access to a **3D printer** and an **open field** for testing?
