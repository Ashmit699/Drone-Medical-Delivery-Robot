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

export class BridgeDroneAdapter extends EventEmitter implements DroneAdapter {
  readonly kind = 'bridge' as const;
  private t: DroneTelemetry;
  private ws: WebSocket | null = null;
  private retry: NodeJS.Timeout | undefined;
  private disposed = false;

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

  async command(command: DroneCommand) {
    this.send({ type: 'command', command });
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
      ws.send(JSON.stringify({ type: 'hello', droneId: this.id }));
      this.publish();
    });
    ws.addEventListener('message', (ev) => this.handle(String(ev.data)));
    ws.addEventListener('close', () => {
      this.ws = null;
      this.t.connected = false;
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
