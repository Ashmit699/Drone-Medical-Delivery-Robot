# 3. Software & App

## 3.1 Tech stack

| Layer | Choice | Why this (vs. alternatives) |
|-------|--------|-----------------------------|
| **App (frontend)** | **React + TypeScript + Vite**, Tailwind CSS, React-Leaflet (OpenStreetMap tiles), Zustand (state), TanStack Query (API), installable **PWA** | One codebase for phone (requester) and laptop (operator). No app-store hassle. Leaflet + OSM is free with no API key. |
| **Backend** | **Python 3.11 + FastAPI** + Uvicorn, WebSockets, **SQLModel + SQLite**, JWT auth | Python because the drone libraries (pymavlink, OpenCV) are Python, so the whole team shares one backend/onboard language. SQLite needs zero setup. |
| **Drone link** | **pymavlink** | Full control of MAVLink, including routing to our custom payload component. (MAVSDK is easier but hides too much for this.) |
| **Onboard (Pi)** | Raspberry Pi OS Lite (64-bit), Python, pymavlink, **OpenCV (`cv2.aruco`)**, picamera2, **mavlink-router**, systemd services | Standard companion-computer stack for ArduPilot |
| **Payload firmware** | **ESP32, Arduino framework via PlatformIO (C++)**, ESP32Servo, ArduinoJson | Easy, well documented, real-time enough |
| **Flight firmware** | **ArduCopter** on CrossFlight, set up with Mission Planner | Mature autopilot with built-in precision landing/loiter, geofence and failsafes |
| **Simulation** | **ArduPilot SITL** + a **mock payload controller** (Python) | The software team can build *everything* before the drone is ready. The backend connects to SITL over UDP exactly as it would to the real radio. |
| **Dev tooling** | GitHub (issues + project board), Ruff/Black, ESLint/Prettier, pytest, Vitest | |

## 3.2 Users & roles

