import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export type Role = 'customer' | 'operator';
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string | undefined): AuthUser | undefined {
  if (!token) return undefined;
  try {
    const { id, name, email, role } = jwt.verify(token, config.jwtSecret) as AuthUser;
    return { id, name, email, role };
  } catch {
    return undefined;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const user = verifyToken(header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!user) throw new HttpError(401, 'Please log in');
  req.user = user;
  next();
}

export function requireOperator(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user!.role !== 'operator') throw new HttpError(403, 'Operators only');
    next();
  });
}
