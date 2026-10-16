import type { PoolClient } from 'pg';
import { AppError, NotFoundError } from '../../errors';
import type { AuthenticatedActor } from '../../services/authSessionService';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { loadTradeActions } from '../../services/tradeActionRepository';
import { assertMutationAssurance } from '../mfa/assurance';
import { lockAccessDecisions } from '../mfa/reviewers';
import { cursorOffset, hash, notice, pageInput } from './policy';
async function liveActor(client: PoolClient, actor: AuthenticatedActor) {
  await lockAccessDecisions(client);
  const identity = (
    await client.query(
      `SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id JOIN sessions s ON s.user_id=u.id
    WHERE u.id=$1 AND u.organization_id=$2 AND s.id=$3 AND u.active AND u.access_suspended_at IS NULL
    AND o.access_suspended_at IS NULL AND o.verification_status='verified' AND s.revoked_at IS NULL AND s.expires_at>NOW()
    FOR SHARE OF u,o,s`,
      [actor.id, actor.organizationId, actor.sessionId],
    )
  ).rows[0];
  if (!identity) throw new AppError('Account authorization changed', 403, 'FORBIDDEN');
  const grants = (
    await client.query(
      `SELECT DISTINCT unnest(r.permissions) permission FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1`,
      [actor.id],
    )
  ).rows;
  return { ...actor, permissions: grants.map((row) => String(row.permission)) };
}
async function snapshot(client: PoolClient, actor: AuthenticatedActor) {
  const actions = await loadTradeActions(actor, undefined, client.query.bind(client), 1000);
  if (actions.length > 1000)
    throw new AppError(
      'Current notifications exceed the supported scope',
      503,
      'NOTICE_SCOPE_EXCEEDED',
    );
  const notices = actions.map(notice);
  const receipts = new Set(
    (
      await client.query(
        'SELECT fingerprint FROM notification_reads WHERE user_id=$1 AND organization_id=$2 AND fingerprint=ANY($3::text[])',
        [actor.id, actor.organizationId, notices.map((item) => item.fingerprint)],
      )
    ).rows.map((row) => row.fingerprint),
  );
  return notices
    .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint))
    .map((item) => ({ ...item, read: receipts.has(item.fingerprint) }));
}
export async function notificationFeed(
  actor: AuthenticatedActor,
  parameters?: Record<string, unknown>,
) {
  return inDatabaseTransaction(async (client) => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const live = await liveActor(client, actor);
    const items = await snapshot(client, live);
    const revision = hash(items.map((item) => [item.fingerprint, item.read]));
    if (!parameters)
      return {
        currentCount: items.length,
        unreadCount: items.filter((item) => !item.read).length,
        revision,
      };
    const input = pageInput(parameters);
    const scope = hash([actor.id, actor.organizationId, input.filter, input.limit]);
    const offset = cursorOffset(input.cursor, scope, revision);
    const filtered = items.filter((item) => input.filter === 'all' || !item.read);
    const page = filtered.slice(offset, offset + input.limit);
    const hasMore = offset + input.limit < filtered.length;
    return {
      currentCount: items.length,
      unreadCount: items.filter((item) => !item.read).length,
      items: page,
      hasMore,
      nextCursor: hasMore
        ? Buffer.from(JSON.stringify({ scope, revision, offset: offset + input.limit })).toString(
            'base64url',
          )
        : null,
      revision,
    };
  });
}
export async function setNoticeRead(actor: AuthenticatedActor, fingerprint: string, read: boolean) {
  return inDatabaseTransaction(async (client) => {
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const live = await liveActor(client, actor);
    await assertMutationAssurance(client, live);
    if (!(await snapshot(client, live)).some((item) => item.fingerprint === fingerprint))
      throw new NotFoundError('Current notification');
    if (read)
      await client.query(
        'INSERT INTO notification_reads(user_id,organization_id,fingerprint) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [actor.id, actor.organizationId, fingerprint],
      );
    else
      await client.query(
        'DELETE FROM notification_reads WHERE user_id=$1 AND organization_id=$2 AND fingerprint=$3',
        [actor.id, actor.organizationId, fingerprint],
      );
    return { fingerprint, read };
  });
}
