import { Request, Response, NextFunction } from 'express';
import { bypassPath } from '../modules/mfa/policy';
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
  if (!bypassPath(req.originalUrl.split('?')[0]) && actor.mfa?.required) {
    if (!actor.mfa.verified) {
      res.status(403).json({
        error: actor.mfa.enrolled
          ? 'Verify your passkey to continue'
          : 'Enroll a passkey to continue',
        code: 'MFA_REQUIRED',
      });
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !actor.mfa.fresh) {
      res
        .status(403)
        .json({ error: 'Verify your passkey again for this action', code: 'MFA_STEP_UP_REQUIRED' });
      return;
    }
  }
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
