# 4. Precision Navigation

Goal: **put the package within about 20–30 cm of the marker**. GPS alone is only good to about 2–3 m, so we
stack three layers, each one handing over to a more precise one as the drone gets closer.

| Layer | Sensor | Accuracy | Used during |
|-------|--------|----------|-------------|
| 1. Global | GPS + compass (EKF) | ~2–3 m horizontal | Takeoff → cruise → arrive over the drop zone |
| 2. Height | **TF-Luna rangefinder** (downward) | ~±2–6 cm, 0.2–8 m | Descent to drop height, rope length, terrain-relative altitude |
| 3. Local | **Downward camera + ArUco marker** | ~±10–30 cm | Final alignment and holding position while lowering |

## 4.1 How the camera layer works

1. The recipient places a printed **ArUco marker** (dictionary `DICT_4X4_50`, about 40–60 cm square,
   matte paper, weighted down) at the drop spot. Each drop zone gets its own marker ID, so
   the drone can confirm it's at the *right* place.
2. The Pi camera looks straight down. OpenCV detects the marker and its centre pixel.
3. Using the camera's calibration (focal length, from a one-time checkerboard calibration), the pixel offset is
   converted into **angles** (`angle_x`, `angle_y`) and distance (from the rangefinder).
4. The Pi sends a MAVLink **`LANDING_TARGET`** message 10–20 times per second.
5. ArduPilot's **precision loiter** (`PLND_*` parameters) uses those messages to move the drone
   so the marker sits directly underneath, while correcting for wind drift.
6. The mission agent starts lowering only when the error stays < 20 cm for 3 s, and keeps
   precision loiter running *during* the lowering.

**Fallback:** if precision loiter gives us trouble, the Pi can do its own correction loop in
GUIDED mode by sending small velocity commands (`SET_POSITION_TARGET_LOCAL_NED`) proportional
to the marker offset. It's the same detection code, a different way to steer.

**If no marker is found within 60 s:** hold position and alert the operator, who can
(a) drop on GPS alone (only if the area is confirmed wide and clear), (b) retry, or (c) RTL.

## 4.2 Drop height & rope swing

- **Drop height ≈ 4–5 m** above ground: high enough that the prop wash at the ground is gentle
  and people/objects stay far from the props, low enough that the marker is easy to see and the rope stays short.
- **Rope payout ≤ 5 m.** Lower at about 0.2 m/s and slow to 0.1 m/s for the last 0.5 m.
- **Swing control:** slow payout, the drone holding a steady hover, and a gripper weight that's compact and
  low-drag. Don't move horizontally while the rope is out.

## 4.3 ArduPilot configuration checklist (verify names/values against our firmware version)

| Area | Parameters (examples) | Purpose |
|------|----------------------|---------|
| Telemetry port | `SERIALx_PROTOCOL = 2` (MAVLink2), `SERIALx_BAUD = 57` | SiK radio |
| Companion port | `SERIALy_PROTOCOL = 2`, `SERIALy_BAUD = 921` | Raspberry Pi |
| Rangefinder | `RNGFND1_TYPE` (Benewake serial/I2C per docs), `RNGFND1_MIN/MAX`, `RNGFND1_ORIENT = 25` (down) | Height above ground |
| Precision | `PLND_ENABLED = 1`, `PLND_TYPE = 1` (MAVLink), an RC switch `RCz_OPTION = 39` (precision loiter) | Marker-based positioning |
| Geofence | `FENCE_ENABLE = 1`, `FENCE_RADIUS`, `FENCE_ALT_MAX`, `FENCE_ACTION = RTL` | Stay in the test area |
| Failsafes | `FS_THR_ENABLE` (RC loss → RTL), `FS_GCS_ENABLE`, `BATT_FS_LOW_ACT = RTL`, `BATT_FS_CRT_ACT = Land`, `BATT_LOW_VOLT` | Safety |
| Payload backup | `SERVOn_FUNCTION = RCINm` (pass a transmitter switch to the ESP32 PWM input) | Manual winch control |
| RTL | `RTL_ALT` above the tallest obstacle on the route | Safe return |

`x`, `y`, `z`, `n`, `m` depend on the CrossFlight's port mapping. We'll fill them in after
checking the board's pinout in Mission Planner.

## 4.4 Upgrade path (stretch)

- **RTK GPS** (e.g., u-blox F9P base + rover) gives about 2 cm accuracy without a marker, but it's expensive.
- **Optical flow sensor** gives better holding in low/no-GPS situations.
- **IR beacon (IR-LOCK)** works in low light and is a drop-in alternative to the camera marker.
