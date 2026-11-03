# 2. Hardware & Electronics

## 2.1 What we already have

| Part | What it does | Notes / to confirm |
|------|--------------|--------------------|
| **Radiolink CrossFlight v1.1** | Flight controller | Runs ArduPilot-based firmware and is configured with Mission Planner. **Confirm** the firmware version and which serial ports (TELEM1/TELEM2/GPS/etc.) are free. We need 3 UARTs: SiK radio, Raspberry Pi, rangefinder (or put the rangefinder on I2C). |
| **Radiolink PS100** | ? | **Confirm what this is.** If it is *not* a GPS + compass module, we must buy one (Radiolink TS100 or any u-blox M8N/M10 GPS+compass). GPS is mandatory for autonomous flight. |
| **4× Readytosky 40A ESC** | Motor speed control | Check they're BLHeli_S/32 and 2–4S rated. Calibrate all four together. |
| **4× Readytosky RS2312 920KV** (listed as "2313") | Motors | Designed for 3S–4S with 9–10" props. Roughly 0.8–1 kg thrust each on 4S with 1045 props, so about 3.2–4 kg total. |
| **CrossFlight power distribution board** | Splits battery power to the ESCs, gives voltage/current to the FC | We'll also tap accessory power (BECs) from here. |
| **SiK telemetry module (from SimplyFly)** | Long-range MAVLink radio, 2 units (air + ground) | Confirm the frequency (433 MHz is the right choice for India). Range is about 300 m–1 km+ with stock antennas. |

### Not listed, but required (confirm whether you have them)

- **Frame:** probably F450/S500 class for these motors. Note the motor-to-motor size.
- **Propellers:** 1045 (10×4.5) recommended, plus spares.
- **Battery:** 4S LiPo, 3300–5000 mAh, with an XT60 connector.
- **RC transmitter + receiver:** for example Radiolink AT9S / T8FB. **Mandatory**, because a safety pilot must be able to take over on every flight.
- **LiPo balance charger**.

## 2.2 Parts to add

Prices are rough Indian market ranges for budgeting only. Check them before ordering.

### Companion computer & sensors

