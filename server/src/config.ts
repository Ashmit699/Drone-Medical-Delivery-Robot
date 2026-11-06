import { fileURLToPath } from 'node:url';

// Central settings. Change HUB to your school / base-station location before the exhibition.
export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'medidrop-dev-secret-change-me',
  dbPath: process.env.DB_PATH ?? fileURLToPath(new URL('../data/medidrop.db', import.meta.url)),

  hub: {
    name: 'Aerolift Hub · Indirapuram',
    lat: Number(process.env.HUB_LAT ?? 28.645189),
    lon: Number(process.env.HUB_LON ?? 77.381497),
  },
  // Small exhibition demo zone: a 1.3 km radius circle (~5.3 km²) inside a 2.4 × 2.4 km square
  // (~5.8 km²). The square is what you'd draw on SkyFi to buy a Vantor 3D model of the area.
  serviceRadiusKm: Number(process.env.SERVICE_RADIUS_KM ?? 1.3),
  demoAreaHalfSideKm: 1.2,

  // Must match what the real drone + gripper can lift (see docs/02-hardware-electronics.md).
  maxPayloadG: 300,
  // Aerolift is emergency-only: no payment per order. Members pay a monthly plan (like insurance)
  // and every emergency delivery, supplies included, is free for them. See subscription.ts.
  // Rough battery model for the quote: ~10 min of usable flight on a 4S pack with payload.
  usableFlightS: 600,

  flight: {
    // 60 m clears Indirapuram's 40–60 m residential towers with margin (India's green-zone limit is 120 m).
    // The return leg also flies at this height (see drone/mission.ts and RTL_ALT in the bridge).
    cruiseAltM: 60,
    dropAltM: 4,
    // Every flight is an emergency, so the drone flies at its top safe cruise speed
    // (ArduCopter WPNAV_SPEED 1500 cm/s; an S500 with 920KV motors tops out around 15–17 m/s).
    cruiseSpeedMs: 15,
  },

  // Real-drone mission settings (see docs/08-ardupilot-auto-missions.md).
  mission: {
    payloadMode: (process.env.PAYLOAD_MODE === 'ardupilot-winch' ? 'ardupilot-winch' : 'esp32') as 'esp32' | 'ardupilot-winch',
    triggerServo: 9, // FC output wired to the ESP32's PWM input
    pwmDrop: 1900, // ESP32: run lower → release → retract
    pwmIdle: 1500,
    pwmAbort: 1100, // ESP32: stop and reel the rope in now
    lowerRateMs: 0.25,
    retractRateMs: 0.35,
    clearanceTimeoutS: 180, // no "area clear" in this time → bridge sends the drone home
  },

  // Storage box door: one servo on CrossFlight output 8, driven by DO_SET_SERVO (needs SERVO8_FUNCTION = 0).
  // CLOSED 1450 / OPEN 2000 µs, set on the real box door in Mission Planner (docs/11-storage-box-servo.md).
  box: {
    servo: Number(process.env.BOX_SERVO ?? 8),
    pwmOpen: Number(process.env.BOX_PWM_OPEN ?? 2000),
    pwmClose: Number(process.env.BOX_PWM_CLOSE ?? 1450),
    moveS: 2, // time the door needs to open or close fully; the drone holds still meanwhile
  },

  // Simulator time multiplier: 1 = real time, 4 = four times faster (good for demos).
  simSpeed: Number(process.env.SIM_SPEED ?? 4),

  // Where the Python pymavlink bridge listens (drone-bridge/bridge.py).
  droneBridgeUrl: process.env.DRONE_BRIDGE_URL ?? 'ws://127.0.0.1:8765',
};

export type Priority = 'standard' | 'express' | 'emergency';
export const PRIORITIES: Priority[] = ['standard', 'express', 'emergency'];
