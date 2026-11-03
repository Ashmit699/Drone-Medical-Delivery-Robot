// Order domain logic: pricing/quotes, checkout, approval, dispatch to a drone, and turning
// drone mission phases into order status updates.
import { config, type Priority } from './config';
import { addEvent, all, one, run, tx } from './db';
import { drones } from './drone/manager';
import { PHASE_LABELS, type MissionPlan, type PhaseEvent } from './drone/types';
import { HttpError } from './lib/auth';
import { distanceM } from './lib/geo';
import { emitOrderUpdate } from './realtime';

export type OrderStatus = 'placed' | 'approved' | 'rejected' | 'cancelled' | 'in_flight' | 'delivered' | 'failed';

export interface OrderRow {
  id: number;
  code: string;
  user_id: number;
  status: OrderStatus;
  priority: Priority;
  items_total: number;
  delivery_fee: number;
  total: number;
  weight_g: number;
  payment_method: string;
  payment_status: string;
  address_label: string;
  address_line: string;
  lat: number;
  lon: number;
  distance_m: number;
  eta_s: number;
  notes: string | null;
  rx_image: string | null;
  ground_alt_m: number | null;
  reject_reason: string | null;
  drone_id: string | null;
  mission_id: number | null;
  rating: number | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
}

interface ProductRow {
  id: number;
  name: string;
  price: number;
  weight_g: number;
  stock: number;
  rx_required: number;
  icon: string;
}

export interface QuoteInput {
  items: { productId: number; qty: number }[];
  lat?: number;
  lon?: number;
  priority: Priority;
}

/** Estimated real-world flight time from takeoff to package on the ground. */
export function estimateEtaS(distM: number) {
  const { cruiseAltM, cruiseSpeedMs } = config.flight;
  return Math.round(5 + cruiseAltM / 2.5 + distM / cruiseSpeedMs + 45);
}

export function quote(input: QuoteInput) {
  const problems: string[] = [];
  const lines = input.items.map(({ productId, qty }) => {
    const p = one<ProductRow>('SELECT * FROM products WHERE id = ?', productId);
    if (!p) {
      problems.push(`Product #${productId} no longer exists`);
      return null;
    }
    if (qty > p.stock) problems.push(p.stock === 0 ? `${p.name} is out of stock` : `Only ${p.stock} × ${p.name} left`);
    return { productId: p.id, name: p.name, price: p.price, qty, weightG: p.weight_g, rxRequired: !!p.rx_required, icon: p.icon };
  });
  const valid = lines.filter((l): l is NonNullable<typeof l> => l !== null);

  const itemsTotal = valid.reduce((s, l) => s + l.price * l.qty, 0);
  const weightG = valid.reduce((s, l) => s + l.weightG * l.qty, 0);
  if (weightG > config.maxPayloadG) problems.push(`Package is ${weightG} g. The drone can carry at most ${config.maxPayloadG} g per flight`);
  if (valid.length === 0) problems.push('Your cart is empty');

  let distance: number | null = null;
  if (input.lat != null && input.lon != null) {
    distance = Math.round(distanceM(config.hub, { lat: input.lat, lon: input.lon }));
    if (distance > config.serviceRadiusKm * 1000) {
      problems.push(`That location is ${(distance / 1000).toFixed(1)} km away. We deliver within ${config.serviceRadiusKm} km`);
    }
  }

  const baseFee = config.fees[input.priority];
  const distanceFee =
    input.priority === 'emergency' || distance == null ? 0 : Math.round(Math.max(0, distance / 1000 - config.includedKm) * config.perKmFee);
  const deliveryFee = baseFee + distanceFee;
  const etaS = distance != null ? estimateEtaS(distance) : null;
  return {
    lines: valid,
    itemsTotal,
    weightG,
    baseFee,
    distanceFee,
    deliveryFee,
    total: itemsTotal + deliveryFee,
    distanceM: distance,
    etaS,
    // Out and back plus hover/drop time, as a share of one battery.
    batteryUsePct: etaS != null ? Math.min(100, Math.round(((etaS * 2 + 30) / config.usableFlightS) * 100)) : null,
    rxRequired: valid.some((l) => l.rxRequired),
    problems,
  };
}

export interface CreateOrderInput extends QuoteInput {
  lat: number;
  lon: number;
  addressLabel: string;
  addressLine: string;
  paymentMethod: 'upi' | 'wallet' | 'account';
  notes?: string;
  rxImage?: string;
  groundAltM?: number; // height of the drop surface (from the 3D map), if known
}

