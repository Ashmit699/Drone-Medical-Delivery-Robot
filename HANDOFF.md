# MediDrop: full project handoff (A to Z)

This file hands the project to a new AI coding agent (Antigravity) or a new teammate. It covers
everything decided and built so far: the goal, the hardware, the decisions, the code, how to run it,
how to test it, how to demo it at the exhibition, the bugs we already hit, and what is still open.

Read it top to bottom once. Then read [`README.md`](README.md) and the documents in [`docs/`](docs/) as needed.

---

## 0. Quick facts

| | |
|---|---|
| Project | **MediDrop**: a drone medical delivery robot (school exhibition project) |
| Team | 3 people, about a 5-day build for the exhibition |
| Repository | https://github.com/Ashmit699/Drone-Medical-Delivery-Robot (branch `main`; the owner pushes straight to `main`) |
| Local path | `~/Desktop/School project/Drone Medical Delivery Robot` (Mac, Apple Silicon, Homebrew Node 26) |
| Run | `npm install` once, then `npm run dev` at the repo root, which starts the app on :5173 and the API on :4000 |
| Demo logins | Login page buttons **Customer demo** (`customer@medidrop.app`) and **Operator demo** (`ops@medidrop.app`); password `demo1234` for both. These are seeded test accounts only. |
| Big-screen page | `http://localhost:5173/mission-control` |
| Explainer deck | 19-slide "how it all works" deck for non-experts, a private claude.ai artifact: https://claude.ai/artifact/DWucvjQbbpMLpFu7kvQdL2. The last slide still has the placeholders `[Team member names] · [School name]`. |

---

## 1. What the project is

A quadcopter flies medical supplies (medicines, first-aid kits, relief items, max **300 g**) from a hub
to a customer's chosen spot. It **never lands at the destination**. Instead it:

1. hovers at about 4 m over the drop point,
2. waits until the person on the ground taps **"Area clear"** in the app,
3. lowers the package on a rope from a **winch/pulley**,
4. opens a **servo-driven 2-hook gripper** to release it,
5. reels the rope back in and flies home (RTL) to land.

There are two halves:

- **The app (the main focus for the exhibition):** an online medical shop with cart, checkout, a map
  drop-point picker (2D plus 3D), live tracking, an operator console that approves and launches flights,
  and a public "Mission Control" big screen.
- **The drone integration (prototype or plan level):** the app turns each order into a real
  **ArduPilot (ArduCopter) AUTO mission**, and a Python **bridge** uploads and flies it over MAVLink. It is
  demonstrated with a mock flight controller and with **ArduPilot SITL** (simulator) running in Mission
  Planner on a friend's Windows laptop. Real flights come later.

### Scope decision by the owner (important)

> Focus on the **app frontend and backend**. Keep drone integration light: plan it, build a base or seam,
> and show guests a small prototype of how it will connect. Don't do hardcore backend.

The owner also wants the UI to look **futuristic and modern** (dark, neon or HUD style). They complained
once that it looked "too basic", which led to a full redesign. Don't make it look plain.

---

## 2. Hardware (confirmed from photos)

| Part | Detail |
|------|--------|
| Frame | **S500** quad frame |
| Flight controller | **Radiolink CrossFlight v1.1**, running RadioLink-branded ArduCopter |
| GPS + compass | **Radiolink TS100** on a mast. The owner first called it "PS100"; photos showed TS100. |
| ESCs | 4× Readytosky 40A |
| Motors | 4× RS2312(13) 920KV with about 9.4" props |
| Power | CrossFlight PDB |
| Telemetry | SimplyFly SiK radio pair, which carries MAVLink to the laptop |
| RC | Radiolink transmitter and receiver |
| Payload (planned) | ESP32 controls the winch motor plus the gripper servo. The flight controller triggers it with a servo output (see §7). |
| Camera | **M5Stack UnitV (K210)**. The owner added `camera/unitv_stream.py`, which streams it over USB serial as MJPEG on `http://localhost:8090`. It is not yet wired into the app. |

