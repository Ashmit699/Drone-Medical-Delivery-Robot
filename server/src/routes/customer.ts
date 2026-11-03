// Routes for logged-in customers: addresses, quotes, checkout, their orders.
import { Router } from 'express';
import { z } from 'zod';
import { all, run } from '../db';
import { drones } from '../drone/manager';
import { HttpError, requireAuth } from '../lib/auth';
import { cancelOrder, createOrder, getOrderDetail, listOrders, quote, sendClearance } from '../orders';
import { emitOrderUpdate } from '../realtime';

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
const prioritySchema = z.enum(['standard', 'express', 'emergency']);

customerRoutes.post('/orders/quote', (req, res) => {
  const body = z
    .object({ items: itemsSchema, lat: z.number().optional(), lon: z.number().optional(), priority: prioritySchema.default('standard') })
    .parse(req.body);
  res.json(quote(body));
});

const orderSchema = z.object({
  items: itemsSchema.min(1),
  priority: prioritySchema,
  lat: z.number(),
  lon: z.number(),
  addressLabel: z.string().trim().min(1).max(40),
  addressLine: z.string().trim().min(3).max(200),
  paymentMethod: z.enum(['upi', 'wallet', 'account']),
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
