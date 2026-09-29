import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

const jwtSecret = config.jwtSecret;

export interface JwtPayload {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  orgName: string;
  orgType: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const cookieToken = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('ct_session='))?.slice('ct_session='.length);
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(decodeURIComponent(token), jwtSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const perms = req.user?.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: `Permission required: ${permission}` });
  };
}

function requireAnyPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const perms = req.user?.permissions || [];
    if (perms.includes('*') || permissions.some((permission) => perms.includes(permission))) {
      next();
      return;
    }
    res.status(403).json({ error: `One of these permissions is required: ${permissions.join(', ')}` });
  };
}

function signToken(payload: object): string {
  return jwt.sign(payload, jwtSecret, { expiresIn: '24h' });
}

export { requireAuth, requirePermission, requireAnyPermission, signToken };
