// Public, anonymous live data: fleet positions, flight conditions, headline stats.
import { useEffect, useState } from 'react';
import { api } from './api';
import type { LatLon, MissionPhase, Telemetry } from './types';

export interface PublicDrone {
  id: string;
  name: string;
  status: string;
  connected: boolean;
  armed: boolean;
  phase: MissionPhase;
  mode: string;
  position: LatLon;
  altM: number;
  headingDeg: number;
  groundSpeedMs: number;
  batteryPct: number;
  gpsSats: number;
  payload: Telemetry['payload'];
  markerErrorCm: number | null;
}

export interface Conditions {
  available: boolean;
  call: 'GO' | 'CAUTION' | 'NO-GO' | null;
  reasons: string[];
  temperatureC?: number;
  windKmh?: number;
  gustKmh?: number;
  precipitationMm?: number;
  cloudPct?: number;
}

export interface PublicStats {
  delivered: number;
  successRate: number | null;
  avgDeliveryMin: number | null;
  dronesOnline: number;
  inFlight: number;
  livesReached: number;
}

function usePoll<T>(path: string, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () => api<T>(path).then((d) => alive && setData(d)).catch(() => {});
    tick();
    const id = setInterval(tick, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [path, everyMs]);
  return data;
}

export const usePublicFleet = (everyMs = 1000) => usePoll<PublicDrone[]>('/public/fleet', everyMs);
export const usePublicStats = () => usePoll<PublicStats>('/public/stats', 15000);
export const useConditions = () => usePoll<Conditions>('/conditions', 5 * 60 * 1000);

/** Metres east/north of the hub. */
export function offsetFrom(hub: LatLon, p: LatLon) {
  return {
    east: (p.lon - hub.lon) * 111_320 * Math.cos((hub.lat * Math.PI) / 180),
    north: (p.lat - hub.lat) * 110_540,
  };
}
