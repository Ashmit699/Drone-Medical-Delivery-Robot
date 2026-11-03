# 9. Testing plan: step by step

We test like climbing a ladder: **finish each stage before starting the next**. If something fails,
fix it and repeat that stage. Never skip ahead to flying.

| Stage | What we test | Drone needed? | Propellers | Time |
|-------|--------------|---------------|------------|------|
| 1 | The app with the simulated drone | No | – | 30–45 min |
| 2 | Drone bridge vs. a pretend flight controller | No | – | 15 min |
| 3 | Drone bridge vs. real ArduPilot code (SITL simulator) | No | – | 1–2 h first time |
| 4 | Real drone on the bench | Yes | **OFF** | 1 h |
| 5 | Winch + gripper on the bench | Yes | **OFF** | 1 h (once built) |
| 6 | Real flights, slowly increasing | Yes | On | several sessions |

**Team roles (3 people)** from stage 4 onward:
- **Safety pilot**: holds the RC transmitter the whole time and has the final say. One flick of the mode switch (LOITER/STABILIZE) takes control from the computer.
- **Operator**: runs the laptop (app + bridge), reads out the drone's status, presses Launch / Pause / Return.
- **Ground person**: at the drop zone, keeps people away, presses **Area clear** on the phone.

---

## Stage 1: The app with the simulated drone

**Goal:** every screen and rule works before any hardware is involved. This is also the exhibition demo.

Setup:
```bash
npm install
npm run seed      # fresh demo data
npm run dev       # app on :5173, API on :4000
```
Open http://localhost:5173 on the laptop, and the LAN address printed by `npm run dev` on a phone (same Wi-Fi).

Tick each one:

**Customer (phone, "Customer demo" login)**
- [ ] Shop: search "fever", filter by category, add items. Cart badge and pop-up appear.
- [ ] Cart drawer: payload meter turns red over 300 g and Checkout is blocked.
- [ ] Checkout: pick a spot in **2D**, then in **3D**. A spot outside the circle is refused.
- [ ] Checkout: Rx item without a prescription photo is blocked; with a photo it goes through.
- [ ] Priority: Standard → Express → Emergency changes the fee (Emergency = free).
- [ ] Place the order → tracking page opens with "Order placed".

**Operator (laptop, "Operator demo" login)**
- [ ] Dashboard: new-order pop-up appears; weather card shows GO/CAUTION/NO-GO.
- [ ] Orders: open it, view prescription, **Approve**. The customer's phone updates by itself.
- [ ] Load & dispatch: pre-flight list; Launch only works when all boxes pass; hold to launch.
- [ ] Live monitor + customer tracking both show the drone moving (same position).

**The delivery**
- [ ] Drone reaches "Waiting for area clear". Customer holds the button → lowering → delivered → returns → lands.
- [ ] Order shows **Delivered**; customer can rate it; dashboard numbers go up.

**Things that must go wrong safely**
- [ ] Pause during cruise → drone holds; Resume → continues.
- [ ] Return home during lowering → rope reels in first → order ends **Failed: back at base**.
- [ ] Reject an order with a reason → customer sees the reason, stock goes back.
- [ ] SOS button → emergency order is auto-approved and goes first in the queue.
- [ ] Welfare: apply as customer → verify as operator → customer gets a pop-up, prices drop at checkout.
- [ ] Turn Wi-Fi off and on during a flight → the tracking page catches up by itself.

✅ **Pass:** every box ticked on two different devices.

---

## Stage 2: Drone bridge vs. pretend flight controller

**Goal:** the bridge sends the right MAVLink messages in the right order. No ArduPilot needed.

```bash
cd drone-bridge
uv venv -p 3.12 && uv pip install -r requirements.txt      # first time only
.venv/bin/python mock_fc.py                                   # terminal 1: pretend drone
.venv/bin/python bridge.py --mavlink udpin:127.0.0.1:14560    # terminal 2: bridge
npm run dev                                                   # terminal 3 (repo root)
```
In the app: **Ops → Fleet → MDR-01 → Radio bridge**. The link should say *Online*.

