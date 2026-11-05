# 11. Storage box: opening and closing with one servo (output 8)

The package rides in a storage box under the drone. One servo on **CrossFlight output 8** opens and
closes the box door. It is controlled two ways:

- **Automatically, inside the ArduPilot mission:** the box opens only after the drone is hovering
  over the drop point *and* someone has pressed **Area clear**, and closes before the drone moves
  again. ArduPilot runs these steps itself, so they happen at the right place even if the radio
  link drops at that moment.
- **Manually from the app:** Ops → **Live monitor** → *Storage box* → **Open box / Close box**, for
  loading at the hub.

```
App ──► Node server ──► drone-bridge (Python) ──► SiK radio ──► CrossFlight (ArduPilot) ──► output 8 ──► servo ──► box door
                                                      ◄── SERVO_OUTPUT_RAW: what output 8 really sends (app shows Open / Closed)
```

## Safety rules (enforced by the bridge, the simulator and the app)

| Rule | Why |
|------|-----|
| The box is **forced shut before arming** | Never take off with it open |
| **Open is refused while flying between points** (take-off, cruise, approach, return) | Nothing falls out over people or roads |
| Open is allowed **on the ground** (loading) or **hovering over the drop point** | The only two places it makes sense |
| On **abort**, the box closes before the drone heads home | |
| The app shows the state **read back from the flight controller**, not just what was asked | If the servo signal never changes, you see it |

## The mission around the drop (ESP32 mode)

| # | Item | What happens |
|---|------|--------------|
| 5 | `NAV_LOITER_UNLIM` | Hover at 4 m, **wait for Area clear** |
| 6 | `DO_SET_SERVO 8 → OPEN` | **Box opens** |
| 7 | `NAV_LOITER_TIME 2 s` | Hold still while it opens |
| 8–10 | ESP32 winch: lower → release → reel in | Package goes down on the rope |
| 11 | `DO_SET_SERVO 8 → CLOSED` | **Box closes** |
| 12 | `NAV_LOITER_TIME 2 s` | Hold still while it closes |
| 13–14 | Climb to 60 m, return home | |

Full table: [doc 08](08-ardupilot-auto-missions.md).

## Settings

In `server/src/config.ts` → `box` (or environment variables):

| Setting | Default | Env var |
|---------|---------|---------|
| Output number | 8 | `BOX_SERVO` |
| OPEN signal | **1900 µs (placeholder)** | `BOX_PWM_OPEN` |
| CLOSED signal | **1100 µs (placeholder)** | `BOX_PWM_CLOSE` |
| Time to open or close | 2 s | |

Replace the placeholders with the values measured in step 4 below.

---

## Hardware and flight-controller setup (team checklist)

### 1. First connection (USB, Windows + Mission Planner)
1. **Props off.** CrossFlight → USB → Windows laptop. Mission Planner → COM port, **115200** → **CONNECT**.
2. Note the firmware shown at the top (e.g. *ArduCopter V4.x*). If normal Mission Planner can't
   connect, use RadioLink's Mission Planner build.
3. If never done: **SETUP → Mandatory Hardware**: Frame (Quad X), Accel, Compass, Radio, ESC
   calibration, Flight modes, Failsafe → RTL.

### 2. Telemetry radios
1. Air radio → **TELEM1** (radio TX → FC RX, radio RX → FC TX).
2. Parameters: `SERIAL1_PROTOCOL = 2`, `SERIAL1_BAUD = 57` → **Write Params**.
3. Battery on, ground radio → USB. Both LEDs **solid green** = linked.
4. On the Mac: `ls /dev/cu.usbserial*`, then
   `drone-bridge/.venv/bin/python drone-bridge/bridge.py --check --mavlink /dev/cu.usbserial-XXXX --baud 57600`

### 3. Servo wiring and output 8
1. Servo signal → **output 8** signal pin. Power the servo from a **separate 5 V BEC**
   (a servo powered from the FC can brown it out). **Shared ground.** Outputs 1–4 are the motors.
2. Parameters: `SERVO8_FUNCTION = 0` (lets `DO_SET_SERVO` drive it), `SERVO8_MIN = 1000`,
   `SERVO8_MAX = 2000`, `SERVO8_TRIM = <CLOSED value>` → **Write Params** → reboot.

### 4. Find OPEN and CLOSED
Mission Planner → **DATA → Servo/Relay** tab, row **8**: try 1100, 1500, 1900 and fine-tune until
the door is **firmly latched** (CLOSED) and **fully open** (OPEN). Write both numbers down.

### 5. Testing ladder
1. Built-in simulator: box shows open/closed in the app ✅ (tested)
2. Pretend flight controller (`mock_fc.py`) through the real bridge ✅ (tested: output 8 gets OPEN
   after Area clear, CLOSED before leaving; opening while cruising is refused)
3. **SITL:** fly an order, watch Mission Planner **DATA → Status → `ch8out`** change at the drop
   (set `SERVO8_FUNCTION = 0` in SITL too)
4. **Real drone, props off, over telemetry:** Live monitor → Open box / Close box; then dispatch an
   order and step through it
5. Real flight with an empty box, then with a light package
