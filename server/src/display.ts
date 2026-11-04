// Data for the public Mission Control screen (exhibition display). Anonymised: no customer
// names, phone numbers or medicine names, only what a passer-by may see.
import { config } from './config';
import { all } from './db';
import { buildMission } from './drone/mission';
import { getOrderDetail, getOrderRow } from './orders';

export type DisplayOrder = ReturnType<typeof displayOrder>;

export function displayOrder(o: NonNullable<ReturnType<typeof getOrderDetail>>) {
  return {
    id: o.id,
    code: o.code,
    priority: o.priority,
    status: o.status,
    phase: o.mission_phase,
    itemCount: o.items.reduce((s, i) => s + i.qty, 0),
    weightG: o.weight_g,
    place: o.address_label,
    lat: o.lat,
    lon: o.lon,
    distanceM: o.distance_m,
    droneId: o.drone_id,
    droneName: o.drone_name,
    createdAt: o.created_at,
    events: o.events.slice(-8).map((e) => ({ id: e.id, type: e.type, message: e.message, at: e.created_at })),
  };
}

/** The ArduCopter mission for an order: exactly what the bridge uploads to a real drone. */
export function missionForOrder(orderId: number) {
  const o = getOrderRow(orderId);
  return buildMission({
    missionId: o.mission_id ?? 0,
    orderId,
    home: config.hub,
    target: { lat: o.lat, lon: o.lon },
    targetGroundAltM: o.ground_alt_m,
    cruiseAltM: config.flight.cruiseAltM,
    dropAltM: config.flight.dropAltM,
  });
}

export function displayState() {
  const ids = all<{ id: number }>(`SELECT id FROM orders WHERE created_at >= datetime('now', '-1 day') OR status IN ('placed','approved','in_flight') ORDER BY id DESC LIMIT 15`);
  const orders = ids.map((r) => getOrderDetail(r.id)).filter((o): o is NonNullable<typeof o> => !!o).map(displayOrder);
  const missions = Object.fromEntries(
    orders.filter((o) => ['approved', 'in_flight'].includes(o.status)).map((o) => [o.id, missionForOrder(o.id).items.map(({ seq, command, label, phase }) => ({ seq, command, label, phase }))]),
  );
  return { orders, missions, hub: config.hub, flight: config.flight };
}
