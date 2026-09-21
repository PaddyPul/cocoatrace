import { Request, Response, NextFunction } from 'express';

type Counter = { count: number; resetAt: number };
const attempts = new Map<string, Counter>();

export function sensitiveActionLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = `${req.ip}:${req.path}`;
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
  const permitted = process.env.WEB_URL || 'http://localhost:3000';
  if (origin && origin !== permitted) {
    res.status(403).json({ error: 'Request origin is not permitted' });
    return;
  }
  next();
}
