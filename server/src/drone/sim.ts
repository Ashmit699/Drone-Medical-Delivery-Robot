// A believable software drone. It follows the same phases the real drone + Raspberry Pi
// mission agent will follow (docs/01-system-architecture.md §1.4), so the app behaves the same
// when we switch to the real drone.
import { EventEmitter } from 'node:events';
import { config } from '../config';
import { bearingDeg, distanceM, offsetM, stepTowards, type LatLon } from '../lib/geo';
import {
  baseTelemetry,
  type DroneAdapter,
  type DroneCommand,
  type DroneTelemetry,
  type MissionPhase,
  type MissionPlan,
} from './types';

const TICK_MS = 200;
const CLIMB_MS = 2.5;
const DESCEND_MS = 1.2;
const APPROACH_SPEED_MS = 3;
const APPROACH_RADIUS_M = 40;
const ALIGN_ALT_M = 8;
const LOWER_MS = 0.25;
const RETRACT_MS = 0.35;

// The box may only open on the ground (loading) or while hovering over the drop point.
const BOX_OPEN_PHASES: MissionPhase[] = ['awaiting_clearance', 'lowering', 'releasing', 'retracting'];
const AIRBORNE: MissionPhase[] = ['takeoff', 'cruise', 'approach', 'aligning', 'awaiting_clearance', 'lowering', 'releasing', 'retracting', 'returning', 'landing'];

export class SimDroneAdapter extends EventEmitter implements DroneAdapter {
  readonly kind = 'sim' as const;
  private t: DroneTelemetry;
  private plan: MissionPlan | null = null;
  private phaseTime = 0;
  private clearance = false;
  private aborting = false;
  private timer: NodeJS.Timeout;

  constructor(readonly id: string, private home: LatLon, batteryPct = 100) {
    super();
    this.t = baseTelemetry(id, home);
    this.t.connected = true;
    this.t.batteryPct = batteryPct;
    this.timer = setInterval(() => this.tick((TICK_MS / 1000) * config.simSpeed), TICK_MS);
  }

  telemetry(): DroneTelemetry {
    return structuredClone(this.t);
  }

  async startMission(plan: MissionPlan) {
    if (!['idle', 'completed', 'aborted'].includes(this.t.phase)) throw new Error(`${this.id} is busy (${this.t.phase})`);
    if (this.t.batteryPct < 40) throw new Error(`${this.id} battery too low (${Math.round(this.t.batteryPct)}%)`);
    this.plan = plan;
    this.clearance = false;
    this.aborting = false;
    this.t.missionId = plan.missionId;
    this.t.paused = false;
    // The box is shut before arming, like the bridge does on the real drone.
    this.t.payload = { box: 'closed', gripper: 'closed', winch: 'homed', ropeM: 0, loaded: true };
    this.t.phase = 'preflight';
    // Report asynchronously, like a real drone would, so the dispatch is logged first.
    setImmediate(() => this.setPhase('preflight', 'Pre-flight checks passed. Arming motors'));
  }

  async command(cmd: DroneCommand) {
    const phase = this.t.phase;
    switch (cmd.type) {
      case 'BOX_OPEN':
        if (this.t.armed && !BOX_OPEN_PHASES.includes(phase)) {
          throw new Error('The box can only open on the ground or while hovering over the drop point');
        }
        this.t.payload.box = 'open';
        return;
      case 'BOX_CLOSE':
        this.t.payload.box = 'closed';
        return;
      case 'CLEARANCE':
        if (phase !== 'awaiting_clearance') throw new Error('Drone is not waiting for clearance');
        this.clearance = true;
        return;
      case 'PAUSE':
        if (!['cruise', 'approach', 'returning'].includes(phase)) throw new Error('Can only pause while flying between points');
        this.t.paused = true;
        this.t.mode = 'LOITER';
        return;
      case 'RESUME':
        if (!this.t.paused) return;
        this.t.paused = false;
        this.t.mode = phase === 'returning' ? 'RTL' : 'AUTO';
        return;
      case 'RTL':
        if (!this.plan || !['preflight', ...AIRBORNE].includes(phase)) throw new Error('Drone is not on a mission');
        // Already releasing, reeling in or heading home: nothing to abort.
        if (['releasing', 'retracting', 'returning', 'landing'].includes(phase)) return;
        this.aborting = true;
        this.t.paused = false;
        if (phase === 'preflight') {
          this.t.armed = false;
          this.setPhase('aborted', 'Mission cancelled before takeoff');
          this.plan = null;
        } else if (phase === 'lowering') {
          this.setPhase('retracting', 'Abort: reeling the package back up');
        } else {
          this.t.payload.box = 'closed';
          this.t.mode = 'RTL';
          this.setPhase('returning', 'Abort: returning to base with the package');
        }
        return;
    }
  }

