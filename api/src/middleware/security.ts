import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { config } from '../config/env';

type Counter = { count: number; resetAt: number };
const attempts = new Map<string, Counter>();

export function sensitiveActionLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  // Keep independent buckets per client IP and account/token target. This
  // prevents one user's failed attempts from locking out unrelated users and
  // makes the limiter safe for sequential integration and staging tests.
  const email = typeof req.body?.email === 'string' ? req.body.email
    : typeof req.body?.adminEmail === 'string' ? req.body.adminEmail : undefined;
  const token = typeof req.params?.token === 'string' ? req.params.token
    : typeof req.body?.token === 'string' ? req.body.token : undefined;
  // Verification/reset tokens are sent in JSON bodies, not only URL params.
  // Hash full targets so credentials are not retained and prefixes cannot collide.
  const target = email !== undefined
    ? `email:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`
    : token !== undefined
      ? `token:${createHash('sha256').update(token).digest('hex')}`
      : 'anonymous';
  const key = `${req.ip}:${req.path}:${target}`;
  const current = attempts.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + 15 * 60_000 } : current;
  entry.count += 1;
  attempts.set(key, entry);
  res.setHeader('RateLimit-Limit', '10');
  res.setHeader('RateLimit-Remaining', String(Math.max(0, 10 - entry.count)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  if (entry.count > 10) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' });
    return;
  }
  if (attempts.size > 10_000) {
    for (const [attemptKey, value] of attempts) if (value.resetAt <= now) attempts.delete(attemptKey);
  }
  next();
}

export function verifyBrowserOrigin(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.headers.authorization || !req.headers.cookie?.includes('ct_session=')) { next(); return; }
  const origin = req.headers.origin;
  const permitted = config.webUrl;
  if (origin && origin !== permitted) {
    res.status(403).json({ error: 'Request origin is not permitted' });
    return;
  }
  next();
}
