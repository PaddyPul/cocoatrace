import { Request, Response, NextFunction } from 'express';
import { sessionCredential } from './credentials';
import { authenticateSession, AuthenticatedActor } from '../services/authSessionService';

export type JwtPayload = AuthenticatedActor;

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      authToken?: string;
    }
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = sessionCredential(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const actor = await authenticateSession(token);
  if (!actor) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.user = actor;
  req.authToken = token;
  next();
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
    res
      .status(403)
      .json({ error: `One of these permissions is required: ${permissions.join(', ')}` });
  };
}

export { requireAuth, requirePermission, requireAnyPermission };