**CrossFlight caveat:** it runs RadioLink's fork of ArduCopter. ArduPilot doesn't officially support it,
and firmware updates come only through RadioLink's own Mission Planner build. The standard MAVLink
mission protocol works, but test early.

Details are in [`docs/02-hardware-electronics.md`](docs/02-hardware-electronics.md) and
[`docs/04-precision-navigation.md`](docs/04-precision-navigation.md). The navigation plan goes GPS, then a
rangefinder, then a camera with an ArUco marker, aiming for about ±20 cm drops.

---

## 3. Repository layout

```
HANDOFF.md            ← this file
README.md             doc index + how to run
package.json          npm workspaces: server, app. Scripts: dev, seed, typecheck, build
.claude/launch.json   preview config "medidrop" → npm run dev on port 5173
app/                  React web app (customer shop + operator console + Mission Control)
server/               Node API + SQLite + realtime + drone adapters + mission builder
drone-bridge/         Python pymavlink bridge (app ⇄ ArduPilot) + mock flight controller
camera/               UnitV camera MJPEG streamer (owner-added)
docs/01..10           plan, research and guide documents
```

### docs/

| # | File | Contents |
|---|------|----------|
| 1 | `01-system-architecture.md` | All components and how they talk |
| 2 | `02-hardware-electronics.md` | Kit, parts to buy, weight and power, wiring, winch and gripper |
| 3 | `03-software-app.md` | Original software plan (Pi companion, ESP32 firmware, protocols) |
| 4 | `04-precision-navigation.md` | GPS → rangefinder → ArUco precision drop |
| 5 | `05-build-roadmap.md` | Phases, team roles, safety |
| 6 | `06-app-plan.md` | Exhibition app plan: stack, pages, rules, drone seam |
| 7 | `07-3d-map-plan.md` | 3D drop picker (SkyFi / Vantor 3DSM reference) |
| 8 | `08-ardupilot-auto-missions.md` | **How orders become ArduCopter AUTO missions**: the mission table, flight controller parameters, Mission Planner workflow |
| 9 | `09-testing-plan.md` | Stages 1–6 testing ladder, checklists, roles, go/no-go |
| 10 | `10-sitl-windows-setup.md` | Connect Windows Mission Planner SITL to the Mac app and bridge |
| 11 | `11-storage-box-servo.md` | Storage box door servo on output 8: mission steps, app buttons, wiring and FC setup |

Folders the README mentions for later (`onboard/`, `firmware/payload/`, `hardware/`) **don't exist yet**.

---

## 4. Tech stack

**Frontend (`app/`)**
- React 19, TypeScript, **Vite 8**, React Router 7
- **Tailwind CSS v4**. Custom classes such as `card`, `btn`, `btn-primary`, `input`, `label`, `glow-text`, `hud` and `hud-frame` are declared with **`@utility`** in `src/index.css`. In v4, `@apply` only works with utilities, so a plain class won't work.
- Zustand stores (persisted): `auth`, `cart`, `ui`
- Maps:
  - **react-leaflet** with Esri World Imagery satellite tiles, darkened with a CSS filter. CARTO dark tiles needed a key, so we dropped them.
  - **CesiumJS 1.147** for 3D, lazy-loaded.
- Recharts for operator charts, Socket.IO client, lucide-react 1.x icons
- Fonts: Inter, JetBrains Mono, Space Grotesk

**Backend (`server/`)**
- Node 26 (needs 22.5+ for the built-in **`node:sqlite`** `DatabaseSync`), Express 5, TypeScript via `tsx`
- zod 4 validation, JWT plus bcryptjs auth, **Socket.IO** realtime
- Open-Meteo weather (no API key)

**Drone side**
- Python 3.12, `pymavlink>=2.4.41`, `websockets>=13`. The venv is at `drone-bridge/.venv` (made with `uv`; git-ignored).
- ArduPilot ArduCopter, Mission Planner (Windows), SITL

---

## 5. How to run

