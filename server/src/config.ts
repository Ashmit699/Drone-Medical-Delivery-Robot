import { fileURLToPath } from 'node:url';

// Central settings. Change HUB to your school / base-station location before the exhibition.
export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'medidrop-dev-secret-change-me',
  dbPath: process.env.DB_PATH ?? fileURLToPath(new URL('../data/medidrop.db', import.meta.url)),

  hub: {
    name: 'MediDrop Hub · City Hospital',
    lat: Number(process.env.HUB_LAT ?? 28.6139),
    lon: Number(process.env.HUB_LON ?? 77.209),
  },
  // Small exhibition demo zone: a 1.3 km radius circle (~5.3 km²) inside a 2.4 × 2.4 km square
  // (~5.8 km²). The square is what you'd draw on SkyFi to buy a Vantor 3D model of the area.
  serviceRadiusKm: Number(process.env.SERVICE_RADIUS_KM ?? 1.3),
  demoAreaHalfSideKm: 1.2,

  // Must match what the real drone + gripper can lift (see docs/02-hardware-electronics.md).
  maxPayloadG: 300,
  fees: { standard: 49, express: 99, emergency: 0 } as Record<Priority, number>,
  // Distance part of the fee (not charged for emergencies).
  perKmFee: 20,
  includedKm: 0.5,
  // Rough battery model for the quote: ~10 min of usable flight on a 4S pack with payload.
  usableFlightS: 600,

  flight: {
    cruiseAltM: 25,
    dropAltM: 4,
    cruiseSpeedMs: 12,
  },

  // Simulator time multiplier: 1 = real time, 4 = four times faster (good for demos).
  simSpeed: Number(process.env.SIM_SPEED ?? 4),

  // Where the Python pymavlink bridge listens (drone-bridge/bridge.py).
  droneBridgeUrl: process.env.DRONE_BRIDGE_URL ?? 'ws://127.0.0.1:8765',
};

export type Priority = 'standard' | 'express' | 'emergency';
export const PRIORITIES: Priority[] = ['standard', 'express', 'emergency'];