- [ ] Dispatch an order to MDR-01. Terminal 1 prints: upload 10 items → mission accepted → GUIDED → armed → takeoff → AUTO.
- [ ] App reaches "Waiting for area clear". Press it → terminal 1 shows `set current -> 6` and `SERVO9 = 1900`.
- [ ] Order ends **Delivered**, phase **completed**.
- [ ] Second flight, press **Return home** during lowering → terminal 1 shows `SERVO9 = 1100`, `LOITER`, `RTL` → order **Failed**.
- [ ] Third flight works normally (no leftovers from the abort).
- [ ] When done: Fleet → MDR-01 → back to **Simulator**.

✅ **Pass:** all three flights behave as above. (This already passed once during development.)

---

## Stage 3: Real ArduPilot code (SITL)

**Goal:** the bridge works against the *real* ArduCopter software, running on a computer instead of the drone.

**Easiest: a Windows laptop with Mission Planner**
1. Install Mission Planner → **Simulation** tab → **Multirotor** → it downloads and starts ArduCopter SITL, and connects itself on TCP 5760.
2. The simulator also listens on **TCP 5762**. Run the bridge there (Python + bridge on the same laptop):
   `python bridge.py --mavlink tcp:127.0.0.1:5762`
3. Set the simulator's home near our hub, or set `HUB_LAT` / `HUB_LON` for the backend to the simulator's home.

**On the Mac: build ArduPilot yourselves** (about 1 GB and 15 min; needs Xcode command-line tools):
```bash
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git
cd ardupilot && ./waf configure --board sitl && ./waf copter
build/sitl/bin/arducopter --model + --speedup 1 --defaults Tools/autotest/default_params/copter.parm -I0 --home 28.6139,77.209,214,0
# then: python bridge.py --mavlink tcp:127.0.0.1:5760
```

Run the same checks as stage 2, plus:
- [ ] `bridge.py --check` prints the ArduCopter version.
- [ ] Mission upload accepted; Mission Planner (if connected) shows the same 10 waypoints.
- [ ] Simulated drone takes off, flies to the drop point, descends to 4 m and **hovers until Area clear**.
- [ ] After Area clear, `SERVO9` goes to 1900 (Mission Planner → Data → Status → `servo9_raw`).
- [ ] Drone returns, lands, disarms; app shows **completed**.
- [ ] Pause / Resume in mid-air works.
- [ ] **Stop the bridge (Ctrl+C) mid-flight** → after a few seconds ArduPilot's GCS failsafe sends the drone home (needs `FS_GCS_ENABLE = 1`).
- [ ] Don't press Area clear for 3 minutes → the drone gives up and comes home.
- [ ] Download the order's **.waypoints** file → Mission Planner → Plan → Load WP File → it opens correctly.

✅ **Pass:** every box ticked. Write down anything that behaved differently from stage 2.

---

## Stage 4: Real drone on the bench, PROPELLERS OFF

**Goal:** our CrossFlight accepts the mission, mode changes and arming from the bridge.

**Safety before anything:** remove all 4 propellers. Charged LiPo, in a LiPo bag nearby. RC transmitter ON and in the pilot's hands.

1. **Connect:** plug the SiK ground radio into the Mac. Find its port:
   `ls /dev/tty.usb*` → e.g. `/dev/tty.usbserial-0001`
2. **Check (no flying):**
   `.venv/bin/python bridge.py --check --mavlink /dev/tty.usbserial-0001 --baud 57600`
   - [ ] Prints the ArduCopter version (write it down, it's RadioLink's build).
   - [ ] GPS fix 3 with 8+ satellites: put the drone by a window or outside; GPS doesn't work indoors.
   - [ ] Battery voltage looks right (4S full ≈ 16.8 V).
3. **Parameters:** set these once in RadioLink's Mission Planner (Windows) or QGroundControl (Mac):
   `SERVO9_FUNCTION = 0`, `FS_GCS_ENABLE = 1`, `FS_THR_ENABLE = 1`, `RTL_ALT = 2500`, `RTL_ALT_FINAL = 0`,
   `WPNAV_SPEED = 1200`, `FENCE_ENABLE = 1` (full list: [docs/08 §8.4](08-ardupilot-auto-missions.md)).
   - [ ] Write them, reboot, read them back.
