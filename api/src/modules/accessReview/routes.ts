import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { sensitiveActionLimit } from '../../middleware/security';
import validate from '../../middleware/validate';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit } from '../../services/auditWriter';
import { AppError, ConflictError } from '../../errors';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
import {
  ROSTER_LIMIT,
  STALE_DAYS,
  assertCompleteRoster,
  activityFinding,
  snapshotHash,
} from './policy';

async function report(client: PoolClient) {
  const now = (await client.query('SELECT NOW() AS now')).rows[0].now as Date;
  const result = await client.query(
    `SELECT u.id,u.organization_id,u.name,u.email,u.active,u.created_at,
    u.access_suspended_at,o.name AS organization_name,o.access_suspended_at AS organization_suspended_at,
    o.verification_status, (SELECT MAX(COALESCE(s.last_seen_at,s.created_at)) FROM sessions s WHERE s.user_id=u.id) AS last_retained_activity_at
    FROM users u JOIN organizations o ON o.id=u.organization_id
    WHERE EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND '*'=ANY(r.permissions))
    ORDER BY u.id LIMIT $1`,
    [ROSTER_LIMIT + 1],
  );
  assertCompleteRoster(result.rows);
  const rows = result.rows.map((row) => ({
    ...row,
    activityFinding: activityFinding(row.last_retained_activity_at?.toISOString() || null, now),
  }));
  const snapshot = {
    version: 1,
    staleDays: STALE_DAYS,
    rows,
    counts: {
      total: rows.length,
      unavailable: rows.filter(
        (r) =>
          !r.active ||
          r.access_suspended_at ||
          r.organization_suspended_at ||
          r.verification_status !== 'verified',
      ).length,
      unknownActivity: rows.filter((r) => r.activityFinding === 'unknown').length,
      staleRetainedEvidence: rows.filter((r) => r.activityFinding === 'stale_retained_evidence')
        .length,
    },
  };
  const latest =
    (
      await client.query(
        'SELECT id,reviewed_at,next_due_at,snapshot_hash FROM access_reviews ORDER BY reviewed_at DESC,id DESC LIMIT 1',
      )
    ).rows[0] || null;
  return {
    generatedAt: now.toISOString(),
    snapshot,
    snapshotHash: snapshotHash(snapshot),
    latestReview: latest,
    due: !latest || new Date(latest.next_due_at) <= now,
  };
}
const body = z
  .object({
    reason: z.string().trim().min(10).max(1000),
    confirmed: z.literal(true),
    expectedSnapshotHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();
const router = Router();
router.use(
  '/admin/access-review',
  (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  requireAuth,
  requirePermission('*'),
);
router.get('/admin/access-review', async (_req, res) =>
  res.json(await inDatabaseTransaction(report)),
);
router.post('/admin/access-review', sensitiveActionLimit, validate(body), async (req, res) => {
  const input = body.parse(req.body),
    actor = req.user!;
  const receipt = await inDatabaseTransaction(async (client) => {
    await lockAccessDecisions(client);
    await assertMutationAssurance(client, actor);
    const live = await client.query(
      `SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
      JOIN sessions s ON s.user_id=u.id WHERE u.id=$1 AND u.organization_id=$2 AND s.id=$3
      AND u.active AND u.access_suspended_at IS NULL AND o.access_suspended_at IS NULL AND o.verification_status='verified'
      AND s.revoked_at IS NULL AND s.expires_at>NOW()
      AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND '*'=ANY(r.permissions)) FOR SHARE OF u,o,s`,
      [actor.id, actor.organizationId, actor.sessionId],
    );
    if (!live.rows[0])
      throw new AppError('Administrator authorization changed', 403, 'ADMIN_AUTHORIZATION_CHANGED');
    const current = await report(client);
    if (current.snapshotHash !== input.expectedSnapshotHash)
      throw new ConflictError('Privileged roster or findings changed; reload and review again');
    const saved = (
      await client.query(
        `INSERT INTO access_reviews(actor_user_id,actor_organization_id,reason,snapshot,snapshot_hash)
      VALUES($1,$2,$3,$4,$5) RETURNING id,reviewed_at,next_due_at,snapshot_hash`,
        [
          actor.id,
          actor.organizationId,
          input.reason,
          JSON.stringify(current.snapshot),
          current.snapshotHash,
        ],
      )
    ).rows[0];
    await recordAudit(client, actor, 'access.review.recorded', 'access_review', saved.id, {
      reason: input.reason,
      snapshotHash: current.snapshotHash,
      counts: current.snapshot.counts,
      nextDueAt: saved.next_due_at,
    });
    return { ...saved, snapshot: current.snapshot };
  });
  res.status(201).json(receipt);
});
export default router;
