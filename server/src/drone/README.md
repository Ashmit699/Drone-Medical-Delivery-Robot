# Drone integration seam

The app backend never talks MAVLink directly. Every drone is a `DroneAdapter` (see `types.ts`):

| Adapter | File | Used for |
|---------|------|----------|
| `sim` | `sim.ts` | Software drone that follows the real mission phases (default for every drone) |
| `bridge` | `bridge.ts` | The **real** drone, via `drone-bridge/bridge.py` (Python + pymavlink) |

Switch a drone between them in **Ops → Fleet** (or `PATCH /api/ops/drones/:id {"adapter":"bridge"}`).
Nothing else in the app changes.

## Bridge protocol (WebSocket, JSON text frames)

The mission items are built by `mission.ts` (the same ones the operator can download as a
Mission Planner `.waypoints` file). The bridge uploads them with the MAVLink mission protocol.
See [docs/08-ardupilot-auto-missions.md](../../../docs/08-ardupilot-auto-missions.md).

The backend connects to `DRONE_BRIDGE_URL` (default `ws://127.0.0.1:8765?drone=<id>`).

### Backend → bridge

```jsonc
// box: storage box servo settings from config.ts (output, OPEN / CLOSED PWM, seconds to move)
{ "type": "hello", "droneId": "MDR-01", "box": { "servo": 8, "pwmOpen": 2000, "pwmClose": 1450, "moveS": 2 } }
{ "type": "start_mission", "plan": {
    "missionId": 12, "orderId": 1042,
    "home":   { "lat": 28.645189, "lon": 77.381497 },
    "target": { "lat": 28.6220, "lon": 77.2150 },
    "cruiseAltM": 60, "dropAltM": 4,
    "mission": { "items": [ /* ArduCopter mission items, see mission.ts */ ], "clearanceSeq": 5, "afterClearanceSeq": 6, ... } } }
// id: the bridge answers every command with a "result" carrying the same id
{ "type": "command", "id": 7, "command": { "type": "CLEARANCE" | "PAUSE" | "RESUME" | "RTL" | "BOX_OPEN" | "BOX_CLOSE" } }
```

### Bridge → backend

```jsonc
// 2–5 Hz. Any subset of DroneTelemetry fields (types.ts); missing fields keep their last value.
{ "type": "telemetry", "telemetry": {
    "armed": true, "mode": "AUTO", "position": { "lat": 28.6465, "lon": 77.3825 },
    "altM": 24.8, "groundSpeedMs": 11.6, "headingDeg": 34, "batteryPct": 81, "batteryV": 15.9,
    "gpsSats": 14, "missionId": 12, "markerErrorCm": null,
    // box: read back from the PWM the FC really outputs (SERVO_OUTPUT_RAW); "unknown" = no signal yet
    "payload": { "box": "closed", "gripper": "closed", "winch": "homed", "ropeM": 0, "loaded": true } } }

// Answer to a command. ok=false carries the reason (e.g. box opening refused while cruising).
{ "type": "result", "id": 7, "ok": false, "error": "The box can only open on the ground or while hovering over the drop point" }

// Whenever the mission phase changes (names in types.ts → MissionPhase).
{ "type": "phase", "missionId": 12, "phase": "awaiting_clearance", "message": "Holding 4 m above the marker" }

{ "type": "error", "message": "Mission upload failed: ..." }
```

**Important phases for the app:** `releasing` marks the order *delivered*; `completed` / `aborted`
end the mission and free the drone (an order not yet delivered becomes *failed*).
