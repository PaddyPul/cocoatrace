import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { JwtPayload } from '../../middleware/auth';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../errors';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import { recordAudit, type AuditActor } from '../../services/auditWriter';
import { assertMutationAssurance } from '../mfa/assurance';
import { textInput } from '../fees/policy';
export const collectionPolicyVersion = 'seller-predispatch-v3';
export const feeTermsText =
  'The seller pays the snapshotted platform fee before dispatch. A submitted payment reference is not a verified receipt. A time-limited platform credit exception does not cancel the debt. An independently audited platform finance write-off waives the debt; it is not a payment receipt. Cancellation after fee payment requires platform finance review; no automatic refund is promised. Unpaid invoiced fees block new commitments after seven days while existing trade and safety actions remain available.';
type Row = Record<string, unknown>;
export function feeTermsFingerprint(row: Row): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        collectionPolicyVersion,
        feeTermsText,
        row.id,
        String(row.amount_total),
        row.currency,
        Number(row.currency_minor_units),
        Number(row.rate_bps),
        row.payer_organization_id,
      ]),
    )
    .digest('hex');
}
type AuthorityActor = AuditActor & { permissions: string[]; sessionId?: string };
async function live(client: PoolClient, actor: AuthorityActor, finance = false) {
  await assertMutationAssurance(client, actor);
  if (finance) {
    const assurance = await client.query(
      `SELECT s.id FROM sessions s JOIN user_passkeys k ON k.id=s.mfa_credential_id
      WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>NOW()
      AND k.user_id=s.user_id AND k.revoked_at IS NULL AND s.mfa_verified_at>NOW()-INTERVAL '5 minutes'
      AND s.mfa_verified_at<=NOW() FOR SHARE OF s,k`,
      [actor.sessionId, actor.id],
    );
    if (!assurance.rows.length)
      throw new AppError('Fresh passkey verification required', 403, 'MFA_STEP_UP_REQUIRED');
  }
  const authority = await client.query(
    `SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    JOIN sessions s ON s.user_id=u.id AND s.id=$3 AND s.revoked_at IS NULL AND s.expires_at>NOW()
    WHERE u.id=$1 AND u.organization_id=$2 AND u.active AND u.access_suspended_at IS NULL
    AND o.access_suspended_at IS NULL AND o.verification_status='verified'
    AND (('*'=ANY(r.permissions)) OR ($4 AND 'finance.manage'=ANY(r.permissions)) OR (NOT $4 AND 'offer.respond'=ANY(r.permissions)))
    FOR SHARE OF u,o,ur,r,s`,
    [actor.id, actor.organizationId, actor.sessionId, finance],
  );
  if (!authority.rows.length)
    throw new ForbiddenError('Current commercial or platform finance authority required');
}
export async function assertPlatformFinance(
  client: PoolClient,
  actor: AuthorityActor,
): Promise<void> {
  await live(client, actor, true);
}
async function lock(
  client: PoolClient,
  actor: JwtPayload,
  contractId: string,
  finance = false,
): Promise<Row> {
  const contract = (
    await client.query(
      `SELECT id FROM sales_contracts WHERE id=$1 AND ($3 OR $2 IN(seller_organization_id,buyer_organization_id)) FOR UPDATE`,
      [contractId, actor.organizationId, finance],
    )
  ).rows[0];
  if (!contract) throw new NotFoundError('Fee collection terms');
  const row = (
    await client.query(
      `SELECT f.*,t.terms_accepted_at,t.accepted_fingerprint,t.terms_accepted_by,t.credit_until,t.credit_reason,t.credit_revision,
    (t.credit_until>NOW() AND t.credit_granted_by IS NOT NULL AND length(trim(t.credit_reason))>=10) credit_active,
    (f.status='paid' AND f.paid_at IS NOT NULL AND f.verified_by_user_id IS NOT NULL AND f.platform_receipt_reference IS NOT NULL
      AND EXISTS(SELECT 1 FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified')) receipt_verified
    FROM platform_fee_invoices f JOIN fee_collection_terms t ON t.fee_id=f.id WHERE f.contract_id=$1 FOR UPDATE OF f,t`,
      [contractId],
    )
  ).rows[0] as Row | undefined;
  if (!row) throw new NotFoundError('Fee collection terms');
  return row;
}
export async function enrollFeePolicy(
  client: PoolClient,
  actor: AuditActor,
  contractId: string,
): Promise<void> {
  const fee = (
    await client.query(
      `UPDATE platform_fee_invoices SET policy_version=$2 WHERE contract_id=$1 RETURNING id`,
      [contractId, collectionPolicyVersion],
    )
  ).rows[0];
  if (!fee) throw new NotFoundError('Fee statement');
  await client.query('INSERT INTO fee_collection_terms(fee_id,policy_version) VALUES($1,$2)', [
    fee.id,
    collectionPolicyVersion,
  ]);
  await recordAudit(client, actor, 'fee.terms.prepare', 'platform_fee_invoice', fee.id, {
    policyVersion: collectionPolicyVersion,
  });
}
export async function readEnforcement(actor: JwtPayload, contractId: string) {
  return inDatabaseTransaction(async (client) => {
    const finance = actor.permissions.some((p) => p === '*' || p === 'finance.manage');
    const contract = (
      await client.query(
        'SELECT id FROM sales_contracts WHERE id=$1 AND ($3 OR $2 IN(seller_organization_id,buyer_organization_id))',
        [contractId, actor.organizationId, finance],
      )
    ).rows[0];
    if (!contract) throw new NotFoundError('Fee collection terms');
    const row = (
      await client.query(
        `SELECT f.policy_version,t.accepted_fingerprint,t.terms_accepted_at,t.credit_until,t.credit_revision,(t.credit_until>NOW() AND t.credit_granted_by IS NOT NULL AND length(trim(t.credit_reason))>=10) credit_active,f.id,f.rate_bps,f.currency_minor_units,f.amount_total::text,f.currency,f.status,f.payer_organization_id,(f.status='paid' AND f.paid_at IS NOT NULL AND f.verified_by_user_id IS NOT NULL AND f.platform_receipt_reference IS NOT NULL AND EXISTS(SELECT 1 FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified')) receipt_verified FROM platform_fee_invoices f LEFT JOIN fee_collection_terms t ON t.fee_id=f.id WHERE f.contract_id=$1`,
        [contractId],
      )
    ).rows[0];
    if (!row) throw new NotFoundError('Fee statement');
    if (['seller-completion-v2', 'legacy-recorded'].includes(String(row.policy_version)))
      return { enforced: false, terms: feeTermsText };
    if (row.policy_version !== collectionPolicyVersion || row.credit_revision === null)
      throw new AppError(
        'Platform fee collection terms are unavailable; contact finance',
        409,
        'FEE_TERMS_UNAVAILABLE',
      );
    return {
      enforced: true,
      terms: feeTermsText,
      ...row,
      ...(row ? { expectedFingerprint: feeTermsFingerprint(row) } : {}),
    };
  });
}
export async function lockFeeOrganizations(
  client: PoolClient,
  organizationIds: string[],
): Promise<void> {
  for (const id of [...new Set(organizationIds)].sort())
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,54109))', [id]);
}
async function lockPayer(client: PoolClient, contractId: string) {
  const row = (
    await client.query(
      'SELECT payer_organization_id FROM platform_fee_invoices WHERE contract_id=$1',
      [contractId],
    )
  ).rows[0];
  if (row?.payer_organization_id) await lockFeeOrganizations(client, [row.payer_organization_id]);
}
export async function consentFeeTerms(
  actor: JwtPayload,
  contractId: string,
  policyVersion: string,
  expectedFingerprint: string,
) {
  if (policyVersion !== collectionPolicyVersion)
    throw new ConflictError('Review current platform fee terms');
  return inDatabaseTransaction(async (client) => {
    await lockPayer(client, contractId);
    await live(client, actor);
    const row = await lock(client, actor, contractId);
    if (row.payer_organization_id !== actor.organizationId)
      throw new ForbiddenError('Only the fee payer can accept fee terms');
    if (feeTermsFingerprint(row) !== expectedFingerprint)
      throw new ConflictError('Fee snapshot changed; review the current platform fee terms');
    if (row.terms_accepted_at) {
      if (row.accepted_fingerprint !== expectedFingerprint)
        throw new ConflictError('Accepted fee terms differ from this snapshot');
      return { accepted: true };
    }
    if (row.status !== 'estimated') throw new ConflictError('Fee terms can no longer be accepted');
    await client.query(
      'UPDATE fee_collection_terms SET terms_accepted_by=$2,terms_accepted_at=NOW(),accepted_fingerprint=$3,updated_at=NOW() WHERE fee_id=$1',
      [row.id, actor.id, expectedFingerprint],
    );
    await client.query(
      "UPDATE platform_fee_invoices SET status='invoiced',due_at=NOW(),invoiced_at=NOW() WHERE id=$1",
      [row.id],
    );
    await recordAudit(client, actor, 'fee.terms.accept', 'platform_fee_invoice', String(row.id), {
      policyVersion,
      amount: row.amount_total,
      currency: row.currency,
      terms: feeTermsText,
    });
    return { accepted: true };
  });
}
export async function setFeeCredit(
  actor: JwtPayload,
  contractId: string,
  input: { reason: string; expectedRevision: number; creditUntil: string | null },
) {
  const reason = textInput(input.reason, 10, 'Credit decision reason');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)
    throw new ValidationError('Invalid credit revision');
  const until = input.creditUntil === null ? null : new Date(input.creditUntil);
  if (
    until &&
    (!Number.isFinite(until.getTime()) ||
      until.getTime() <= Date.now() ||
      until.getTime() > Date.now() + 30 * 86400000)
  )
    throw new ValidationError('Credit must expire within 30 days');
  return inDatabaseTransaction(async (client) => {
    await lockPayer(client, contractId);
    await live(client, actor, true);
    const row = await lock(client, actor, contractId, true);
    if (row.payer_organization_id === actor.organizationId)
      throw new ForbiddenError('The fee payer cannot grant its own credit');
    if (Number(row.credit_revision) !== input.expectedRevision)
      throw new ConflictError('Credit terms changed; review the current decision');
    if (row.status !== 'invoiced' || !row.terms_accepted_at)
      throw new ConflictError('Credit requires accepted invoiced fee terms');
    await client.query(
      'UPDATE fee_collection_terms SET credit_until=$2,credit_reason=$3,credit_granted_by=$4,credit_revision=credit_revision+1,updated_at=NOW() WHERE fee_id=$1',
      [row.id, until, reason, actor.id],
    );
    await recordAudit(
      client,
      actor,
      until ? 'fee.credit.grant' : 'fee.credit.revoke',
      'platform_fee_invoice',
      String(row.id),
      {
        reason,
        creditUntil: until?.toISOString() ?? null,
        previousRevision: input.expectedRevision,
      },
    );
    return { creditRevision: input.expectedRevision + 1 };
  });
}
export async function assertFeeDispatch(client: PoolClient, contractId: string): Promise<void> {
  const row = (
    await client.query(
      `SELECT f.*,t.accepted_fingerprint,t.terms_accepted_at,(t.credit_until>NOW() AND t.credit_granted_by IS NOT NULL AND length(trim(t.credit_reason))>=10) credit_active,
    (f.amount_total=round(c.quantity_kg*c.price_per_kg*f.rate_bps/10000::numeric,f.currency_minor_units)
      AND f.currency=c.currency AND f.currency_minor_units=c.currency_minor_units AND f.fee_payer='seller'
      AND f.payer_organization_id=c.seller_organization_id) snapshot_valid,
    (f.status='written_off' AND f.written_off_at IS NOT NULL AND f.verified_by_user_id IS NOT NULL
      AND length(trim(f.write_off_reason))>=10 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=f.id AND a.action='fee.write_off')) waived,
    (f.status='paid' AND f.paid_at IS NOT NULL AND f.verified_by_user_id IS NOT NULL AND f.platform_receipt_reference IS NOT NULL
      AND EXISTS(SELECT 1 FROM platform_fee_submissions s WHERE s.fee_id=f.id AND s.status='verified')) receipt_verified
    FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id
    LEFT JOIN fee_collection_terms t ON t.fee_id=f.id WHERE f.contract_id=$1 FOR SHARE OF f`,
      [contractId],
    )
  ).rows[0];
  if (!row || ['seller-completion-v2', 'legacy-recorded'].includes(String(row.policy_version)))
    return;
  if (row.policy_version !== collectionPolicyVersion)
    throw new AppError(
      'Unknown platform fee policy requires finance review',
      409,
      'FEE_POLICY_UNKNOWN',
    );
  // Lock policy independently because PostgreSQL cannot lock the nullable side of an outer join.
  await client.query(
    'SELECT fee_id FROM fee_collection_terms WHERE fee_id=(SELECT id FROM platform_fee_invoices WHERE contract_id=$1) FOR SHARE',
    [contractId],
  );
  if (!row.snapshot_valid)
    throw new AppError(
      'Platform fee snapshot requires finance investigation',
      409,
      'FEE_SNAPSHOT_INVALID',
    );
  if (!row.terms_accepted_at)
    throw new AppError(
      'Seller must accept the platform fee terms before dispatch',
      409,
      'FEE_TERMS_REQUIRED',
    );
  if (row.accepted_fingerprint !== feeTermsFingerprint(row))
    throw new AppError(
      'Accepted fee terms differ from the current fee snapshot',
      409,
      'FEE_TERMS_STALE',
    );
  if (Number(row.amount_total) !== 0 && !row.receipt_verified && !row.credit_active && !row.waived)
    throw new AppError(
      'Verified platform fee payment or current finance credit is required before dispatch',
      409,
      'FEE_PAYMENT_REQUIRED',
    );
}
export async function assertNoOverdueFees(
  client: PoolClient,
  organizationIds: string[],
): Promise<void> {
  const ids = [...new Set(organizationIds)].sort();
  await lockFeeOrganizations(client, ids);
  const overdue = await client.query(
    `SELECT f.id FROM platform_fee_invoices f LEFT JOIN fee_collection_terms t ON t.fee_id=f.id
    WHERE f.policy_version='seller-predispatch-v3' AND f.payer_organization_id=ANY($1::uuid[]) AND f.status='invoiced' AND f.amount_total>0 AND f.due_at<NOW()-INTERVAL '7 days'
    AND (t.credit_until IS NULL OR t.credit_until<=NOW() OR t.credit_granted_by IS NULL OR length(trim(t.credit_reason))<10 OR t.credit_reason IS NULL) LIMIT 1`,
    [ids],
  );
  if (overdue.rows.length)
    throw new AppError(
      'An overdue platform fee must be resolved before a new commercial commitment',
      409,
      'FEE_OVERDUE_RESTRICTION',
    );
}