  dispose() {
    clearInterval(this.timer);
  }

  private setPhase(phase: MissionPhase, message: string) {
    this.t.phase = phase;
    this.phaseTime = 0;
    this.emit('phase', { droneId: this.id, missionId: this.t.missionId!, phase, message });
  }

  private moveTowards(target: LatLon, speedMs: number, dt: number) {
    const before = this.t.position;
    this.t.position = stepTowards(before, target, speedMs * dt);
    const moved = distanceM(before, this.t.position);
    if (moved > 0.01) this.t.headingDeg = bearingDeg(before, this.t.position);
    this.t.groundSpeedMs = dt > 0 ? moved / dt : 0;
  }

  private hover(jitterM: number) {
    this.t.groundSpeedMs = Math.random() * 0.3;
    if (jitterM > 0 && this.plan) {
      this.t.position = offsetM(this.plan.target, (Math.random() - 0.5) * jitterM, (Math.random() - 0.5) * jitterM);
    }
  }

  private tick(dt: number) {
    const t = this.t;
    const plan = this.plan;
    t.gpsSats = 13 + Math.round(Math.random() * 3);

    if (plan) {
      switch (t.phase) {
        case 'preflight':
          if (this.phaseTime > 3) {
            t.armed = true;
            t.mode = 'GUIDED';
            this.setPhase('takeoff', `Taking off to ${plan.cruiseAltM} m`);
          }
          break;

        case 'takeoff':
          t.groundSpeedMs = 0;
          t.altM = Math.min(plan.cruiseAltM, t.altM + CLIMB_MS * dt);
          if (t.altM >= plan.cruiseAltM) {
            t.mode = 'AUTO';
            this.setPhase('cruise', `Cruising at ${plan.cruiseAltM} m towards the drop zone`);
          }
          break;

        case 'cruise':
          if (t.paused) this.hover(0);
          else this.moveTowards(plan.target, config.flight.cruiseSpeedMs, dt);
          if (distanceM(t.position, plan.target) < APPROACH_RADIUS_M) {
            this.setPhase('approach', 'Arriving at the drop zone, descending');
          }
          break;

        case 'approach':
          if (t.paused) this.hover(0);
          else this.moveTowards(plan.target, APPROACH_SPEED_MS, dt);
          t.altM = Math.max(ALIGN_ALT_M, t.altM - DESCEND_MS * dt);
          if (distanceM(t.position, plan.target) < 0.5 && t.altM <= ALIGN_ALT_M + 0.01) {
            t.mode = 'GUIDED';
            t.markerErrorCm = 90 + Math.random() * 40;
            this.setPhase('aligning', 'Landing marker found. Precision alignment');
          }
          break;

        case 'aligning':
          t.markerErrorCm = Math.max(6, t.markerErrorCm! * (1 - 0.5 * dt) + (Math.random() - 0.5) * 3);
          this.hover(t.markerErrorCm / 100);
          t.altM = Math.max(plan.dropAltM, t.altM - DESCEND_MS * 0.6 * dt);
          if (t.markerErrorCm < 15 && t.altM <= plan.dropAltM + 0.01 && this.phaseTime > 4) {
            t.mode = 'LOITER';
            this.setPhase('awaiting_clearance', `Holding ${plan.dropAltM} m above the marker. Waiting for "Area clear"`);
          }
          break;

        case 'awaiting_clearance':
          t.markerErrorCm = 5 + Math.random() * 7;
          this.hover(t.markerErrorCm / 100);
          if (this.clearance) {
            t.payload.box = 'open';
            t.payload.winch = 'lowering';
            this.setPhase('lowering', 'Area clear confirmed. Box open, lowering the package');
          }
          break;

        case 'lowering':
          t.markerErrorCm = 5 + Math.random() * 7;
          this.hover(t.markerErrorCm / 100);
          t.payload.ropeM = Math.min(plan.dropAltM - 0.2, t.payload.ropeM + LOWER_MS * dt);
          if (t.payload.ropeM >= plan.dropAltM - 0.2) {
            t.payload.winch = 'holding';
            t.payload.gripper = 'open';
            t.payload.loaded = false;
            this.setPhase('releasing', 'Package is on the ground. Hooks open');
          }
          break;

        case 'releasing':
          this.hover(0.05);
          if (this.phaseTime > 2) {
            t.payload.winch = 'retracting';
            this.setPhase('retracting', 'Package delivered. Reeling the rope in');
          }
          break;

        case 'retracting':
          this.hover(0.05);
          t.payload.winch = 'retracting';
          t.payload.ropeM = Math.max(0, t.payload.ropeM - RETRACT_MS * dt);
          if (t.payload.ropeM === 0) {
            t.payload.winch = 'homed';
            t.payload.gripper = 'closed';
            t.payload.box = 'closed';
            t.mode = 'RTL';
            this.setPhase('returning', 'Rope secured. Returning to base');
          }
          break;

        case 'returning':
          if (t.paused) {
            this.hover(0);
          } else if (t.altM < plan.cruiseAltM - 0.1) {
            t.groundSpeedMs = 0;
            t.altM = Math.min(plan.cruiseAltM, t.altM + CLIMB_MS * dt);
          } else {
            this.moveTowards(this.home, config.flight.cruiseSpeedMs, dt);
          }
          t.markerErrorCm = null;
          if (distanceM(t.position, this.home) < 1) {
            t.mode = 'LAND';
            this.setPhase('landing', 'Over base. Landing');
          }
          break;

        case 'landing':
          t.groundSpeedMs = 0;
          t.altM = Math.max(0, t.altM - DESCEND_MS * dt);
          if (t.altM === 0) {
            t.armed = false;
            t.mode = 'STABILIZE';
            this.plan = null;
            this.setPhase(
              this.aborting ? 'aborted' : 'completed',
              this.aborting ? 'Back at base with the package. Mission aborted' : 'Landed safely at base. Mission complete',
            );
          }
          break;
      }
    }

    // Battery: drains in flight, slowly recharges (battery swap) on the ground.
    if (t.armed) {
      t.batteryPct = Math.max(0, t.batteryPct - (0.06 + 0.002 * t.groundSpeedMs) * dt);
    } else {
      t.batteryPct = Math.min(100, t.batteryPct + 0.4 * dt);
      t.groundSpeedMs = 0;
    }
    t.batteryV = +(13.2 + (3.6 * t.batteryPct) / 100).toFixed(2);

    // Distance + ETA to the drop (real-world seconds shown to the user, scaled by sim speed).
    const toDrop = this.plan && ['preflight', 'takeoff', 'cruise', 'approach', 'aligning'].includes(t.phase);
    if (toDrop && this.plan) {
      const d = distanceM(t.position, this.plan.target);
      const climb = t.phase === 'preflight' || t.phase === 'takeoff' ? (this.plan.cruiseAltM - t.altM) / CLIMB_MS + 3 : 0;
      const simSeconds = climb + Math.max(0, d - APPROACH_RADIUS_M) / config.flight.cruiseSpeedMs + 20;
      t.distanceToTargetM = Math.round(d);
      t.etaToDropS = Math.round(simSeconds / config.simSpeed);
    } else {
      t.distanceToTargetM = this.plan && t.phase !== 'returning' && t.phase !== 'landing' ? 0 : null;
      t.etaToDropS = null;
    }

    t.updatedAt = Date.now();
    this.phaseTime += dt;
    this.emit('telemetry', this.telemetry());
  }
}