export function createOrder(userId: number, input: CreateOrderInput): number {
  const q = quote(input);
  if (q.problems.length) throw new HttpError(400, q.problems.join('. '));
  if (q.rxRequired && !input.rxImage) throw new HttpError(400, 'A prescription photo is required for Rx items');

  const autoApprove = input.priority === 'emergency' && !q.rxRequired;
  const paymentStatus = input.paymentMethod === 'account' ? 'billed' : 'paid';

  const id = tx(() => {
    const { id } = run(
      `INSERT INTO orders (user_id, status, priority, items_total, delivery_fee, total, weight_g, payment_method,
         payment_status, address_label, address_line, lat, lon, distance_m, eta_s, notes, rx_image, ground_alt_m)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId, autoApprove ? 'approved' : 'placed', input.priority, q.itemsTotal, q.deliveryFee, q.total, q.weightG,
      input.paymentMethod, paymentStatus, input.addressLabel, input.addressLine, input.lat, input.lon, q.distanceM!, q.etaS!,
      input.notes ?? null, input.rxImage ?? null, input.groundAltM ?? null,
    );
    run('UPDATE orders SET code = ? WHERE id = ?', `MD-${1000 + id}`, id);
    for (const l of q.lines) {
      run('INSERT INTO order_items (order_id, product_id, name, price, qty, weight_g) VALUES (?, ?, ?, ?, ?, ?)', id, l.productId, l.name, l.price, l.qty, l.weightG);
      run('UPDATE products SET stock = stock - ? WHERE id = ?', l.qty, l.productId);
    }
    addEvent(id, 'placed', `Order placed (${input.priority} priority)`);
    if (autoApprove) addEvent(id, 'approved', 'Emergency order auto-approved. Preparing for dispatch');
    return id;
  });
  emitOrderUpdate(id);
  return id;
}

export function getOrderRow(id: number) {
  const o = one<OrderRow>('SELECT * FROM orders WHERE id = ?', id);
  if (!o) throw new HttpError(404, 'Order not found');
  return o;
}

export function getOrderDetail(id: number) {
  const o = one<OrderRow & { customer_name: string; customer_phone: string | null; drone_name: string | null; mission_phase: string | null }>(
    `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, d.name AS drone_name, m.phase AS mission_phase
       FROM orders o JOIN users u ON u.id = o.user_id
       LEFT JOIN drones d ON d.id = o.drone_id
       LEFT JOIN missions m ON m.id = o.mission_id
      WHERE o.id = ?`,
    id,
  );
  if (!o) return null;
  const { rx_image, ...rest } = o;
  return {
    ...rest,
    has_rx: !!rx_image,
    items: all('SELECT product_id, name, price, qty, weight_g FROM order_items WHERE order_id = ?', id),
    events: all('SELECT id, type, message, created_at FROM events WHERE order_id = ? ORDER BY id', id),
  };
}

export function listOrders(where: { userId?: number; status?: string } = {}) {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (where.userId) {
    clauses.push('o.user_id = ?');
    params.push(where.userId);
  }
  if (where.status) {
    clauses.push('o.status = ?');
    params.push(where.status);
  }
  return all(
    `SELECT o.id, o.code, o.status, o.priority, o.total, o.weight_g, o.address_label, o.created_at, o.delivered_at,
            o.drone_id, o.rating, o.payment_method, o.distance_m, o.rx_image IS NOT NULL AS has_rx,
            u.name AS customer_name, m.phase AS mission_phase,
            (SELECT GROUP_CONCAT(qty || '× ' || name, ', ') FROM order_items WHERE order_id = o.id) AS summary,
            (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN missions m ON m.id = o.mission_id
      ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
      ORDER BY CASE o.priority WHEN 'emergency' THEN 0 WHEN 'express' THEN 1 ELSE 2 END, o.id DESC`,
    ...params,
  );
}

function setStatus(id: number, status: OrderStatus, extra = '') {
  run(`UPDATE orders SET status = ?, updated_at = datetime('now') ${extra} WHERE id = ?`, status, id);
}

function restock(orderId: number) {
  for (const i of all<{ product_id: number; qty: number }>('SELECT product_id, qty FROM order_items WHERE order_id = ?', orderId)) {
    run('UPDATE products SET stock = stock + ? WHERE id = ?', i.qty, i.product_id);
  }
}

export function approveOrder(id: number) {
  const o = getOrderRow(id);
  if (o.status !== 'placed') throw new HttpError(409, `Order is ${o.status}`);
  setStatus(id, 'approved');
  addEvent(id, 'approved', o.rx_image ? 'Prescription verified. Order approved' : 'Order approved. Packing your items');
  emitOrderUpdate(id);
}

export function rejectOrder(id: number, reason: string) {
  const o = getOrderRow(id);
  if (!['placed', 'approved'].includes(o.status)) throw new HttpError(409, `Order is ${o.status}`);
  tx(() => {
    run(`UPDATE orders SET status = 'rejected', reject_reason = ?, payment_status = CASE payment_status WHEN 'paid' THEN 'refunded' ELSE 'void' END, updated_at = datetime('now') WHERE id = ?`, reason, id);
    restock(id);
    addEvent(id, 'rejected', `Order rejected: ${reason}`);
  });
  emitOrderUpdate(id);
}

export function cancelOrder(id: number, userId: number) {
  const o = getOrderRow(id);
  if (o.user_id !== userId) throw new HttpError(404, 'Order not found');
  if (!['placed', 'approved'].includes(o.status)) throw new HttpError(409, 'This order can no longer be cancelled');
  tx(() => {
    run(`UPDATE orders SET status = 'cancelled', payment_status = CASE payment_status WHEN 'paid' THEN 'refunded' ELSE 'void' END, updated_at = datetime('now') WHERE id = ?`, id);
    restock(id);
    addEvent(id, 'cancelled', 'Order cancelled by customer');
  });
  emitOrderUpdate(id);
}

export async function dispatchOrder(orderId: number, droneId: string) {
  const o = getOrderRow(orderId);
  if (o.status !== 'approved') throw new HttpError(409, 'Only approved orders can be dispatched');
  const drone = one<{ id: string; name: string; status: string; max_payload_g: number }>('SELECT * FROM drones WHERE id = ?', droneId);
  if (!drone) throw new HttpError(404, 'Drone not found');
  if (drone.status !== 'idle') throw new HttpError(409, `${drone.name} is ${drone.status.replace('_', ' ')}`);
  if (o.weight_g > drone.max_payload_g) throw new HttpError(409, `${drone.name} can only carry ${drone.max_payload_g} g`);
  const t = drones.telemetry(droneId);
  if (!t?.connected) throw new HttpError(409, `${drone.name} is not connected`);

  const missionId = run(
    'INSERT INTO missions (order_id, drone_id, phase, plan_json) VALUES (?, ?, ?, ?)',
    orderId, droneId, 'preflight', '{}',
  ).id;
  const plan: MissionPlan = {
    missionId,
    orderId,
    home: config.hub,
    target: { lat: o.lat, lon: o.lon },
    targetGroundAltM: o.ground_alt_m,
    cruiseAltM: config.flight.cruiseAltM,
    dropAltM: config.flight.dropAltM,
  };
  run('UPDATE missions SET plan_json = ? WHERE id = ?', JSON.stringify(plan), missionId);

  try {
    await drones.get(droneId).startMission(plan);
  } catch (err) {
    run('DELETE FROM missions WHERE id = ?', missionId);
    throw new HttpError(409, (err as Error).message);
  }

  run(`UPDATE drones SET status = 'in_flight' WHERE id = ?`, droneId);
  run(
    `UPDATE orders SET status = 'in_flight', drone_id = ?, mission_id = ?, dispatched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    droneId, missionId, orderId,
  );
  addEvent(orderId, 'dispatched', `Package loaded on ${drone.name} (${droneId})`);
  emitOrderUpdate(orderId);
}

export async function sendClearance(orderId: number) {
  const o = getOrderRow(orderId);
  if (o.status !== 'in_flight' || !o.drone_id) throw new HttpError(409, 'The drone is not at your location yet');
  try {
    await drones.get(o.drone_id).command({ type: 'CLEARANCE' });
  } catch (err) {
    throw new HttpError(409, (err as Error).message);
  }
  addEvent(orderId, 'clearance', 'Drop zone confirmed clear');
  emitOrderUpdate(orderId);
}

/** Called for every mission phase change reported by any drone adapter. */
export function handlePhase(e: PhaseEvent) {
  const mission = one<{ id: number; order_id: number; drone_id: string }>('SELECT * FROM missions WHERE id = ?', e.missionId);
  if (!mission) return;
  const orderId = mission.order_id;
  run('UPDATE missions SET phase = ? WHERE id = ?', e.phase, mission.id);
  addEvent(orderId, `phase:${e.phase}`, e.message || PHASE_LABELS[e.phase]);

  if (e.phase === 'releasing') {
    setStatus(orderId, 'delivered', `, delivered_at = datetime('now')`);
  }
  if (e.phase === 'completed' || e.phase === 'aborted') {
    run(`UPDATE missions SET ended_at = datetime('now') WHERE id = ?`, mission.id);
    run(`UPDATE drones SET status = 'idle' WHERE id = ? AND status = 'in_flight'`, mission.drone_id);
    const o = getOrderRow(orderId);
    if (o.status !== 'delivered') {
      setStatus(orderId, 'failed');
      addEvent(orderId, 'failed', 'Delivery could not be completed. The package is back at base and a redelivery will be arranged');
    }
  }
  emitOrderUpdate(orderId);
}