| Part | Recommended | Why | Approx. ₹ |
|------|-------------|-----|-----------|
| Companion computer | **Raspberry Pi 4 (2 GB)** *(or Pi Zero 2 W if weight is tight: 11 g vs 46 g)* | Runs vision + mission agent; has USB ports for the ESP32 and an optional 4G dongle | 4,500–5,500 (Zero 2 W: 1,800–2,200) |
| microSD | 32 GB, A1/A2 class | OS + logs | 400–600 |
| Camera | Raspberry Pi Camera Module 3 (or v2); wide-angle preferred | Sees the ArUco marker from 3–8 m | 2,000–3,000 |
| Downward rangefinder | **Benewake TF-Luna** (0.2–8 m) | True height above ground, for precise descent and rope length | 1,800–2,500 |
| GPS + compass *(only if PS100 isn't one)* | Radiolink TS100 / u-blox M8N or M10 module | Navigation | 1,500–3,000 |

### Payload system (winch + gripper)

| Part | Recommended | Why | Approx. ₹ |
|------|-------------|-----|-----------|
| Payload MCU | **ESP32 DevKit V1** (or ESP32-S3 mini) | Real-time I/O, interrupts for the encoder, cheap, Arduino-friendly | 350–600 |
| Winch motor | **N20 or JGY-370 *worm-gear* DC motor with Hall encoder**, about 60–100 RPM, 6 V or 12 V | Worm gear is **self-locking**: the rope can't unspool when power is cut. The encoder gives rope length. | 500–1,200 |
| Motor driver | **DRV8833** or **TB6612FNG** (N20); **BTS7960** / DRV8871 (JGY-370) | Direction + PWM speed control | 150–400 |
| Gripper servo | **MG90S** (light box) or **MG996R** (heavier box), metal gear | Opens/closes the two hooks | 200–450 |
| Top limit switch | Microswitch with lever | Knows when the rope is fully retracted ("home") | 20–50 |
| Slack sensor | 2nd microswitch on a spring-loaded idler pulley **or** HX711 + 1 kg load cell | Detects "box is on the ground" | 50 / 350 |
| Current sensor *(optional)* | INA219 | Stall/tangle detection | 150–250 |
| Rope | Braided Dyneema/PE fishing line, 50–100 lb, 5–6 m | Strong, thin, low stretch, light | 200–500 |
| Spool + mounts + gripper body | 3D printed **PETG** (stronger and more heat-resistant than PLA) | Custom fit to the frame | filament ~800 |

### Power & wiring

| Part | Spec | Why |
|------|------|-----|
| **UBEC #1 (logic)** | 5 V / 3 A | Pi + camera + ESP32 (through USB). Keeps servo/motor noise away from the Pi. |
| **UBEC #2 (actuators)** | 5–6 V / 3 A (or a 12 V buck if the winch motor is 12 V) | Gripper servo + winch motor driver |
| Inline fuse | 5 A blade fuse on the accessory branch | A payload short can't take down flight power |
| Connectors | XT60, JST-GH / JST-XH, Dupont, 2-pin JST for power | Removable modules |
| Wire | 12–14 AWG battery, 16 AWG ESC, 22 AWG BEC out, 26–28 AWG signals | Current capacity |
| Misc | Heat shrink, zip ties, nylon M3 standoffs, Velcro battery strap, double-sided foam, blue thread-locker | |
| 433 MHz rule | — | Mount the SiK antenna vertically and away from the GPS mast |

## 2.3 Weight & thrust budget (estimates; weigh the real parts!)

| Group | Est. grams |
|-------|-----------|
| Frame (F450-class) | 280 |
| 4 motors + 4 ESCs + props | 360 |
| FC + GPS mast + PDB + telemetry + RX | 120 |
| 4S 3300 mAh LiPo | 350 |
| **Base drone subtotal** | **~1,110** |
| Pi 4 + camera + TF-Luna + BECs + wiring | 120 |
| Winch (motor + spool + mount) + gripper + ESP32 | 150 |
| **Empty delivery drone** | **~1,380** |
| Medical payload (box + contents) | 200–350 |
| **All-up weight (AUW)** | **~1,600–1,730** |

**Target: thrust-to-weight ≥ 2:1.** About 3.4 kg of thrust divided by about 1.7 kg AUW gives roughly 2:1, which is OK but tight.

- Keep the **maximum payload at 300 g** for v1. The app enforces this, since every item in the catalogue has a weight.
- Expect roughly **8–12 min flight time** with payload on 4S 3300 mAh. Plan routes at **≤ 50 % battery** for the outbound leg.
- Hover current is visible in Mission Planner after the first flights. Use the real number to re-plan.

## 2.4 Payload mechanism design

```
          ┌──────────── drone frame (bottom plate) ────────────┐
          │   [ESP32] [driver]   ┌──────────────┐               │
          │                      │  WORM-GEAR   │──encoder──→ESP32
          │                      │  MOTOR+SPOOL │               │
          │                      └──────┬───────┘               │
          │        [top limit switch]◄──┤ (rope passes a guide) │
          │        [slack switch on sprung idler]               │
          └─────────────────────────────┼───────────────────────┘
                                        │ Dyneema rope (≤ 5 m)
                                        │
                                   ┌────┴────┐  ← gripper body (printed)
                                   │  SERVO  │    with a cone on top so it
                                   └─┬─────┬─┘    self-centres into a funnel
                                    ╭┘     └╮     when retracted
                                    ╰╮ ╭─╮ ╭╯ ← two hooks through the
                                     └─┤ ├─┘    box's ring handle
                                       │█│
                                  ┌────┴─┴────┐
                                  │ MED BOX   │ ≤ 300 g, ring handle on top
                                  └───────────┘
```

Key design points:

1. **Spool size.** A 40–50 mm spool at 60–100 RPM lowers the box at about 0.15–0.25 m/s, so a 4 m drop takes about 20 s. Slow is good: less swinging.
   Holding torque needed is about 0.35 kg × 9.81 × 0.02 m ≈ 0.07 N·m, which worm-gear motors handle easily.
2. **Rope length from the encoder.** `length = pulses / pulses_per_rev × π × spool_diameter`. Calibrate by lowering exactly 1 m and counting pulses, because rope stacking changes the effective diameter.
3. **Home = limit switch.** On power-up the ESP32 reels in slowly until the switch clicks, then zeroes the encoder.
4. **Ground detection (two-stage):** (a) the rangefinder gives the drone's height H, so the ESP32 lowers at normal speed to H − 0.5 m and then slows down; (b) the slack switch releases when the box's weight comes off the rope, which means the box is down.
5. **Hooks must fail-safe *closed*.** Shape the hooks (or use an over-centre linkage) so the box can't slip out even if the servo loses power. The servo only has to *open* them.
6. **Cone + funnel** on retract, so the gripper docks in the same orientation every time and doesn't swing in flight.
7. **v1 pickup is manual at the base** (the operator hangs the box on the hooks). Autonomous pickup from the ground is a stretch goal, made possible by the same marker + winch.

## 2.5 Wiring

```
4S LiPo ──XT60──► CrossFlight PDB ──► ESC1..4 ──► Motors 1..4
                     │   │
                     │   └─(V/I sense)──► FC POWER port
                     │
                     ├─[5 A fuse]─► UBEC#1 5V/3A ──► Pi 5V (GPIO pin 2/4 or USB-C) ─USB─► ESP32
                     │
                     └─[5 A fuse]─► UBEC#2 5–6V/3A ──► Gripper servo V+
                                                   └─► Motor driver VM

FC  M1..M4 ─────────────► ESC signals
FC  TELEM1 (TX,RX,GND) ─► SiK radio (air)             — 5V from FC telem port
FC  TELEM2 (TX,RX,GND) ─► Pi GPIO14 RX / GPIO15 TX     — 3.3V both sides, DON'T connect 5V
FC  GPS port ───────────► GPS + compass
FC  I2C or spare UART ──► TF-Luna rangefinder (pointing straight down)
FC  RCIN ───────────────► RC receiver (SBUS/PPM)
FC  AUX/servo out ──────► ESP32 GPIO (backup trigger, PWM 3.3V)

ESP32 GPIO ─► driver IN1/IN2 (PWM)      ESP32 GPIO ◄─ encoder A/B (interrupt pins)
ESP32 GPIO ─► servo signal               ESP32 GPIO ◄─ limit switch, slack switch (INPUT_PULLUP)
ESP32 I2C  ◄► INA219 (optional)

Pi CSI ribbon ◄─ camera (downward)

*** ALL GROUNDS COMMON: FC, Pi, ESP32, both UBECs, driver, servo ***
```

Initial pin allocation (ESP32 DevKit V1). These avoid strapping pins and input-only pins for outputs.

| Function | GPIO |
|----------|------|
| Motor IN1 / IN2 (PWM) | 25 / 26 |
| Encoder A / B | 34 / 35 (input-only, add external 10 k pull-ups) |
| Gripper servo | 27 |
| Top limit switch | 32 |
| Slack switch | 33 |
| FC PWM trigger in | 14 |
| I2C SDA / SCL (INA219/HX711) | 21 / 22 |

Wiring rules:

- **First power-up always through a smoke stopper** (or a bench supply with a current limit), props OFF.
- Mount the FC on vibration dampers and point its arrow forward. Put the GPS on a mast **away from the PDB/ESC power wires** (compass interference).
- Twist power wire pairs. Route signal wires away from the battery leads.
- Mount everything so a single strap or connector frees it. Use connectors, not solder joints, for anything you'll remove.

## 2.6 Tools we need

**Electronics:** temperature-controlled soldering iron (60 W+), solder + flux, desoldering wick,
**multimeter (essential)**, wire strippers, crimping tool (JST/Dupont), heat gun, smoke stopper,
USB-to-TTL adapter (CP2102/CH340) for debugging UARTs, bench power supply (nice to have).

**Mechanical:** hex driver set, calipers, 3D printer access (PETG), prop balancer, small files,
hot glue, thread-locker.

**Battery safety:** balance charger, **LiPo-safe bag**, voltage checker/buzzer, a metal box or
sand bucket for storage and charging. Never charge unattended.

**Software tools:** Mission Planner (setup/calibration) and QGroundControl, VS Code, PlatformIO,
Python 3.11, Node 20, Git/GitHub, ArduPilot SITL (via WSL/Linux/macOS), Onshape or Fusion 360
(free education licences) for CAD, Figma for UI design.
