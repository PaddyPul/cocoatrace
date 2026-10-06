import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { AppError } from '../errors';
import {
  checkSensitiveAction,
  PostgresRateStore,
  type RateStore,
} from '../modules/security/rateLimits';
import { bearerToken, sessionCookie } from './credentials';

export function sensitiveLimiter(store: RateStore) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const decision = await checkSensitiveAction(req, store);
      res.setHeader('RateLimit-Limit', String(decision.limit));
      res.setHeader('RateLimit-Remaining', String(decision.remaining));
      res.setHeader('RateLimit-Reset', String(decision.resetAt));
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        res
          .status(429)
          .json({ error: 'Too many attempts. Try again later.', code: 'AUTH_RATE_LIMITED' });
        return;
      }
      next();
    } catch {
      // A shared-store outage must never silently disable abuse protection.
      next(
        new AppError(
          'Authentication protection is temporarily unavailable. Try again later.',
          503,
          'AUTH_RATE_LIMIT_UNAVAILABLE',
        ),
      );
    }
  };
}
export const sensitiveActionLimit = sensitiveLimiter(new PostgresRateStore());

export function verifyBrowserOrigin(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const permitted = new URL(config.webUrl).origin;
  // Any supplied source origin must match configured identity, never Host/X-Forwarded-*.
  // Literal null, subdomain tricks, paths and absent origins on cookie writes fail closed.
  const cookieAuthentication =
    req.headers.authorization === undefined
      ? sessionCookie(req) !== undefined
      : !bearerToken(req) && sessionCookie(req) !== undefined;
  if (
    (origin !== undefined && origin !== permitted) ||
    (cookieAuthentication && origin === undefined)
  ) {
    res
      .status(403)
      .json({ error: 'Request origin is not permitted', code: 'ORIGIN_NOT_PERMITTED' });
    return;
  }
  next();
}
