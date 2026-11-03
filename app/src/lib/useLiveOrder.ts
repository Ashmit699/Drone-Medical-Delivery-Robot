import { useEffect, useRef, useState } from 'react';
import { api, getSocket } from './api';
import type { OrderDetail, Telemetry } from './types';

/** Loads an order and keeps it (and its drone's telemetry) live over the socket. */
export function useLiveOrder(orderId: number | null, basePath = '/orders') {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const missionRef = useRef<number | null>(null);

  useEffect(() => {
    if (orderId == null) return;
    let alive = true;
    setOrder(null);
    setTelemetry(null);
    setError(null);

    api<OrderDetail>(`${basePath}/${orderId}`)
      .then((o) => {
        if (!alive) return;
        missionRef.current = o.mission_id;
        setOrder(o);
        if (o.telemetry && o.telemetry.missionId === o.mission_id) setTelemetry(o.telemetry);
      })
      .catch((e) => alive && setError(e.message));

    const s = getSocket();
    const track = () => s.emit('track', orderId);
    track();
    s.on('connect', track);

    const onUpdate = (o: OrderDetail) => {
      if (o.id !== orderId) return;
      missionRef.current = o.mission_id;
      setOrder((prev) => ({ ...prev, ...o }));
    };
    const onTelemetry = (t: Telemetry) => {
      if (t.missionId != null && t.missionId === missionRef.current) setTelemetry(t);
    };
    s.on('order:update', onUpdate);
    s.on('telemetry', onTelemetry);

    return () => {
      alive = false;
      s.emit('untrack', orderId);
      s.off('connect', track);
      s.off('order:update', onUpdate);
      s.off('telemetry', onTelemetry);
    };
  }, [orderId, basePath]);

  return { order, setOrder, telemetry, error };
}
