# 10. Flying the app on real ArduPilot (SITL on a Windows laptop)

**SITL** = "Software In The Loop": the real ArduCopter autopilot code, running on a computer
instead of on the drone. Mission Planner on Windows can start it with one click.

```
 Windows laptop (friend's)                         Your Mac
┌───────────────────────────────┐   Wi-Fi    ┌──────────────────────────────────────────┐
│ Mission Planner               │            │ drone-bridge/bridge.py  ── WebSocket ──► │
│   └─ SITL (ArduCopter)        │◄── TCP ────│   --mavlink tcp:<WINDOWS_IP>:5762         │
│       port 5760 → Mission Pl. │   5762     │ npm run dev (app + server)               │
│       port 5762 → our bridge  │            │ /mission-control on the big screen       │
└───────────────────────────────┘            └──────────────────────────────────────────┘
                                                     ▲ phones place orders (same Wi-Fi)
```

Mission Planner keeps its own connection (port 5760), and our bridge uses the simulator's second port (5762).
Both can watch at the same time: Mission Planner becomes the "control tower" view of the same flight.

## Part A: Windows laptop

1. **Join the same Wi-Fi as the Mac.** A phone hotspot is best: school and guest Wi-Fi often block laptops from seeing each other.
2. **Start the simulator:** Mission Planner → **SIMULATION** tab → **Multirotor** (quad) → choose the stable version if asked.
   It downloads ArduCopter once, starts it, and connects. Wait until the HUD shows the drone on the map with a GPS fix (about 30 s).
3. **Allow it through the firewall:** if Windows asks, click **Allow** for *ArduCopter* / *Mission Planner* on **private networks**.
   Not asked? Windows Security → Firewall → *Allow an app through firewall* → tick ArduCopter.exe (Private). Also check the Wi-Fi profile is set to **Private**.
4. **Find the laptop's IP:** open Command Prompt → `ipconfig` → *IPv4 Address*, e.g. `192.168.43.25`. Write it down.

## Part B: Mac

Replace `192.168.43.25` with the Windows IP.

1. **Can the Mac reach the simulator?**
   ```bash
   nc -vz 192.168.43.25 5762
   ```
   You want `succeeded`. Timeout or refused → check Part A steps 1 and 3; also try port `5763`.
2. **Talk to ArduPilot:**
   ```bash
   cd drone-bridge
   .venv/bin/python bridge.py --check --mavlink tcp:192.168.43.25:5762
   ```
   It prints the ArduCopter version, mode, GPS fix and **Position**. Copy the position numbers.
3. **Move the app's hub to where SITL put the drone** (the simulator doesn't start at our real hub):
   ```bash
   HUB_LAT=<lat> HUB_LON=<lon> npm run seed
   HUB_LAT=<lat> HUB_LON=<lon> npm run dev
   ```
   (Run both from the repo root. `seed` resets demo data around the new hub.)
4. **Start the bridge** in a second terminal and leave it running:
   ```bash
   cd drone-bridge
   .venv/bin/python bridge.py --mavlink tcp:192.168.43.25:5762
   ```
5. **Switch the drone to ArduPilot:** app → log in as **Operator demo** → **Fleet** → MDR-01 → **Radio bridge**.
   MDR-01 should show *Online*, and the Mission Control header shows **MDR-01 · ArduPilot**.

## Part C: The demo

1. Big screen: open `http://localhost:5173/mission-control`. The ops sidebar has a link too.
2. A teammate orders on their phone (`http://<mac-ip>:5173`, **Customer demo**) and picks a spot near the hub.
   Emergency priority is auto-approved, which is quickest for demos.
3. Operator: **Orders** → open it → **Load & dispatch** → choose **MDR-01** → hold to launch.
4. Watch both screens:
   - **Mission Planner (Windows):** the drone arms, takes off in GUIDED, switches to **AUTO** and flies the mission. *Plan → Read WPs* shows the same 10 items.
   - **Mission Control (Mac):** order banner, ArduPilot mission step by step, telemetry from ArduPilot itself.
5. When it hovers at 4 m, the teammate presses **Area clear** on the phone → it continues, then returns and lands.

Tip: in Mission Planner you can speed the simulation up (Simulation/Actions → *SIM_SPEEDUP*) for a faster demo.

## When something goes wrong

| What you see | Fix |
|--------------|-----|
| `nc` times out | Different networks or firewall: use a phone hotspot; allow ArduCopter (Private network) |
| `No heartbeat` in the bridge | Wrong IP/port; is SITL still running in Mission Planner? |
| Launch fails: "No 3D GPS fix" | Wait 30 s after starting SITL, then dispatch again |
| Launch fails: "Command 400 failed" (arming) | Mission Planner's Messages tab shows the *PreArm* reason; usually just wait for the EKF to settle |
| Drone flies far away | The hub wasn't moved to SITL's position (Part B step 3) |
| Mission Control still says *SIM* | Fleet → MDR-01 → **Radio bridge**; the drone must not be flying when you switch |
| Mission rejected | Note the error the app shows; tell us which item |

**Back to normal afterwards:** Fleet → MDR-01 → **Simulator**, stop the bridge, and `npm run seed` without the `HUB_` values.

## Plan B: run the bridge on the Windows laptop

If the Mac can't reach port 5762, run the bridge next to SITL instead:
1. On Windows install Python 3.12, copy the `drone-bridge` folder, then `pip install pymavlink websockets`.
2. `python bridge.py --mavlink tcp:127.0.0.1:5762` (allow Python through the firewall, port 8765).
3. On the Mac: `HUB_LAT=… HUB_LON=… DRONE_BRIDGE_URL=ws://192.168.43.25:8765 npm run dev`.