```bash
npm install        # once
npm run seed       # optional: reset the database to fresh demo data
npm run dev        # app http://localhost:5173 , API http://localhost:4000
```

- The database is a SQLite file created and seeded on first start. `*.db`, `*.db-wal` and `*.db-shm` are git-ignored.
- Vite runs with `--host`, so phones on the same network can open `http://<mac-ip>:5173`.
- Vite proxies `/api` and `/socket.io` to `:4000`.
- `npm run typecheck` checks both workspaces. `npm run build` builds the app.

### Environment variables (server)

| Var | Default | Meaning |
|-----|---------|---------|
| `API_PORT` | 4000 | API port. **Not `PORT`**: the preview launcher sets PORT=5173 and caused a clash. |
| `HUB_LAT` / `HUB_LON` | 28.645189 / 77.381497 (school, Judges Enclave, Indirapuram, Ghaziabad) | Drone hub. Override with SITL's position for simulator demos. |
| `SERVICE_RADIUS_KM` | 1.3 | Delivery radius |
| `SIM_SPEED` | 4 | Built-in simulator speed multiplier |
| `PAYLOAD_MODE` | `esp32` (servo trigger) | `ardupilot-winch` uses ArduPilot's DO_WINCH / DO_GRIPPER instead (see `server/src/drone/mission.ts`) |
| `DRONE_BRIDGE_URL` | `ws://127.0.0.1:8765` | Where the Python bridge listens |
| `DB_PATH`, `JWT_SECRET` | | Database file and token secret |

### Environment variables (app, `app/.env`; see `app/.env.example`)

Set **one** of these for real 3D:
- `VITE_CUSTOM_3DTILES_URL`: your own 3D Tiles, such as a bought Vantor 3DSM or a WebODM model
- `VITE_GOOGLE_MAPS_API_KEY`: Google Photorealistic 3D Tiles
- `VITE_CESIUM_ION_TOKEN`: Cesium World Terrain plus OSM Buildings

With none set, the 3D view uses free satellite imagery on a flat globe. This was the "free 3D now, slot for Vantor later" decision.

---

## 6. The app

### 6.1 Business rules (`server/src/config.ts`, `server/src/orders.ts`)

**Demo zone**
- Service radius **1.3 km** (about 5.3 km²) inside a 2.4 × 2.4 km square around the hub.
- The owner asked for a small 5–6 km² area.

