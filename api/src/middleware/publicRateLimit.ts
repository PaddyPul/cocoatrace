import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { checkPublicAction, type PublicOperation } from '../modules/security/publicRateLimits';
import { PostgresRateStore, type RateStore } from '../modules/security/rateLimits';

export function publicActionLimiter(
  operation: PublicOperation,
  store: RateStore = new PostgresRateStore(),
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const decision = await checkPublicAction(req, store, operation);
      res.setHeader('RateLimit-Limit', String(decision.limit));
      res.setHeader('RateLimit-Remaining', String(decision.remaining));
      res.setHeader('RateLimit-Reset', String(decision.resetAt));
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        res
          .status(429)
          .json({ error: 'Too many requests. Try again later.', code: 'RESOURCE_RATE_LIMITED' });
        return;
      }
      next();
    } catch {
      next(
        new AppError(
          'Request protection is temporarily unavailable. Try again later.',
          503,
          'RESOURCE_RATE_LIMIT_UNAVAILABLE',
        ),
      );
    }
  };
}
