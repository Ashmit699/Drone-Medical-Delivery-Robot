// Adapter for the REAL drone. It talks to drone-bridge/bridge.py (Python + pymavlink) over a
// WebSocket. The bridge turns these JSON messages into MAVLink for the CrossFlight flight
// controller. The protocol is documented in ./README.md.
import { EventEmitter } from 'node:events';
import { config } from '../config';
import type { LatLon } from '../lib/geo';
import {
  baseTelemetry,
  PHASE_LABELS,
  type DroneAdapter,
  type DroneCommand,
  type DroneTelemetry,
  type MissionPhase,
  type MissionPlan,
} from './types';

const RECONNECT_MS = 5000;
const COMMAND_TIMEOUT_MS = 20_000; // an abort with the package on the rope waits for the reel-in

export class BridgeDroneAdapter extends EventEmitter implements DroneAdapter {
  readonly kind = 'bridge' as const;
  private t: DroneTelemetry;
  private ws: WebSocket | null = null;
  private retry: NodeJS.Timeout | undefined;
  private disposed = false;
  private nextId = 1;
  private pending = new Map<number, { resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();

  constructor(readonly id: string, home: LatLon, private url = config.droneBridgeUrl) {
    super();
    this.t = baseTelemetry(id, home);
    this.connect();
  }

  telemetry(): DroneTelemetry {
    return structuredClone(this.t);
  }

  async startMission(plan: MissionPlan) {
    this.send({ type: 'start_mission', plan });
  }

  /** Resolves when the bridge confirms the command ran on the drone; rejects with the bridge's reason. */
  command(command: DroneCommand) {
    const id = this.nextId++;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The drone bridge did not answer in time'));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ type: 'command', id, command });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err as Error);
      }
    });
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.retry);
    this.ws?.close();
  }

  private connect() {
    if (this.disposed) return;
    const ws = new WebSocket(`${this.url}?drone=${encodeURIComponent(this.id)}`);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.t.connected = true;
      ws.send(JSON.stringify({ type: 'hello', droneId: this.id, box: config.box }));
      this.publish();
    });
    ws.addEventListener('message', (ev) => this.handle(String(ev.data)));
    ws.addEventListener('close', () => {
      this.ws = null;
      this.t.connected = false;
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('Lost connection to the drone bridge'));
      }
      this.pending.clear();
      this.publish();
      if (!this.disposed) this.retry = setTimeout(() => this.connect(), RECONNECT_MS);
    });
    ws.addEventListener('error', () => {
      // 'close' always follows; reconnect happens there.
    });
  }

  private handle(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'telemetry') {
      Object.assign(this.t, msg.telemetry, { droneId: this.id, connected: true });
      this.publish();
    } else if (msg.type === 'phase') {
      const phase = msg.phase as MissionPhase;
      this.t.phase = phase;
      this.emit('phase', { droneId: this.id, missionId: msg.missionId, phase, message: msg.message ?? PHASE_LABELS[phase] });
    } else if (msg.type === 'result') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve();
      else p.reject(new Error(msg.error ?? 'Command failed'));
    } else if (msg.type === 'error') {
      console.warn(`[bridge ${this.id}]`, msg.message);
    }
  }

  private publish() {
    this.t.updatedAt = Date.now();
    this.emit('telemetry', this.telemetry());
  }

  private send(obj: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Drone ${this.id} is not connected (is drone-bridge running at ${this.url}?)`);
    }
    this.ws.send(JSON.stringify(obj));
  }
}
