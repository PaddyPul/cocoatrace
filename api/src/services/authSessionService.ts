import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { query } from '../db';

const sessionLifetimeSeconds = 24 * 60 * 60;

export interface AuthenticatedActor {
  id: string;
  sessionId: string;
  organizationId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  orgName: string;
  orgType: string;
}

type TokenClaims = jwt.JwtPayload & { sub: string; sid: string };

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<{ token: string; actor: AuthenticatedActor }> {
  const actor = await loadCurrentActor(userId);
  if (!actor) throw new Error('Cannot create a session for an inactive or unapproved account');
  const sessionId = crypto.randomUUID();
  const token = jwt.sign({ sub: actor.id, sid: sessionId }, config.jwtSecret, {
    expiresIn: sessionLifetimeSeconds,
    issuer: 'cocoatrace-api',
    audience: 'cocoatrace',
  });
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);
  await query(
    `INSERT INTO sessions(id,user_id,token_hash,expires_at,last_seen_at)
     VALUES ($1,$2,$3,$4,NOW())`,
    [sessionId, actor.id, hashSessionToken(token), expiresAt],
  );
  return { token, actor: { ...actor, sessionId } };
}

async function loadCurrentActor(userId: string): Promise<Omit<AuthenticatedActor, 'sessionId'> | null> {
  const { rows } = await query(
    `SELECT u.id,u.organization_id,u.email,u.name,o.name AS org_name,o.type AS org_type,
            array_remove(array_agg(DISTINCT r.name),NULL) AS roles,
            array_remove(array_agg(DISTINCT permission),NULL) AS permissions
       FROM users u
       JOIN organizations o ON o.id=u.organization_id
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles r ON r.id=ur.role_id
       LEFT JOIN LATERAL unnest(r.permissions) permission ON TRUE
      WHERE u.id=$1 AND u.active=TRUE AND o.verification_status='verified'
      GROUP BY u.id,o.id`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.name,
    roles: row.roles || [],
    permissions: row.permissions || [],
    orgName: row.org_name,
    orgType: row.org_type,
  };
}

export async function authenticateSession(token: string): Promise<AuthenticatedActor | null> {
  let claims: TokenClaims;
  try {
    const verified = jwt.verify(token, config.jwtSecret, { issuer: 'cocoatrace-api', audience: 'cocoatrace' });
    if (typeof verified === 'string' || typeof verified.sub !== 'string' || typeof verified.sid !== 'string') return null;
    claims = verified as TokenClaims;
  } catch {
    return null;
  }

  const session = await query(
    `SELECT id,user_id FROM sessions
      WHERE id=$1 AND user_id=$2 AND token_hash=$3 AND revoked_at IS NULL AND expires_at>NOW()`,
    [claims.sid, claims.sub, hashSessionToken(token)],
  );
  if (!session.rows[0]) return null;
  const actor = await loadCurrentActor(claims.sub);
  if (!actor) return null;
  await query(
    `UPDATE sessions SET last_seen_at=NOW()
      WHERE id=$1 AND (last_seen_at IS NULL OR last_seen_at<NOW()-INTERVAL '5 minutes')`,
    [claims.sid],
  );
  return { ...actor, sessionId: claims.sid };
}

export async function revokeSession(sessionId: string, reason = 'logout'): Promise<boolean> {
  const result = await query(
    `UPDATE sessions SET revoked_at=COALESCE(revoked_at,NOW()),revoked_reason=COALESCE(revoked_reason,$2)
      WHERE id=$1 RETURNING id`,
    [sessionId, reason],
  );
  return Boolean(result.rows[0]);
}

export async function revokeUserSessions(userId: string, reason: string, exceptSessionId?: string): Promise<number> {
  const result = await query(
    `UPDATE sessions SET revoked_at=NOW(),revoked_reason=$2
      WHERE user_id=$1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id<>$3::uuid)`,
    [userId, reason, exceptSessionId || null],
  );
  return result.rowCount || 0;
}
