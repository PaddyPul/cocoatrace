import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { config } from '../../config/env';
import { query } from '../../db';

export const sensitiveWindowSeconds = 15 * 60;
export const sensitiveTargetLimit = 10;
export const sensitiveIpLimit = 100;

export interface RateDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}
export interface RateStore {
  consume(key: string, limit: number, prune?: boolean): Promise<RateDecision>;
}

/** Shared counters use database time and atomic upserts; no per-process bypass. */
export class PostgresRateStore implements RateStore {
  async consume(key: string, limit: number, prune = false): Promise<RateDecision> {
    const result = await query(
      `
      WITH expired AS (
        DELETE FROM auth_rate_limits WHERE bucket_key IN (
          SELECT bucket_key FROM auth_rate_limits
          WHERE expires_at < statement_timestamp() AND bucket_key <> $1 AND $4::boolean
          ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
        )
      )
      INSERT INTO auth_rate_limits AS counter (bucket_key,attempts,expires_at)
      VALUES ($1,1,statement_timestamp()+make_interval(secs=>$3))
      ON CONFLICT (bucket_key) DO UPDATE SET
        attempts=CASE WHEN counter.expires_at<=statement_timestamp() THEN 1
                      ELSE LEAST(counter.attempts+1,$2+1) END,
        expires_at=CASE WHEN counter.expires_at<=statement_timestamp()
                       THEN statement_timestamp()+make_interval(secs=>$3) ELSE counter.expires_at END
      RETURNING attempts,extract(epoch FROM expires_at)::float8 AS reset_at,
        GREATEST(1,ceil(extract(epoch FROM expires_at-statement_timestamp())))::integer AS retry_after`,
      [key, limit, sensitiveWindowSeconds, prune],
    );
    const row = result.rows[0] as
      | { attempts: number; reset_at: number; retry_after: number }
      | undefined;
    if (!row) throw new Error('Rate limit counter was not returned');
    return {
      allowed: row.attempts <= limit,
      limit,
      remaining: Math.max(0, limit - row.attempts),
      resetAt: Math.ceil(row.reset_at),
      retryAfterSeconds: row.retry_after,
    };
  }
}

/** Keyed hashes avoid persisting raw addresses, account emails or secret tokens. */
export function rateKey(operation: string, scope: string, target: string): string {
  return createHmac('sha256', config.jwtSecret)
    .update(JSON.stringify([operation, scope, target]))
    .digest('hex');
}

export function targetFor(req: Request, operation: string): string | undefined {
  if (req.user) return `user:${req.user.id}`;
  // Only the route's actual identity field may select the target. An attacker
  // must not rotate ignored JSON fields to bypass a token/account budget.
  if (operation === '/auth/login' || operation === '/auth/password/forgot') {
    return typeof req.body?.email === 'string'
      ? `email:${req.body.email.trim().toLowerCase()}`
      : undefined;
  }
  if (operation === '/auth/request-access') {
    return typeof req.body?.adminEmail === 'string'
      ? `email:${req.body.adminEmail.trim().toLowerCase()}`
      : undefined;
  }
  if (operation === '/auth/invitations/:token/accept') {
    return typeof req.params?.token === 'string' ? `token:${req.params.token}` : undefined;
  }
  if (operation === '/auth/password/reset' || operation === '/auth/request-access/verify') {
    return typeof req.body?.token === 'string' ? `token:${req.body.token}` : undefined;
  }
  return undefined;
}

export async function checkSensitiveAction(req: Request, store: RateStore): Promise<RateDecision> {
  // Route templates, not raw paths containing invitation/reset secrets.
  const operation = typeof req.route?.path === 'string' ? req.route.path : req.path;
  const ip = await store.consume(
    rateKey(operation, 'ip', req.ip || 'unknown'),
    sensitiveIpLimit,
    true,
  );
  // Stop before creating more target buckets once this IP reaches its budget.
  if (!ip.allowed) return ip;
  const target = targetFor(req, operation);
  if (target === undefined) return ip;
  return store.consume(rateKey(operation, 'target', target), sensitiveTargetLimit);
}
