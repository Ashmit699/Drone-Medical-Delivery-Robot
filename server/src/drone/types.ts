// The contract between the app and any drone, real or simulated.
// The rest of the backend only ever talks to `DroneAdapter`, never to MAVLink or the simulator directly.
import type { EventEmitter } from 'node:events';
import type { LatLon } from '../lib/geo';

export type MissionPhase =
  | 'idle'
  | 'preflight'
  | 'takeoff'
  | 'cruise'
  | 'approach'
  | 'aligning'
  | 'awaiting_clearance'
  | 'lowering'
  | 'releasing'
  | 'retracting'
  | 'returning'
  | 'landing'
  | 'completed'
  | 'aborted';

export const PHASE_LABELS: Record<MissionPhase, string> = {
  idle: 'Idle at base',
  preflight: 'Pre-flight checks',
  takeoff: 'Taking off',
  cruise: 'En route',
  approach: 'Approaching drop zone',
  aligning: 'Aligning over marker',
  awaiting_clearance: 'Waiting for area-clear confirmation',
  lowering: 'Lowering package',
  releasing: 'Releasing package',
  retracting: 'Reeling rope in',
  returning: 'Returning to base',
  landing: 'Landing at base',
  completed: 'Mission complete',
  aborted: 'Mission aborted, back at base',
};

export interface PayloadState {
  gripper: 'closed' | 'open';
  winch: 'homed' | 'lowering' | 'holding' | 'retracting' | 'fault';
  ropeM: number;
  loaded: boolean;
}

export interface DroneTelemetry {
  droneId: string;
  connected: boolean;
  armed: boolean;
  mode: string; // ArduPilot flight mode, e.g. STABILIZE, GUIDED, AUTO, LOITER, RTL, LAND
  phase: MissionPhase;
  missionId: number | null;
  position: LatLon;
  altM: number; // above home / ground
  groundSpeedMs: number;
  headingDeg: number;
  batteryPct: number;
  batteryV: number;
  gpsSats: number;
  markerErrorCm: number | null; // precision alignment error once the marker is visible
  distanceToTargetM: number | null;
  etaToDropS: number | null;
  paused: boolean;
  payload: PayloadState;
  updatedAt: number;
}

export interface MissionPlan {
  missionId: number;
  orderId: number;
  home: LatLon;
  target: LatLon;
  targetGroundAltM: number | null; // drop-surface height from the 3D map (same datum as the hub's), null if unknown
  cruiseAltM: number;
  dropAltM: number;
}

export type DroneCommand =
  | { type: 'CLEARANCE' } // human confirmed the drop zone is clear: start lowering
  | { type: 'PAUSE' } // hold position (LOITER)
  | { type: 'RESUME' }
  | { type: 'RTL' }; // abort: reel rope in if needed, then return to launch

export interface PhaseEvent {
  droneId: string;
  missionId: number;
  phase: MissionPhase;
  message: string;
}

/**
 * Events emitted:
 *  - 'telemetry' (DroneTelemetry), several times per second
 *  - 'phase'     (PhaseEvent), whenever the mission phase changes
 */
export interface DroneAdapter extends EventEmitter {
  readonly id: string;
  readonly kind: 'sim' | 'bridge';
  telemetry(): DroneTelemetry;
  startMission(plan: MissionPlan): Promise<void>;
  command(cmd: DroneCommand): Promise<void>;
  dispose(): void;
}

export function baseTelemetry(droneId: string, home: LatLon): DroneTelemetry {
  return {
    droneId,
    connected: false,
    armed: false,
    mode: 'STABILIZE',
    phase: 'idle',
    missionId: null,
    position: { ...home },
    altM: 0,
    groundSpeedMs: 0,
    headingDeg: 0,
    batteryPct: 100,
    batteryV: 16.8,
    gpsSats: 0,
    markerErrorCm: null,
    distanceToTargetM: null,
    etaToDropS: null,
    paused: false,
    payload: { gripper: 'closed', winch: 'homed', ropeM: 0, loaded: false },
    updatedAt: Date.now(),
  };
}
