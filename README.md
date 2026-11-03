# MediDrop — Drone Medical Delivery Robot

A quadcopter that flies medical supplies to a requested location, **hovers precisely over a
marked drop zone, and lowers the package on a winch-driven rope with a 2-hook servo gripper**
(it never lands at the destination). A web/mobile app lets a clinic request a delivery and lets
the base-station operator approve, launch, monitor and abort it.

## Plan documents

| # | Document | What's inside |
|---|----------|---------------|
| 1 | [System architecture](docs/01-system-architecture.md) | The big picture: every component, how they talk, mission flow, who decides what |
| 2 | [Hardware & electronics](docs/02-hardware-electronics.md) | Existing drone kit, parts to buy, weight/power budget, wiring, payload winch + gripper design, tools |
| 3 | [Software & app](docs/03-software-app.md) | Tech stack, UI/UX screens, backend, onboard (Raspberry Pi) code, ESP32 firmware, protocols |
| 4 | [Precision navigation](docs/04-precision-navigation.md) | GPS → rangefinder → camera + ArUco marker; how we get ±20 cm drops |
| 5 | [Build roadmap](docs/05-build-roadmap.md) | Phases, week-by-week plan, team roles, test & safety plan, open questions |
| 6 | [App plan](docs/06-app-plan.md) | Exhibition app: tech stack, pages, domain rules, drone integration seam, 5-day plan |
| 7 | [3D map plan](docs/07-3d-map-plan.md) | Next step: 3D drop picker, route preview, live cost (SkyFi/Vantor reference) |
| 8 | [ArduPilot auto-missions](docs/08-ardupilot-auto-missions.md) | How app orders become ArduCopter AUTO missions: MAVLink vs Mission Planner, bridge, parameters, testing |

## Run the app

Needs Node 22.5+ (uses the built-in `node:sqlite`).

```bash
npm install
npm run dev
```

- App: http://localhost:5173 (also printed with your LAN IP, so phones on the same Wi-Fi can join)
- API: http://localhost:4000. The database is created and seeded on first start; `npm run seed` resets it.
- The login page has one-click **Customer demo** and **Operator demo** buttons.
- Drones are simulated (`SIM_SPEED=4` by default, i.e. 4× real time). Set `HUB_LAT` / `HUB_LON` to your school's location.
- The real-drone bridge skeleton is in `drone-bridge/bridge.py`; the protocol is in `server/src/drone/README.md`.

## Repo layout

```
app/                  React + TypeScript + Vite web app: customer shop/tracking + operator console
server/               Node + Express + SQLite API, realtime socket, drone adapters (sim + bridge)
drone-bridge/         Python + pymavlink bridge to the real flight controller (skeleton)
onboard/              (later) Raspberry Pi companion code: mission agent, vision, payload bridge
firmware/payload/     (later) ESP32 firmware for the winch + gripper (PlatformIO)
hardware/             (later) Wiring diagrams, BOM, CAD/STL for winch & gripper mounts
docs/                 Plan documents
```
