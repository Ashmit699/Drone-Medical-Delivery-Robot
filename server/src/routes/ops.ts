// Operator-only routes: dashboard stats, order approval + dispatch, fleet control, inventory.
import { Router } from 'express';
import { z } from 'zod';
import { all, one, run } from '../db';
import { drones, type AdapterKind } from '../drone/manager';
import { HttpError, requireOperator } from '../lib/auth';
import { emitToUser } from '../realtime';
import { WELFARE_DISCOUNT, WELFARE_LABEL, type WelfareRow } from '../welfare';
import { missionForOrder } from '../display';
import { toWaypointsFile } from '../drone/mission';
import { config } from '../config';
import { approveOrder, dispatchOrder, getOrderDetail, getOrderRow, listOrders, rejectOrder } from '../orders';

export const opsRoutes = Router();
opsRoutes.use(requireOperator);

const idParam = (v: string | string[] | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, 'Bad id');
  return n;
};

opsRoutes.get('/stats', (_req, res) => {
  const today = `date(created_at) = date('now')`;
  const count = (sql: string) => one<{ n: number }>(sql)?.n ?? 0;
  const avg = one<{ m: number | null }>(
    `SELECT AVG((julianday(delivered_at) - julianday(dispatched_at)) * 1440) AS m FROM orders WHERE delivered_at IS NOT NULL AND dispatched_at IS NOT NULL`,
  );
  const fleet = all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM drones GROUP BY status');

  res.json({
    ordersToday: count(`SELECT COUNT(*) AS n FROM orders WHERE ${today}`),
    deliveredToday: count(`SELECT COUNT(*) AS n FROM orders WHERE status = 'delivered' AND date(delivered_at) = date('now')`),
    inFlight: count(`SELECT COUNT(*) AS n FROM orders WHERE status = 'in_flight'`),
    pendingApproval: count(`SELECT COUNT(*) AS n FROM orders WHERE status = 'placed'`),
    readyToDispatch: count(`SELECT COUNT(*) AS n FROM orders WHERE status = 'approved'`),
    totalDelivered: count(`SELECT COUNT(*) AS n FROM orders WHERE status = 'delivered'`),
    // Business model: income is monthly plan fees, not per-order charges.
    activeMembers: count(`SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active' AND renews_at > datetime('now')`),
    planRevenueMonthly: one<{ s: number | null }>(`SELECT SUM(price_paid) AS s FROM subscriptions WHERE status = 'active' AND renews_at > datetime('now')`)?.s ?? 0,
    avgDeliveryMin: avg?.m != null ? Math.round(avg.m * 10) / 10 : null,
    avgRating: one<{ r: number | null }>('SELECT ROUND(AVG(rating), 1) AS r FROM orders WHERE rating IS NOT NULL')?.r ?? null,
    successRate: (() => {
      const done = count(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('delivered','failed')`);
      return done ? Math.round((count(`SELECT COUNT(*) AS n FROM orders WHERE status = 'delivered'`) / done) * 100) : null;
    })(),
    fleet: Object.fromEntries(fleet.map((f) => [f.status, f.n])),
    ordersByDay: all(
      `WITH RECURSIVE days(d) AS (SELECT date('now', '-6 days') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < date('now'))
       SELECT d AS day,
              (SELECT COUNT(*) FROM orders WHERE date(created_at) = d) AS orders,
              (SELECT COUNT(*) FROM orders WHERE date(delivered_at) = d) AS delivered
         FROM days`,
    ),
    byCategory: all(
      `SELECT p.category AS category, SUM(oi.qty) AS qty FROM order_items oi JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id WHERE o.status NOT IN ('rejected','cancelled')
        GROUP BY p.category ORDER BY qty DESC`,
    ),
    byPriority: all(`SELECT priority, COUNT(*) AS n FROM orders GROUP BY priority`),
    lowStock: all('SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock'),
    welfarePending: count(`SELECT COUNT(*) AS n FROM welfare WHERE status = 'pending'`),
  });
});

// ---------- Orders ----------

opsRoutes.get('/orders', (req, res) => {
  res.json(listOrders({ status: typeof req.query.status === 'string' ? req.query.status : undefined }));
});

opsRoutes.get('/orders/:id', (req, res) => {
  const d = getOrderDetail(idParam(req.params.id));
  if (!d) throw new HttpError(404, 'Order not found');
  const telemetry = d.drone_id ? drones.telemetry(d.drone_id) : null;
  res.json({ ...d, telemetry });
});

opsRoutes.get('/orders/:id/rx', (req, res) => {
  const o = getOrderRow(idParam(req.params.id));
  if (!o.rx_image) throw new HttpError(404, 'No prescription on this order');
  res.json({ image: o.rx_image });
});

opsRoutes.post('/orders/:id/approve', (req, res) => {
  const id = idParam(req.params.id);
  approveOrder(id);
  res.json(getOrderDetail(id));
});

opsRoutes.post('/orders/:id/reject', (req, res) => {
  const id = idParam(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).parse(req.body);
  rejectOrder(id, reason);
  res.json(getOrderDetail(id));
});

opsRoutes.post('/orders/:id/dispatch', async (req, res) => {
  const id = idParam(req.params.id);
  const { droneId } = z.object({ droneId: z.string() }).parse(req.body);
  await dispatchOrder(id, droneId);
  res.json(getOrderDetail(id));
});

// ---------- Fleet ----------

opsRoutes.get('/drones', (_req, res) => {
  const rows = all<{ id: string }>(
    `SELECT d.*, (SELECT COUNT(*) FROM missions m WHERE m.drone_id = d.id) AS missions,
            (SELECT o.code FROM orders o WHERE o.drone_id = d.id AND o.status = 'in_flight') AS active_order
       FROM drones d ORDER BY d.id`,
  );
  res.json(rows.map((d) => ({ ...d, telemetry: drones.telemetry(d.id) })));
});

opsRoutes.post('/drones/:id/command', async (req, res) => {
  const { type } = z.object({ type: z.enum(['PAUSE', 'RESUME', 'RTL', 'BOX_OPEN', 'BOX_CLOSE']) }).parse(req.body);
  const id = String(req.params.id);
  try {
    await drones.get(id).command({ type });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(409, (err as Error).message);
  }
  const t = drones.telemetry(id);
  const active = one<{ id: number }>(`SELECT id FROM orders WHERE drone_id = ? AND mission_id = ?`, id, t?.missionId ?? -1);
  if (active) {
    const label = {
      PAUSE: 'Operator paused the drone (holding position)',
      RESUME: 'Operator resumed the mission',
      RTL: 'Operator ordered return to base',
      BOX_OPEN: 'Operator opened the storage box',
      BOX_CLOSE: 'Operator closed the storage box',
    }[type];
    run('INSERT INTO events (order_id, type, message) VALUES (?, ?, ?)', active.id, `cmd:${type}`, label);
  }
  res.json({ ok: true, telemetry: t });
});

opsRoutes.patch('/drones/:id', (req, res) => {
  const id = String(req.params.id);
  const body = z
    .object({ adapter: z.enum(['sim', 'bridge']).optional(), status: z.enum(['idle', 'charging', 'maintenance']).optional() })
    .parse(req.body);
  const drone = one<{ status: string }>('SELECT status FROM drones WHERE id = ?', id);
  if (!drone) throw new HttpError(404, 'Drone not found');
  if (drone.status === 'in_flight') throw new HttpError(409, 'Cannot change a drone while it is flying');
  if (body.status) run('UPDATE drones SET status = ? WHERE id = ?', body.status, id);
  if (body.adapter) {
    run('UPDATE drones SET adapter = ? WHERE id = ?', body.adapter, id);
    drones.attach(id, body.adapter as AdapterKind);
  }
  res.json({ ...one('SELECT * FROM drones WHERE id = ?', id), telemetry: drones.telemetry(id) });
});

// ---------- Inventory ----------

opsRoutes.patch('/products/:id', (req, res) => {
  const id = idParam(req.params.id);
  const body = z.object({ stock: z.number().int().min(0).max(9999).optional(), price: z.number().int().min(0).max(100000).optional() }).parse(req.body);
  if (body.stock != null) run('UPDATE products SET stock = ? WHERE id = ?', body.stock, id);
  if (body.price != null) run('UPDATE products SET price = ? WHERE id = ?', body.price, id);
  res.json(one('SELECT * FROM products WHERE id = ?', id));
});

// ---------- Welfare verification ----------

opsRoutes.get('/welfare', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const rows = all<WelfareRow & { email: string }>(
    `SELECT w.*, u.email FROM welfare w JOIN users u ON u.id = w.user_id
      WHERE (? = '' OR w.status = ?) ORDER BY CASE w.status WHEN 'pending' THEN 0 ELSE 1 END, w.created_at DESC`,
    status, status,
  );
  res.json(rows.map((w) => ({ ...w, discountPct: WELFARE_DISCOUNT[w.category], label: WELFARE_LABEL[w.category] })));
});

opsRoutes.post('/welfare/:id/:action', (req, res) => {
  const action = req.params.action;
  if (action !== 'verify' && action !== 'reject') throw new HttpError(404, 'Unknown action');
  const id = idParam(req.params.id);
  const w = one<WelfareRow>('SELECT * FROM welfare WHERE id = ?', id);
  if (!w) throw new HttpError(404, 'Request not found');
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 200) : null;
  run(`UPDATE welfare SET status = ?, note = ?, reviewed_at = datetime('now') WHERE id = ?`, action === 'verify' ? 'verified' : 'rejected', note, id);
  emitToUser(w.user_id, 'welfare:update', { status: action === 'verify' ? 'verified' : 'rejected', discountPct: WELFARE_DISCOUNT[w.category], note });
  res.json({ ok: true });
});

// ---------- Flight plan (ArduCopter mission) ----------

opsRoutes.get('/orders/:id/mission', (req, res) => {
  res.json(missionForOrder(idParam(req.params.id)));
});

// Mission Planner: Flight Plan → Load WP File (or QGroundControl: Plan → Open).
opsRoutes.get('/orders/:id/mission.waypoints', (req, res) => {
  const id = idParam(req.params.id);
  const o = getOrderRow(id);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${o.code}.waypoints"`);
  res.send(toWaypointsFile(missionForOrder(id)));
});