| Role | Device | Goal |
|------|--------|------|
| **Requester** (clinic / health worker / patient's helper) | Phone | Order supplies, choose the drop spot, track, confirm "area clear", confirm receipt |
| **Operator** (base station) | Laptop | Approve orders, load the package, run pre-flight, launch, monitor, intervene |
| **Admin** (same UI as operator) | Laptop | Manage inventory, drop zones, users, settings, view logs |

## 3.3 UI/UX design

### Design principles
1. **Map-first.** Location is everything in this product.
2. **Status is always visible.** One colour-coded status pill everywhere: grey *Requested*, blue *Approved/Loading*, indigo *In flight*, amber *At drop zone / waiting for you*, green *Delivered*, red *Problem/Aborted*.
3. **Dangerous actions need deliberate input.** Launch, Abort, Release and RTL use *press-and-hold for 1 s* buttons, never a single tap.
4. **Outdoor-readable.** High contrast, large touch targets (≥ 48 px), and a dark mode for the operator.
5. **Honest about the link.** Show "Telemetry: 0.4 s ago" in green, or "Link lost 12 s" in red. Never show stale data as live.
6. **Safety instructions inline.** For example, "Stay 5 m away from the marker while the package is lowered."

Palette: medical teal `#0E9F9A` as primary, white/neutral surfaces, red `#DC2626` for emergency/abort, amber `#F59E0B` for warnings, green `#16A34A` for success.

### Requester app (mobile)

```
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ MediDrop      👤      │  │ ← New request         │  │ ← Drop location       │
│                       │  │ Items        120/300 g│  │ ┌───────────────────┐ │
│ ┌───────────────────┐ │  │ ☑ First-aid kit  150g │  │ │      [ MAP ]      │ │
│ │ ● In flight       │ │  │ ☐ ORS sachets ×5  60g │  │ │        📍         │ │
│ │ ETA 3 min  ▸Track │ │  │ ☐ Insulin pen     40g │  │ │  ◯ 3 m clear zone │ │
│ └───────────────────┘ │  │ ☐ Antiseptic      90g │  │ └───────────────────┘ │
│                       │  │ ▓▓▓▓▓▓░░░░ payload    │  │ Saved: PHC Gate ▾     │
│  ┌─────────────────┐  │  │ Priority              │  │ ☑ Open sky, no wires/ │
│  │ + REQUEST       │  │  │ (●Emergency)(Urgent)  │  │   trees within 3 m    │
│  │   DELIVERY      │  │  │ (Routine)             │  │ ☑ Marker placed       │
│  └─────────────────┘  │  │ Notes [__________]    │  │                       │
│ History               │  │        [ Next → ]     │  │ [ Confirm location ]  │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
        Home                     Items & priority            Drop location

┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ Tracking   ● In flight│  │ ⚠ Drone is overhead   │  │ ✓ Delivered           │
│ ┌───────────────────┐ │  │                       │  │                       │
│ │ [MAP: 🏥····✈····📍]│ │  │ Keep 5 m away from the│  │ First-aid kit         │
│ └───────────────────┘ │  │ marker. Tap when the  │  │ delivered 14:32       │
│ ✓ Approved            │  │ area is clear.        │  │                       │
│ ✓ Took off 14:21      │  │                       │  │ [ I've received it ]  │
│ ● En route  ETA 3 min │  │ ┌───────────────────┐ │  │ ☆☆☆☆☆  Rate           │
│ ○ Lowering package    │  │ │ HOLD: AREA CLEAR  │ │  │                       │
│ ○ Delivered           │  │ └───────────────────┘ │  │                       │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
        Live tracking         Clearance gate (safety)        Confirmation
```

Screens: Login → Home → New request (items → location → review with ETA/distance) → Tracking
→ Clearance gate → Delivered/receipt → History. A "Drop zone guide" page shows how to place
the printed marker.

### Operator dashboard (laptop)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ MediDrop Ops   Orders │ Flight │ Inventory │ Logs │ Settings     ● Link 0.2s  🔋 82%│
├────────────────────┬─────────────────────────────────────────┬───────────────────┤
│ ORDER QUEUE        │                                         │ HUD               │
│ 🔴 #104 Emergency  │              [ LIVE MAP ]               │ Mode   AUTO       │
│   PHC Gate · 210g  │      🏠 ·······✈············📍          │ Alt    24.1 m     │
│   [Approve][Reject]│         geofence ┄┄┄┄┄┄┄┄┄              │ Speed  6.2 m/s    │
│ 🟡 #103 Urgent     │                                         │ GPS    3D · 14 sat│
│ 🔵 #102 In flight  │                                         │ Batt   15.4V 82%  │
│ 🟢 #101 Delivered  │                                         │ Dist   410 m      │
├────────────────────┤                                         ├───────────────────┤
│ PRE-FLIGHT ✓ 11/12 │                                         │ PAYLOAD           │
│ ☑ Battery ≥ 16.4 V │                                         │ Gripper  CLOSED 🔒│
│ ☑ GPS 3D, ≥10 sats │                                         │ Winch    HOMED    │
│ ☑ Payload locked   │─────────────────────────────────────────│ Rope ▕▏ 0.00 m    │
│ ☑ Winch homed      │ Mission ▓▓▓▓▓▓▓▓░░░░ Cruise → Approach   │ [Jog▲][Jog▼]      │
│ ☐ Area clear       │ Marker: — │ Precision: — │ Clearance: — │ [HOLD: RELEASE]   │
│ [HOLD: LAUNCH]     │ [HOLD: PAUSE] [HOLD: ABORT DROP] [HOLD: RTL] [HOLD: LAND] │
└────────────────────┴─────────────────────────────────────────┴───────────────────┘
```

Operator pages:
- **Orders:** queue with priority sorting; approve/reject; mission auto-planned when approved.
- **Flight (main):** live map, HUD, mission progress, payload panel, pre-flight checklist, and
  control buttons. *Launch stays disabled until every check is green.* Some checks are automatic
  from telemetry (battery, GPS, EKF, payload homed); others are manual ticks (props tight,
  area clear at base).
- **Mission plan view:** route, altitude, geofence, drop altitude, distance/time/battery
  estimate, wind entry, editable waypoints.
- **Inventory:** items with weight and stock (the app blocks orders > 300 g or out of stock).
- **Drop zones:** saved named locations (lat/lon + marker ID).
- **Logs:** every flight's events and a downsampled telemetry track (replay on the map).
- **Settings:** home location, cruise/drop altitude, max payload, geofence radius, timeouts.

## 3.4 Backend design (`server/`)

```
server/
  app/main.py              FastAPI app, CORS, routers
  app/auth/                JWT login, roles (requester/operator/admin)
  app/orders/              models + routes + state transitions
  app/inventory/
  app/zones/               saved drop zones
  app/missions/planner.py  order → waypoint list (takeoff, cruise alt, drop wp, RTL)
  app/vehicle/link.py      MAVLink connection (serial SiK OR udp SITL), heartbeats, reconnect
  app/vehicle/telemetry.py parses messages → VehicleState (pos, alt, batt, mode, gps, payload)
  app/vehicle/commands.py  arm, upload mission, set mode, clearance, abort, winch jog
  app/preflight.py         automatic checks from VehicleState
  app/ws.py                WebSocket hub: pushes state @5 Hz + events
  app/db.py                SQLModel / SQLite
```

**Data model:** `User`, `Item(name, weight_g, stock)`, `DropZone(name, lat, lon, marker_id)`,
`Order(id, requester, priority, status, zone, notes, timestamps)`, `OrderItem`, `Mission(order,
waypoints_json, status)`, `Event(mission, time, type, message)`, `TelemetrySample` (1 Hz, for replay).

**Key API:**

| Method | Path | Who |
|--------|------|-----|
| POST | `/auth/login` | all |
| GET/POST | `/orders`, `/orders/{id}` | requester (own), operator (all) |
| POST | `/orders/{id}/approve` · `/reject` | operator |
| POST | `/orders/{id}/clearance` | requester or operator (the "area clear" gate) |
| POST | `/orders/{id}/received` | requester |
| GET | `/missions/{id}/plan` | operator |
| GET | `/vehicle/preflight` | operator |
| POST | `/vehicle/launch` · `/pause` · `/resume` · `/rtl` · `/land` · `/abort-drop` | operator |
| POST | `/vehicle/payload/jog` · `/release` · `/home` | operator |
| WS | `/ws` | all, filtered by role |

**One switch to rule them all:** `MAVLINK_URL=udp:127.0.0.1:14550` (SITL) or
`MAVLINK_URL=/dev/tty.usbserial-XXXX:57600` (real SiK radio). Nothing else changes.

## 3.5 Onboard software (`onboard/`, Raspberry Pi)

Three small Python services (systemd, auto-start on boot), connected via **mavlink-router**,
which shares the FC's UART among them:

1. **`mission_agent`**: the drop-zone brain.
   - Watches `MISSION_ITEM_REACHED`. When the drop waypoint is reached it switches the FC to
     *GUIDED/LOITER*, descends to drop altitude using the rangefinder, enables precision loiter,
     and waits until the drone is centred.
   - Sends `STATUSTEXT` and named values (`drop_state`, `marker_err_cm`) so the app can show
     progress.
   - Waits for the **clearance** command from the ground (with a timeout), then commands the
     ESP32: `lower` → waits for `on_ground` → `release` → `retract` → waits for `homed` →
     sets the FC to **RTL**.
   - Abort or link loss at any point leads to `retract`, then hold, then RTL.
2. **`precision_node`**: the camera loop (10–20 Hz).
   - Captures 640×480 → detects the ArUco marker → computes angular offset using camera
     calibration → sends **`LANDING_TARGET`** to the FC (ArduPilot's precision loiter/land uses it).
3. **`payload_bridge`**: talks to the ESP32 over USB serial; forwards commands from MAVLink
   (`COMMAND_LONG` addressed to our payload component) and publishes ESP32 status back as MAVLink.

## 3.6 ESP32 payload firmware (`firmware/payload/`)

State machine:

```
BOOT → HOMING → IDLE_LOCKED ⇄ (JOG)
IDLE_LOCKED --lower(len)--> LOWERING --slack--> ON_GROUND --release--> RELEASED
RELEASED --retract--> RETRACTING --limit switch--> IDLE_EMPTY (homed)
any --stall/timeout/abort--> FAULT_STOPPED --retract--> RETRACTING
```

Built-in safety (works even if the Pi dies):
- **Heartbeat watchdog:** no message from the Pi for 3 s while the rope is out → auto-retract.
- **Soft limit:** never pay out more than `MAX_ROPE_M` (for example 5.0 m) by encoder count.
- **Stall detection:** motor driven but encoder not moving for 500 ms (or INA219 current spike) → stop + FAULT.
- **Slow zone:** reduce speed near the bottom and when reaching the top limit.
- **Release interlock:** the gripper only opens in `ON_GROUND` (or with an explicit operator force-release).
- **PWM backup input:** FC servo channel: < 1200 µs = retract/hold, 1500 = stop, > 1800 = lower; a separate pulse range for release. This lets the RC pilot run it with a switch.

### Pi ↔ ESP32 protocol (newline-delimited JSON @ 115200)

```jsonc
// Pi → ESP32
{"cmd":"home"}
{"cmd":"lower","len_m":4.2,"speed":0.2}
{"cmd":"stop"}
{"cmd":"release"}
{"cmd":"grip"}
{"cmd":"retract"}
{"cmd":"hb"}                       // heartbeat every 500 ms

// ESP32 → Pi (status @ 10 Hz + on change)
{"st":"LOWERING","len_m":2.31,"grip":"closed","home":false,"slack":false,"fault":null}
{"st":"FAULT_STOPPED","len_m":3.02,"fault":"STALL"}
```

## 3.7 Simulation-first development (do this from week 1)

```
ArduPilot SITL (sim_vehicle.py -v ArduCopter)  ──udp──►  server/  ──ws──►  app/
        ▲                                              
        └── mavlink ── onboard/ running on the laptop ── mock_payload.py (fake ESP32)
```

- `sim/mock_payload.py` behaves exactly like the ESP32 (same JSON, fake rope speed, fake slack).
- So the **full flow (order → approve → launch → fly → align → clearance → lower → release →
  retract → RTL) can be demoed on a laptop** long before the hardware is ready, and every
  piece can be tested without risking the drone.