**Business model: emergency-only, paid by subscription** (changed 5 Nov 2026 at the owner's request)
- **Every order is an emergency.** There is no standard or express option. Orders are **auto-approved** unless an item needs a prescription.
- The drone always flies at **top speed**: `config.flight.cruiseSpeedMs` = **15 m/s** (54 km/h, ArduCopter WPNAV_SPEED 1500).
- **No payment per order.** Customers pay a monthly **MediDrop Care plan**, like insurance. Every emergency delivery, supplies included, is then free (`server/src/subscription.ts`, `subscriptions` table, page `/plans`).

| Plan | Price | People | Free deliveries | Supplies covered per delivery |
|------|-------|--------|-----------------|-------------------------------|
| Personal | ₹99/month | 1 | 4 per month | ₹1,000 |
| Family | ₹249/month | up to 5 | 10 per month | ₹1,500 |
| Care+ | ₹449/month | up to 5 | unlimited | ₹3,000 |

- **No plan, used up, or over the limit:** the quote returns a "problem" and checkout shows a "Choose a plan" button.
- **Plan payment** is simulated (UPI autopay, no real charge).
- **Orders:** `priority='emergency'`, `total=0`, `payment_method='plan'`, `payment_status='covered'`. `items_total` keeps the value of the supplies.
- **Welfare:** BPL −50%, SC/ST −40%, EWS −30%, now taken **off the plan price** once an operator verifies the document.
- **Operator dashboard:** shows "Plan income / month" and active members instead of revenue per order.
- **Demo customer** is seeded with an active **Family** plan.
- **Max payload** is still **300 g**.

**Other**
- Flight: cruise **60 m** (clears Indirapuram's towers), drop height 4 m, 15 m/s, usable flight time about 600 s (the quote shows battery use %).
- Clearance timeout: 180 s waiting for "Area clear", then the drone aborts.
- Order status: `placed → approved → in_flight → delivered`, or `rejected`, `cancelled` or `failed`.

### 6.2 Customer pages (`app/src/pages/`)

| Route | Page |
|-------|------|
| `/` | Home, styled like a normal pharmacy business: hero with search, Order now / SOS / Plans buttons, health-campaign ads (diabetes, heart, mother & baby), categories, most-ordered products, how it works, road vs drone time, plans teaser, reviews. Operator-style info (airspace, weather, fleet) moved behind a **Live operations** button that opens `/live`. |
| `/plans` | MediDrop Care plans: compare, subscribe (demo payment), switch or cancel, current usage |
| `/features`, `/technology` | Feature showcase; technology explainer (mentions TS100, ArduPilot) |
| `/live` | Live airspace: radar, fleet, weather conditions (GO / CAUTION / NO-GO) |
| `/shop`, `/shop/:slug` | 30 products incl. a "Relief & Survival" category, badges, search (`?q=` synced with the navbar) |
| `/cart` | Full cart (Zustand, persisted) plus a cart drawer in the navbar |
| `/checkout` | "Send emergency drone": address, **drop-point picker with a 2D/3D toggle**, safety checks, prescription upload, "Your cover" (plan status), summary showing supplies covered and **You pay ₹0**; sends `groundAltM` |
| `/orders`, `/orders/:id` | Order history with reorder; **live tracking** (map or 3D, phase timeline, "Area clear" button, rating) |
| `/welfare` | Apply for the welfare discount on plans |
| `/profile`, `/login`, `/register` | Account |

Global features:
- SOS emergency button and modal, footer hotline
- Toast notifications (`Toaster.tsx` + `useNotifications.ts`, pushed over sockets)

### 6.3 Operator console (`/ops`, operator role)

| Page | What it does |
|------|--------------|
| Dashboard | KPIs, dark Recharts charts, conditions card, welfare-pending alert |
| Orders | Approve, reject, **Load & dispatch** (pick a drone, hold-to-launch); **FlightPlan panel** shows the exact ArduCopter mission and downloads a **`.waypoints`** file for Mission Planner; weather pre-flight check |
| Monitor | Live telemetry of flights; commands PAUSE / RESUME / RTL |
| Fleet | Drones MDR-01 Aarogya, MDR-02 Sanjeevani, MDR-03 Dhanvantari (maintenance). **Each drone can be switched between "Simulator" and "Radio bridge"** (real ArduPilot). |
| Inventory | Stock and product edits |
| Welfare | Verify or reject subsidy applications |

The sidebar also links to the Mission Control screen.

### 6.4 Mission Control (`/mission-control`, public big screen)

Built for the exhibition TV. Anonymised: no names, phone numbers or medicine names.

It shows:
- the live order feed and a banner when a new order arrives
- a map with the drone flying
- the **ArduPilot mission step by step** (the current item highlighted)
- telemetry
- the engine label: **"Built-in simulator"** or **"ArduPilot · MAVLink"**

It is responsive:
- 3 columns at ≥1536 px (fits 1920×1080 with no scroll)
- 2 columns or stacked on narrower windows, for Mac split-screen

Data comes from `server/src/display.ts` (`/api/display/state`, plus the socket room `display`).

### 6.5 API (all under `/api`)

**Public** (`routes/public.ts`)
- `GET /config`
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /categories`, `GET /products`, `GET /products/:slug`
- `GET /conditions` (weather)
- `GET /public/stats`, `GET /public/fleet`
- `GET /display/state`

**Customer** (`routes/customer.ts`)
- `GET` / `POST /addresses`, `DELETE /addresses/:id`
- `POST /orders/quote`, `POST /orders`, `GET /orders`, `GET /orders/:id`
- `POST /orders/:id/cancel`, `POST /orders/:id/clearance` ("Area clear"), `POST /orders/:id/rate`
- `GET` / `POST` / `DELETE /welfare`
- `GET /subscription` (current plan + plans with this user's price), `POST /subscription {plan}`, `DELETE /subscription`

**Ops** (`routes/ops.ts`, mounted at `/api/ops`)
- `GET /stats`
- `GET /orders`, `GET /orders/:id`, `GET /orders/:id/rx`
- `POST /orders/:id/approve`, `POST /orders/:id/reject`, `POST /orders/:id/dispatch`
- `GET /orders/:id/mission`, `GET /orders/:id/mission.waypoints`
- `GET /drones`, `POST /drones/:id/command`, `PATCH /drones/:id`
- `PATCH /products/:id`
- `GET /welfare`, `POST /welfare/:id/:action`

**Health:** `GET /api/health`

**Socket.IO rooms** (`server/src/realtime.ts`)
- Rooms: `ops`, `order:<id>`, `user:<id>`, `display`
- Telemetry goes to `ops` and `display`.
- Order updates also emit an anonymised `display:order`.

### 6.6 Database (`server/src/db/`)

- **Tables:** users, products (+badge, rx_required), addresses, drones, orders (+ground_alt_m, subsidy, rx_image), order_items, missions, welfare, events.
- **Migrations:** columns are added in place with the `addColumn` helper.
- **Seed:** `seed.ts` creates demo users, 30 products, 3 drones, places inside the 1.3 km zone, and a week of history orders.

---

## 7. Drone integration

### 7.1 The seam (`server/src/drone/`)

- `types.ts`: shared types
  - `MissionPhase`: `preflight, takeoff, cruise, approach, aligning, awaiting_clearance, lowering, releasing, retracting, returning, landing, completed, aborted`
  - `DroneTelemetry`
  - `MissionPlan`
  - `DroneCommand`: `CLEARANCE`, `PAUSE`, `RESUME`, `RTL`
- `DroneAdapter` interface with two implementations:
  - `sim.ts`: **SimDroneAdapter**, the built-in simulator state machine (default, no hardware needed)
  - `bridge.ts`: **BridgeDroneAdapter**, a WebSocket client to the Python bridge, with reconnect
- `manager.ts`: one adapter per drone, `attach(id, kind)`. The Fleet page switches it.
- `mission.ts`: **`buildMission(plan, mode)`** builds the real ArduCopter mission and `toWaypointsFile()` exports QGC WPL 110 for Mission Planner.
- `README.md`: the bridge WebSocket protocol.

When an order is dispatched (`orders.ts` → `dispatchOrder`), the mission is built and sent to the drone's
adapter. Phase reports come back through `handlePhase`:
- `releasing` marks the order delivered.
- `completed` or `aborted` ends the mission.
- If the mission ends without a delivery, the order is marked failed.

### 7.2 The mission (ESP32 payload mode)

| seq | Item | Phase shown |
|-----|------|-------------|
| 0 | Home | |
| 1 | NAV_TAKEOFF 60 m | takeoff |
| 2 | DO_CHANGE_SPEED 12 m/s | |
| 3 | NAV_WAYPOINT, cruise over the target | cruise |
| 4 | NAV_WAYPOINT, descend to 4 m | approach |
| 5 | **NAV_LOITER_UNLIM**: hover until "Area clear" | awaiting_clearance |
| 6 | DO_SET_SERVO **8 → OPEN**: storage box opens | |
| 7 | NAV_LOITER_TIME 2 s (box opening) | lowering |
| 8 | DO_SET_SERVO 9 → **1900** (tell ESP32: drop) | |
| 9 | NAV_LOITER_TIME (lower + release + retract time) | lowering |
| 10 | DO_SET_SERVO 9 → **1500** (idle) | |
| 11 | DO_SET_SERVO **8 → CLOSED**: storage box closes | |
| 12 | NAV_LOITER_TIME 2 s (box closing) | retracting |
| 13 | NAV_WAYPOINT, climb back to 60 m above the drop zone | returning |
| 14 | NAV_RETURN_TO_LAUNCH (bridge sets `RTL_ALT` to cruise height first) | returning |

**Storage box** ([docs/11](docs/11-storage-box-servo.md)): one servo on CrossFlight **output 8** (`SERVO8_FUNCTION = 0`, powered by a separate 5 V BEC). OPEN / CLOSED PWM are placeholders (1900 / 1100) in `config.box` until measured. The bridge closes it before arming, refuses to open it while flying between points, closes it on abort, and reports its real state from `SERVO_OUTPUT_RAW`. Operators can open or close it from **Ops → Live monitor**. Bridge commands now get a `result` reply, so refusals reach the app.

Servo PWM codes to the ESP32: 1900 = drop, 1500 = idle, **1100 = abort** (reel in).
The other mode uses ArduPilot's own DO_WINCH / DO_GRIPPER commands.

Key ArduPilot facts we learned the hard way:
- **MISSION_CURRENT only reports NAV items**, so phases are tied to NAV items, never to DO items.
- **Phases are monotonic**: they never go backwards, which avoids flicker.
- **Upload protocol:** MISSION_CLEAR_ALL → MISSION_COUNT → answer each MISSION_REQUEST_INT with MISSION_ITEM_INT → MISSION_ACK.
- **Launch sequence:** DO_SET_MODE GUIDED (wait for ACK, then confirm through the heartbeat) → arm → NAV_TAKEOFF → mode **AUTO**.
- **"Area clear"** sends MISSION_SET_CURRENT to the item after the loiter (seq 6), so the drone continues.
- **Never return low:** after the drop the mission climbs back to cruise height, and the bridge sets `RTL_ALT` to cruise height before take-off. (Found in SITL on 5 Nov 2026: RTL at the default 15 m flew into ground 15 m above the hub.)
- **Pre-flight terrain check:** the bridge asks ArduPilot for ground height along the route and refuses to launch with less than 20 m clearance at cruise height (skipped with a warning if the FC has no terrain data).
- The bridge sends a **GCS heartbeat at 1 Hz**, so `FS_GCS_ENABLE` failsafe works.

Full research, parameters and Mission Planner workflow are in [`docs/08-ardupilot-auto-missions.md`](docs/08-ardupilot-auto-missions.md).

### 7.3 Python bridge (`drone-bridge/bridge.py`)

- **`Vehicle`**
  - A reader thread with an inbox for MISSION, COMMAND_ACK and AUTOPILOT_VERSION messages
  - `command()`, `set_mode()`, `upload()` (resets the seen sequence to −1), `set_current()`, `set_servo()`, `firmware()`
- **`Flight`**
  - `run()` does the checks, then upload → set_current(1) → GUIDED → arm → takeoff → AUTO.
  - `tick()` maps the current seq to a phase. It also checks the clearance timeout and times the ESP32 release.
  - `abort()` reels the rope in (servo 1100) if it's out, then loiters, sets idle, and RTLs.
- **`Bridge`**: a WebSocket server on :8765 that relays telemetry and sends the GCS heartbeat.

Commands:

```bash
cd drone-bridge
.venv/bin/python bridge.py --check --mavlink tcp:IP:5762   # print firmware, mode, GPS, position
.venv/bin/python bridge.py --mavlink tcp:IP:5762           # run the bridge
# other flags: --baud (SiK serial), --port (WS port), --drone MDR-01, --forward
```

- `MODE_NAMES = mavutil.mode_mapping_acm` maps number → name; `COPTER_MODES` is the reverse.
- With the real drone, `--mavlink` is the SiK serial port, e.g. `/dev/cu.usbserial-XXXX --baud 57600`.

### 7.4 Mock flight controller (`drone-bridge/mock_fc.py`)

A fake ArduCopter for testing the bridge without any simulator:

```bash
.venv/bin/python mock_fc.py                                   # sends to udpout:127.0.0.1:14560
.venv/bin/python bridge.py --mavlink udpin:127.0.0.1:14560
```

Tested: three flights (normal, abort, normal) all passed.

### 7.5 Real ArduPilot SITL (friend's Windows laptop)

The full guide is [`docs/10-sitl-windows-setup.md`](docs/10-sitl-windows-setup.md). In short:

1. Windows: Mission Planner → SIMULATION → Multirotor. Allow it through the firewall (private network). Note the IP from `ipconfig`.
2. Mac: `nc -vz <IP> 5762`, then `bridge.py --check --mavlink tcp:<IP>:5762` and copy the position.
3. `HUB_LAT=… HUB_LON=… npm run seed` and `npm run dev`, so the hub matches SITL's start point.
4. Run `bridge.py --mavlink tcp:<IP>:5762`.
5. In the app: Fleet → MDR-01 → **Radio bridge**.

Mission Planner uses SITL port **5760**; our bridge uses **5762**. Both can watch the same flight.

Plan B: run the bridge on the Windows laptop and set `DRONE_BRIDGE_URL=ws://<IP>:8765` on the Mac.

**Status: not yet tested against real SITL.** Building SITL locally on the Mac was blocked, so the bridge
has only been verified with `mock_fc.py`.

---

## 8. Testing

The full ladder is in [`docs/09-testing-plan.md`](docs/09-testing-plan.md):

1. **App only** with the built-in simulator ✅ done (headless end-to-end plus browser checks; live Mission Control test with order MD-1034: placed → dispatched → area clear → delivered)
2. **Pretend drone** (`mock_fc.py` + bridge) ✅ done
3. **ArduPilot SITL** on Windows ⏳ next
4. **Bench test** with the real flight controller, **props off** ⏳
5. **Winch and gripper** with the ESP32 ⏳ (not built yet)
6. **Real flights** (tethered, then open field, low altitude) ⏳

Team roles and go/no-go checks are in that document.

---

## 9. Exhibition run book

**Setup:** the Mac runs everything. Mission Control goes on the TV. Phones place orders. Until the TV
is there, use **macOS split-screen**: Mission Control on one side, the operator console on the other.

1. Put the Mac and phones on **the same network**. A phone hotspot is most reliable; school Wi-Fi often isolates devices.
2. Run `npm run seed` (fresh data), then `npm run dev`.
3. On the Mac or TV, open `http://localhost:5173/mission-control`.
4. In a second window, log in as **Operator demo** at `http://localhost:5173/ops`.
5. A teammate opens `http://<mac-ip>:5173` on a phone and logs in as **Customer demo**. Get the IP with `ipconfig getifaddr en0` (on the iPhone hotspot it was `172.20.10.2`).
6. Customer: add items → checkout → pick a drop point near the hub → **Emergency** priority (auto-approved) → place the order.
7. Operator: Orders → open it → **Load & dispatch** → MDR-01 → hold to launch.
8. Watch Mission Control. When the drone hovers at 4 m, the customer taps **Area clear** → it lowers, releases and returns.
9. Optional: with SITL connected, Mission Planner on the Windows laptop shows the same flight.

---

## 10. Known issues and gotchas (already fixed unless marked)

| Problem | Cause / fix |
|---------|-------------|
| **Phone can't open the app** ⚠️ OPEN | The macOS firewall had `/opt/homebrew/Cellar/node/26.4.0/bin/node` set to **Block incoming connections**. The owner must change it themselves: System Settings → Network → Firewall → Options → that node → *Allow*, or run `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /opt/homebrew/Cellar/node/26.4.0/bin/node`. Also use the **current** IP with `:5173`. Vite prints the IP from start time, which goes stale if the network changes. An AI agent must not change firewall or security settings. |
| "Port 5173 in use" | A copy of `npm run dev` is already running, sometimes two. Reuse it, or stop it with Ctrl+C. |
| Blank page | `useEffect(() => window.scrollTo(...))` returned a value. Effects need braces. |
| API EADDRINUSE | The preview launcher sets `PORT=5173`, so the server reads `API_PORT`. |
| DB path with spaces | Built with `fileURLToPath`, because the folder name has spaces. |
| Tailwind `@apply` on custom classes | Tailwind v4: use `@utility`. |
| Cesium "image could not be decoded" | The drone icon is drawn on a canvas, not an SVG data URL. |
| Cesium assets 404 in dev | Custom Vite dev middleware serves `/cesium/*` from node_modules; static copy (with stripBase) runs at build time only. |
| Chase camera looked at the sky | Uses `camera.setView` behind the drone, not `lookAt`. |
| Recharts pie invisible | `isAnimationActive={false}` |
| Bridge mode map inverted, phases on DO items, phase flicker, stale seq from the previous mission | All fixed in `bridge.py` (see §7.2) |

---

## 11. Conventions for whoever continues

- **Commit or push only when the owner asks.** They usually say "Commit & push". Push to `main`.
- GitHub auth is through the `gh` CLI (`gh auth login`), already set up on the Mac. **Never use or store
  personal access tokens.** One was pasted into the old chat; the owner was advised to revoke it.
- Don't change system or security settings (firewall etc.). Tell the owner the exact steps instead.
- Keep the code style: TypeScript, small files, few comments, Tailwind utility classes, dark futuristic look.
- The demo passwords are seeded test values; keep them out of production.
- Run `npm run typecheck` before committing.

---

## 12. History (what happened, in order)

1. **Planning:** a full plan for the drone system, hardware, electronics, precision navigation and roadmap (docs 01–05).
2. **Re-scope:** the owner asked for an app-first build for the exhibition (doc 06). We built the shop, cart, checkout, tracking, operator console, simulated drone and the drone adapter seam.
3. **3D drop picker:** referencing SkyFi / Vantor 3DSM. Free 3D now, with a slot for Vantor or Google or ion later. Small demo area (doc 07).
4. **Futuristic redesign:** live airspace page, welfare subsidy, SOS, toasts, product badges.
5. **Features imported** from the owner's reference "DroneSupply" HTML page.
6. **ArduPilot research:** orders become AUTO missions, the Python bridge, `.waypoints` export, the mock flight controller (doc 08).
7. **Explainer deck** for non-experts (artifact link in §0).
8. **Testing plan** (doc 09).
9. **Mission Control** big-screen simulation dashboard, plus the **Windows SITL** guide (doc 10).
10. **Responsive Mission Control** for split-screen and narrow windows.
11. **Phone access troubleshooting:** the root cause was the macOS firewall blocking node (still open).
12. All dev servers were stopped at the end of the old chat.

Git log:
```
4e42f4c Make Mission Control fit split-screen and narrow windows
b9e9f53 Add Mission Control screen and Windows SITL setup guide
dd46d52 Create unitv_stream.py                (owner)
86df853 commit 2                              (owner: testing plan + mock_fc)
40ffde2 Turn app orders into ArduCopter AUTO missions via the drone bridge
eb46292 Futuristic redesign, live airspace, welfare subsidy, SOS and toasts
f61ac6c Fix blank page, API port clash and 3D view in dev
d9c5613 Add MediDrop delivery app, simulated drone, 3D drop picker and plan docs
```

---

## 13. Open tasks / next steps

1. **Phone access:** the owner allows node in the firewall, then tests `http://<mac-ip>:5173` from the phone.
2. **SITL test** on the friend's Windows laptop, following doc 10. This is the first real ArduPilot run.
3. Fill in the deck placeholders (team names, school name).
4. Set `HUB_LAT` / `HUB_LON` to the school or exhibition location.
5. Optional: show the UnitV camera feed (`camera/unitv_stream.py`, :8090) in Mission Control or Track.
6. Later (hardware):
   - ESP32 winch and gripper firmware (`firmware/payload/`)
   - flight controller parameters from doc 08
   - bench test with props off, then real flights
   - rangefinder plus ArUco precision drop