4. **Mission upload by hand:** download an order's `.waypoints` → Mission Planner → **Load WP File** → **Write WPs** → **Read WPs**.
   - [ ] The CrossFlight accepts all items and reads back the same list. Note any item it rejects, especially `NAV_LOITER_UNLIM` (17).
5. **Full bridge run, props off:** start the bridge on the radio port, backend `npm run dev`, Fleet → MDR-01 → **Radio bridge**, dispatch an order.
   - [ ] Upload accepted → mode GUIDED → **motors arm and spin slowly** (props are off!) → AUTO.
   - [ ] Or: arming refused with a clear pre-arm error in the app. That's fine, fix the cause (calibration, GPS, battery) and retry.
   - [ ] Safety pilot flips the mode switch to STABILIZE → the drone obeys the remote, not the computer.
   - [ ] Disarm from the remote.
6. **Failsafes on the bench:**
   - [ ] Switch the RC transmitter off → failsafe message (radio lost).
   - [ ] Stop the bridge → GCS failsafe message after a few seconds.
7. **Trigger wire:** Mission Planner → Servo/Relay tab → set SERVO9 to 1900 / 1500 / 1100.
   - [ ] The ESP32 (or a servo tester / LED) sees the change.

✅ **Pass:** mission accepted, modes and arming work, remote always wins, failsafes trigger.

---

## Stage 5: Winch + gripper on the bench (once built)

**Goal:** the payload system works on its own before it ever flies.

Drone on a table edge or stand so the rope can hang down. Propellers OFF. A 300 g test box.

- [ ] Power on → winch reels in until the top switch clicks (home).
- [ ] SERVO9 = 1900 → box lowers smoothly at ~25 cm/s.
- [ ] Box touches the floor → slack detected → hooks open → rope reels back in → stops at home.
- [ ] Mid-lowering, SERVO9 = 1100 → stops and reels the box back up (abort).
- [ ] Pull the winch's power mid-lowering → **the box does not drop** (worm gear holds).
- [ ] Block the rope by hand → motor stops (stall detection), no burning smell.
- [ ] Run it 20 times in a row without a fault.

✅ **Pass:** 20/20 clean drops, abort works, power-cut and stall are safe.

---

## Stage 6: Real flights, step by step

**Before every flight, all three say "go":**
- [ ] Open field, no people under the flight path, spectators 15 m+ behind the pilot.
- [ ] Allowed to fly there: green zone on Digital Sky, below 120 m, school/landowner permission.
- [ ] App weather card says GO (wind under 25 km/h, no rain).
- [ ] Battery full and warm; props tight; GPS 8+ satellites; geofence on.
- [ ] Pilot's mode switch tested on the ground.

**Stop immediately (pilot takes over, lands)** if: the drone drifts or wobbles, any failsafe message,
battery under 30%, people walk into the area, or anyone feels unsure.

Go up one step at a time:
1. **Manual hover** (pilot only): STABILIZE → ALTHOLD → LOITER, 1–2 m high. Then flip to RTL once and see it come home and land.
2. **Simple auto mission from Mission Planner**, no app: take off to 10 m, one waypoint 30 m away, RTL.
3. **App-driven flight, 30–50 m, no payload:** dispatch from the app; ground person presses Area clear; it comes home.
4. **Same, with the winch and a light dummy box** (200 g sandbag): first real rope drop.
5. **Abort test in the air:** press Return home during lowering, check the rope comes up first.
6. **Increase the distance:** 100 m → 200 m → across the demo zone (1.3 km radius).
7. **Real medical box, full delivery**, with the customer app on a phone at the drop zone.

After each flight:
- [ ] Download the flight log (Mission Planner → DataFlash Logs) and write down: date, battery used, what was new, what happened.
- [ ] Anything odd? Go back one step.

---

## The day before the exhibition (app only)

- [ ] `npm run seed` for fresh demo data; set `HUB_LAT` / `HUB_LON` to the venue.
- [ ] Phone hotspot ready: live weather and map images need internet.
- [ ] One full Stage 1 run-through on the exhibition laptop and two phones.
- [ ] `SIM_SPEED=4` (default) so a demo delivery takes about a minute.
- [ ] Fleet: every drone on **Simulator** (unless you're really flying).
