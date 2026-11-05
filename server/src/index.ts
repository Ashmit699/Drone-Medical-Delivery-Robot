import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { ZodError } from 'zod';
import { config } from './config';
import { isEmpty } from './db';
import { seed } from './db/seed';
import { drones } from './drone/manager';
import { HttpError } from './lib/auth';
import { handlePhase } from './orders';
import { initRealtime } from './realtime';
import { customerRoutes } from './routes/customer';
import { opsRoutes } from './routes/ops';
import { publicRoutes } from './routes/public';

if (isEmpty()) seed();

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', publicRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api', customerRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: `${first.path.join('.') || 'input'}: ${first.message}` });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const server = createServer(app);
initRealtime(server);
drones.load();
drones.on('phase', handlePhase);

server.listen(config.port, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Aerolift API on http://localhost:${config.port}${lan ? `  (LAN: http://${lan}:${config.port})` : ''}`);
  console.log(`Simulator speed ×${config.simSpeed}. Hub at ${config.hub.lat}, ${config.hub.lon}`);
});
