// Socket.IO: pushes live drone telemetry and order updates to the browser.
// Rooms: 'ops' (all operators) and 'order:<id>' (whoever is tracking that order).
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { one } from './db';
import { drones } from './drone/manager';
import type { DroneTelemetry } from './drone/types';
import { verifyToken } from './lib/auth';
import { getOrderDetail } from './orders';

let io: Server | null = null;
const missionToOrder = new Map<number, number>();

function orderForMission(missionId: number | null): number | undefined {
  if (missionId == null) return undefined;
  if (!missionToOrder.has(missionId)) {
    const row = one<{ order_id: number }>('SELECT order_id FROM missions WHERE id = ?', missionId);
    if (row) missionToOrder.set(missionId, row.order_id);
  }
  return missionToOrder.get(missionId);
}

export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: true } });

  io.on('connection', (socket) => {
    const user = verifyToken(socket.handshake.auth?.token);
    if (user?.role === 'operator') {
      socket.join('ops');
      socket.emit('fleet', drones.allTelemetry());
    }

    socket.on('track', (orderId: number) => {
      const order = one<{ user_id: number; mission_id: number | null; drone_id: string | null }>(
        'SELECT user_id, mission_id, drone_id FROM orders WHERE id = ?',
        orderId,
      );
      if (!order || !user || (user.role !== 'operator' && order.user_id !== user.id)) return;
      socket.join(`order:${orderId}`);
      if (order.drone_id) {
        const t = drones.telemetry(order.drone_id);
        if (t && t.missionId === order.mission_id) socket.emit('telemetry', t);
      }
    });

    socket.on('untrack', (orderId: number) => socket.leave(`order:${orderId}`));
  });

  drones.on('telemetry', (t: DroneTelemetry) => {
    io!.to('ops').emit('telemetry', t);
    const orderId = orderForMission(t.missionId);
    if (orderId) io!.to(`order:${orderId}`).emit('telemetry', t);
  });
}

/** Tell everyone watching that an order changed (status, phase, new event). */
export function emitOrderUpdate(orderId: number) {
  if (!io) return;
  const detail = getOrderDetail(orderId);
  if (!detail) return;
  io.to(`order:${orderId}`).to('ops').emit('order:update', detail);
}
