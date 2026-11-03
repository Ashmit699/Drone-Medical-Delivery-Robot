import { useCallback, useEffect, useState } from 'react';
import { api, getSocket } from './api';
import type { Drone, Telemetry } from './types';

/** Operator view of all drones with live telemetry. Drone records refresh on order changes. */
export function useFleet() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api<Drone[]>('/ops/drones')
      .then((d) => {
        setDrones(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
    const s = getSocket();
    const onTelemetry = (t: Telemetry) => setDrones((ds) => ds.map((d) => (d.id === t.droneId ? { ...d, telemetry: t } : d)));
    const onOrder = () => reload();
    s.on('telemetry', onTelemetry);
    s.on('order:update', onOrder);
    return () => {
      s.off('telemetry', onTelemetry);
      s.off('order:update', onOrder);
    };
  }, [reload]);

  return { drones, setDrones, reload, error };
}
