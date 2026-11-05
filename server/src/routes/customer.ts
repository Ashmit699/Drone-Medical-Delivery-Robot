// Routes for logged-in customers: addresses, quotes, checkout, their orders.
import { Router } from 'express';
import { z } from 'zod';
import { all, one, run } from '../db';
import { drones } from '../drone/manager';
import { HttpError, requireAuth } from '../lib/auth';
import { cancelOrder, createOrder, getOrderDetail, listOrders, quote, sendClearance } from '../orders';
import { emitOrderUpdate, emitToOps } from '../realtime';
import { activeSubscription, planPrice, PLANS, subscribe, type PlanId } from '../subscription';
import { maskDoc, WELFARE_DISCOUNT, WELFARE_LABEL, type WelfareRow } from '../welfare';

export const customerRoutes = Router();
customerRoutes.use(requireAuth);

const idParam = (v: string | string[] | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, 'Bad id');
  return n;
};

// ---------- Addresses ----------

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  line: z.string().trim().min(3).max(200),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

customerRoutes.get('/addresses', (req, res) => {
  res.json(all('SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC', req.user!.id));
});

customerRoutes.post('/addresses', (req, res) => {
  const a = addressSchema.parse(req.body);
  const { id } = run('INSERT INTO addresses (user_id, label, line, lat, lon) VALUES (?, ?, ?, ?, ?)', req.user!.id, a.label, a.line, a.lat, a.lon);
  res.status(201).json({ id, ...a });
});

customerRoutes.delete('/addresses/:id', (req, res) => {
  run('DELETE FROM addresses WHERE id = ? AND user_id = ?', idParam(req.params.id), req.user!.id);
  res.status(204).end();
});

// ---------- Checkout ----------

const itemsSchema = z.array(z.object({ productId: z.number().int(), qty: z.number().int().min(1).max(20) })).max(30);

customerRoutes.post('/orders/quote', (req, res) => {
  const body = z
    .object({ items: itemsSchema, lat: z.number().optional(), lon: z.number().optional() })
    .parse(req.body);
  res.json(quote(body, req.user!.id));
});

const orderSchema = z.object({
  items: itemsSchema.min(1),
  lat: z.number(),
  lon: z.number(),
  addressLabel: z.string().trim().min(1).max(40),
  addressLine: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(300).optional(),
  rxImage: z
    .string()
    .max(3_000_000, 'Prescription image is too large (max ~2 MB)')
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Prescription must be an image')
    .optional(),
  saveAddress: z.boolean().optional(),
  groundAltM: z.number().min(-500).max(9000).optional(),
});

customerRoutes.post('/orders', (req, res) => {
  const body = orderSchema.parse(req.body);
  const id = createOrder(req.user!.id, body);
  if (body.saveAddress) {
    run('INSERT INTO addresses (user_id, label, line, lat, lon) VALUES (?, ?, ?, ?, ?)', req.user!.id, body.addressLabel, body.addressLine, body.lat, body.lon);
  }
  res.status(201).json(getOrderDetail(id));
});

// ---------- My orders ----------

customerRoutes.get('/orders', (req, res) => {
  res.json(listOrders({ userId: req.user!.id }));
});

function ownedDetail(id: number, user: Express.Request['user']) {
  const d = getOrderDetail(id);
  if (!d || (user!.role !== 'operator' && d.user_id !== user!.id)) throw new HttpError(404, 'Order not found');
  return d;
}

customerRoutes.get('/orders/:id', (req, res) => {
  const d = ownedDetail(idParam(req.params.id), req.user);
  const telemetry = d.drone_id ? drones.telemetry(d.drone_id) : null;
  res.json({ ...d, telemetry: telemetry && telemetry.missionId === d.mission_id ? telemetry : null });
});

customerRoutes.post('/orders/:id/cancel', (req, res) => {
  const id = idParam(req.params.id);
  cancelOrder(id, req.user!.id);
  res.json(getOrderDetail(id));
});

customerRoutes.post('/orders/:id/clearance', async (req, res) => {
  const id = idParam(req.params.id);
  ownedDetail(id, req.user);
  await sendClearance(id);
  res.json(getOrderDetail(id));
});

customerRoutes.post('/orders/:id/rate', (req, res) => {
  const id = idParam(req.params.id);
  const { rating, feedback } = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().trim().max(500).optional() }).parse(req.body);
  const d = ownedDetail(id, req.user);
  if (d.status !== 'delivered') throw new HttpError(409, 'You can rate an order once it is delivered');
  run('UPDATE orders SET rating = ?, feedback = ? WHERE id = ?', rating, feedback ?? null, id);
  emitOrderUpdate(id);
  res.json(getOrderDetail(id));
});

// ---------- Welfare subsidy ----------

const publicWelfare = (w: WelfareRow | undefined) =>
  w ? { ...w, doc_id: maskDoc(w.doc_id), discountPct: WELFARE_DISCOUNT[w.category], label: WELFARE_LABEL[w.category] } : null;

customerRoutes.get('/welfare', (req, res) => {
  res.json(publicWelfare(one<WelfareRow>('SELECT * FROM welfare WHERE user_id = ?', req.user!.id)));
});

customerRoutes.post('/welfare', (req, res) => {
  const body = z
    .object({
      category: z.enum(['BPL', 'SC', 'ST', 'EWS']),
      docId: z.string().trim().min(4).max(40),
      fullName: z.string().trim().min(2).max(80),
      location: z.string().trim().min(3).max(120),
    })
    .parse(req.body);
  run(
    `INSERT INTO welfare (user_id, category, doc_id, full_name, location, status) VALUES (?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(user_id) DO UPDATE SET category = excluded.category, doc_id = excluded.doc_id, full_name = excluded.full_name,
       location = excluded.location, status = 'pending', note = NULL, created_at = datetime('now'), reviewed_at = NULL`,
    req.user!.id, body.category, body.docId, body.fullName, body.location,
  );
  emitToOps('welfare:new', { name: body.fullName, category: body.category });
  res.status(201).json(publicWelfare(one<WelfareRow>('SELECT * FROM welfare WHERE user_id = ?', req.user!.id)));
});

customerRoutes.delete('/welfare', (req, res) => {
  run('DELETE FROM welfare WHERE user_id = ?', req.user!.id);
  res.status(204).end();
});

// ---------- MediDrop Care plan (subscription) ----------

const planState = (userId: number) => ({
  current: activeSubscription(userId),
  plans: PLANS.map((p) => ({ ...p, price: planPrice(p, userId) })),
});

customerRoutes.get('/subscription', (req, res) => {
  res.json(planState(req.user!.id));
});

customerRoutes.post('/subscription', (req, res) => {
  const { plan } = z.object({ plan: z.enum(PLANS.map((p) => p.id) as [PlanId, ...PlanId[]]) }).parse(req.body);
  subscribe(req.user!.id, plan);
  res.status(201).json(planState(req.user!.id));
});

customerRoutes.delete('/subscription', (req, res) => {
  run(`UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ?`, req.user!.id);
  res.json(planState(req.user!.id));
});
