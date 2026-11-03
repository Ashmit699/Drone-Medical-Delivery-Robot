// Routes anyone can call: auth, catalogue, app config.
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { all, one, run } from '../db';
import { HttpError, requireAuth, signToken, type AuthUser, type Role } from '../lib/auth';
import { offsetM } from '../lib/geo';

export const publicRoutes = Router();

publicRoutes.get('/config', (_req, res) => {
  const half = config.demoAreaHalfSideKm * 1000;
  const sw = offsetM(config.hub, -half, -half);
  const ne = offsetM(config.hub, half, half);
  res.json({
    hub: config.hub,
    serviceRadiusKm: config.serviceRadiusKm,
    demoArea: { south: sw.lat, west: sw.lon, north: ne.lat, east: ne.lon, areaKm2: +((2 * config.demoAreaHalfSideKm) ** 2).toFixed(2) },
    maxPayloadG: config.maxPayloadG,
    fees: config.fees,
    perKmFee: config.perKmFee,
    includedKm: config.includedKm,
    flight: config.flight,
  });
});

// ---------- Auth ----------

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email().toLowerCase(),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(6).max(100),
});

publicRoutes.post('/auth/register', (req, res) => {
  const body = registerSchema.parse(req.body);
  if (one('SELECT id FROM users WHERE email = ?', body.email)) throw new HttpError(409, 'That email is already registered');
  const { id } = run(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    body.name, body.email, body.phone ?? null, bcrypt.hashSync(body.password, 10), 'customer',
  );
  const user: AuthUser = { id, name: body.name, email: body.email, role: 'customer' };
  res.status(201).json({ token: signToken(user), user });
});

publicRoutes.post('/auth/login', (req, res) => {
  const { email, password } = z.object({ email: z.string().trim().toLowerCase(), password: z.string() }).parse(req.body);
  const row = one<{ id: number; name: string; email: string; role: Role; password_hash: string }>('SELECT * FROM users WHERE email = ?', email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) throw new HttpError(401, 'Wrong email or password');
  const user: AuthUser = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ token: signToken(user), user });
});

publicRoutes.get('/auth/me', requireAuth, (req, res) => {
  res.json(one('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', req.user!.id));
});

// ---------- Catalogue ----------

publicRoutes.get('/categories', (_req, res) => {
  res.json(all('SELECT category AS name, COUNT(*) AS count FROM products GROUP BY category ORDER BY MIN(id)'));
});

publicRoutes.get('/products', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const sort = req.query.sort;
  const order =
    sort === 'price_asc' ? 'price ASC' : sort === 'price_desc' ? 'price DESC' : sort === 'weight' ? 'weight_g ASC' : 'id ASC';
  const like = `%${q}%`;
  res.json(
    all(
      `SELECT * FROM products
        WHERE (? = '' OR category = ?)
          AND (? = '' OR name LIKE ? OR description LIKE ? OR tags LIKE ?)
        ORDER BY ${order}`,
      category, category, q, like, like, like,
    ),
  );
});

publicRoutes.get('/products/:slug', (req, res) => {
  const p = one<{ category: string; id: number }>('SELECT * FROM products WHERE slug = ?', req.params.slug);
  if (!p) throw new HttpError(404, 'Product not found');
  const related = all('SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4', p.category, p.id);
  res.json({ ...p, related });
});
