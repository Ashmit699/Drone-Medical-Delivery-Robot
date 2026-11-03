# 6. App Plan (exhibition build)

**Goal for the exhibition (5 days, 3 people):** a polished, working delivery app (shop → cart →
checkout → live tracking → delivered) plus an operator dashboard. The drone is
**simulated** behind a clean interface. That interface is the "socket" where the real drone plugs in
later, and it's what we show guests when we explain the integration.

## 6.1 Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **React 19 + TypeScript + Vite** | Fast dev server, huge ecosystem, the team learns one thing |
| Styling | **Tailwind CSS v4** + lucide-react icons | Good-looking UI quickly, consistent design tokens |
| Routing / state | React Router · **Zustand** (cart + auth, saved in localStorage) | Simple, no boilerplate |
| Maps | **Leaflet + react-leaflet** with OpenStreetMap tiles | Free, no API key |
| Charts | Recharts | Dashboard KPIs |
| Realtime | **Socket.IO** | Live drone position / order status pushed to the browser |
| Backend | **Node.js + Express + TypeScript** (run with `tsx`) | Same language as the frontend, so shared types and one `npm run dev` |
| Database | **SQLite via Node's built-in `node:sqlite`** | Zero setup, a single file, nothing native to compile |
| Auth | JWT + bcrypt, roles `customer` / `operator` | Simple and real enough |
| Validation | zod | Safe API input |
| Drone link | `DroneAdapter` interface → `SimDroneAdapter` (now) / `BridgeDroneAdapter` (later, talks to a Python **pymavlink** bridge over WebSocket) | The app never knows whether the drone is real or simulated |

Why not Python for the app backend? Python is still the right tool for MAVLink, so it lives in
the small **drone bridge** (`drone-bridge/`). The app backend stays in TypeScript, which is faster to
build a web app in, and the two talk over a tiny WebSocket JSON protocol.

## 6.2 Pages

**Public:** Home (hero, how it works, impact stats, CTA) · Features · Technology (how the drone,
winch and precision drop work, plus the integration diagram, for exhibition guests) · Login / Register.

**Customer:** Shop (categories, search, filters) · Product detail · Cart (payload meter,
fee by priority) · Checkout (address on a map, priority, drop-zone safety checklist,
prescription upload for Rx items, payment method, review) · My orders · **Live tracking**
(map, drone, phase timeline, ETA, battery/altitude, *Area clear* button, rating) · Profile and addresses.

**Operator (`/ops`):** Dashboard (KPIs, charts, live fleet) · Orders (approve/reject, view
prescription, pre-flight checklist → dispatch) · Live flight monitor (map + HUD + payload
panel + Pause/Resume/RTL/Abort) · Fleet · Inventory (stock and price).

## 6.3 Domain rules

- **Max payload 300 g per flight.** The cart shows a live meter, and the server rejects heavier orders.
- **Service radius** around the hub (configurable). Checkout blocks addresses outside it.
- **Priority & fee:** Standard ₹49 · Express ₹99 · **Emergency free** and jumps the queue.
- **Rx items** need a prescription photo, which the operator checks before approving.
- Order status: `placed → approved → in_flight → delivered` (or `rejected` / `cancelled` / `failed`).
  The detailed **mission phase** comes from the drone:
  `preflight → takeoff → cruise → approach → aligning → awaiting_clearance → lowering →
  releasing → retracting → returning → landing → completed` (or `aborted`).
- **Human safety gate:** the drone waits at `awaiting_clearance` until the customer (or operator)
  holds the *Area clear* button.

## 6.4 Drone integration seam

```
            app backend (Node)                               drone side
┌─────────────────────────────────────────┐
│ orders ─► MissionService ─► DroneAdapter │
│                               ▲    ▲     │
│                 SimDroneAdapter    BridgeDroneAdapter ──WebSocket JSON──► drone-bridge (Python,
└─────────────────────────────────────────┘                                  pymavlink) ──SiK radio──► CrossFlight FC
```

Each drone in the `drones` table has `adapter = 'sim' | 'bridge'`. To fly the real drone later we
**only** need to finish `drone-bridge/bridge.py` and set that drone's adapter to `bridge`. No
app or UI changes are needed. The message protocol is documented in
[`server/src/drone/README.md`](../server/src/drone/README.md).

## 6.5 Five-day build plan (3 people)

| Day | Person 1 (frontend: customer) | Person 2 (frontend: operator) | Person 3 (backend + drone seam + exhibition) |
|-----|-------------------------------|-------------------------------|----------------------------------------------|
| 1 | Run the app, learn the code, restyle branding | Same | Set the hub location, seed real products and prices |
| 2 | Polish shop/cart/checkout, add product images | Polish dashboard and charts | Payload prototype bench demo (ESP32 + winch on a desk) |
| 3 | Tracking page polish, mobile testing | Live monitor polish | Explanation poster/slides from docs 01–04 |
| 4 | Full rehearsal with 3 phones + laptop | Bug fixes | Record a backup demo video |
| 5 | **Exhibition** | | |

## 6.6 Running it

```bash
npm install
npm run dev        # server on :4000, app on :5173 (also on your LAN IP, so guests' phones can join)
```

The demo accounts are created by the seed script (see `server/src/db/seed.ts`) and appear as
one-click buttons on the login page.
