import { EventEmitter } from 'node:events';
import { config } from '../config';
import { all } from '../db';
import { HttpError } from '../lib/auth';
import { BridgeDroneAdapter } from './bridge';
import { SimDroneAdapter } from './sim';
import type { DroneAdapter, DroneTelemetry } from './types';

export type AdapterKind = 'sim' | 'bridge';

/** Owns one adapter per drone and re-emits their 'telemetry' and 'phase' events. */
class DroneManager extends EventEmitter {
  private adapters = new Map<string, DroneAdapter>();

  load() {
    for (const d of all<{ id: string; adapter: AdapterKind }>('SELECT id, adapter FROM drones')) {
      this.attach(d.id, d.adapter);
    }
  }

  attach(id: string, kind: AdapterKind) {
    const old = this.adapters.get(id);
    if (old) {
      old.removeAllListeners();
      old.dispose();
    }
    const adapter =
      kind === 'bridge' ? new BridgeDroneAdapter(id, config.hub) : new SimDroneAdapter(id, config.hub, 70 + Math.random() * 30);
    adapter.on('telemetry', (t) => this.emit('telemetry', t));
    adapter.on('phase', (e) => this.emit('phase', e));
    this.adapters.set(id, adapter);
  }

  get(id: string): DroneAdapter {
    const a = this.adapters.get(id);
    if (!a) throw new HttpError(404, `Unknown drone ${id}`);
    return a;
  }

  telemetry(id: string): DroneTelemetry | null {
    return this.adapters.get(id)?.telemetry() ?? null;
  }

  allTelemetry(): DroneTelemetry[] {
    return [...this.adapters.values()].map((a) => a.telemetry());
  }
}

export const drones = new DroneManager();
