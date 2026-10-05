import { decimalUnits } from '../../services/tradeMoney';
import type { PoolClient } from 'pg';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { inTradeTransaction, recordTradeAudit, type TradeActor } from '../trading/transaction';
import { requireCollectible, textInput } from './policy';
export interface FeeActor extends TradeActor {
  permissions: string[];
}
export interface FeeRecord {
  receipt_verified: boolean;
  amount_matches: boolean;
  payer_matches: boolean;
  id: string;
  contract_id: string;
  fee_payer: string;
  payer_organization_id: string | null;
  rate_bps: number;
  amount_total: string;
  currency: string;
  currency_minor_units: number;
  status: string;
  policy_version: string;
  tax_status: string;
  due_at: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  seller_organization_id: string;
  buyer_organization_id: string;
  contract_status: string;
  seller_name: string;
  buyer_name: string;
  quantity_kg: string;
  price_per_kg: string;
}
interface Submission {
  id: string;
  fee_id: string;
  status: string;
  reference: string;
  rejection_reason: string | null;
}
export function isFinanceAdmin(actor: FeeActor) {
  return actor.permissions.includes('*') || actor.permissions.includes('finance.manage');
}
function requireAdmin(actor: FeeActor) {
  if (!isFinanceAdmin(actor)) throw new ForbiddenError('Platform finance permission is required');
}
const projection = `SELECT f.id,f.contract_id,f.fee_payer,f.payer_organization_id,f.rate_bps,f.amount_total,f.currency,f.currency_minor_units,f.status,f.policy_version,f.tax_status,f.due_at,f.invoiced_at,f.paid_at,
 (f.status='paid' AND f.paid_at IS NOT NULL AND f.verified_by_user_id IS NOT NULL AND f.platform_receipt_reference IS NOT NULL AND EXISTS(SELECT 1 FROM platform_fee_submissions fs WHERE fs.fee_id=f.id AND fs.status='verified')) receipt_verified,
 (f.amount_total=round(c.quantity_kg*c.price_per_kg*f.rate_bps/10000::numeric,f.currency_minor_units) AND f.currency=c.currency AND f.currency_minor_units=c.currency_minor_units) amount_matches,
 (f.payer_organization_id IS NOT DISTINCT FROM CASE f.fee_payer WHEN 'seller' THEN c.seller_organization_id WHEN 'buyer' THEN c.buyer_organization_id ELSE NULL END) payer_matches,
 c.seller_organization_id,c.buyer_organization_id,c.status contract_status,c.quantity_kg,c.price_per_kg,s.name seller_name,b.name buyer_name
 FROM platform_fee_invoices f JOIN sales_contracts c ON c.id=f.contract_id JOIN organizations s ON s.id=c.seller_organization_id JOIN organizations b ON b.id=c.buyer_organization_id`;
async function fee(
  client: PoolClient,
  actor: FeeActor,
  contractId: string,
  lock = false,
): Promise<FeeRecord> {
  if (lock) {
    const c = await client.query(
      'SELECT id FROM sales_contracts WHERE id=$1 AND ($3 OR $2 IN(seller_organization_id,buyer_organization_id)) FOR UPDATE',
      [contractId, actor.organizationId, isFinanceAdmin(actor)],
    );
    if (!c.rows[0]) throw new NotFoundError('Fee statement');
  }
  const result = await client.query<FeeRecord>(
    `${projection} WHERE c.id=$1 AND ($3 OR $2 IN(c.seller_organization_id,c.buyer_organization_id)) ${lock ? 'FOR UPDATE OF f' : ''}`,
    [contractId, actor.organizationId, isFinanceAdmin(actor)],
  );
  if (!result.rows[0]) throw new NotFoundError('Fee statement');
  return result.rows[0];
}
async function submissions(client: PoolClient, f: FeeRecord, actor: FeeActor) {
  if (!isFinanceAdmin(actor) && f.payer_organization_id !== actor.organizationId) return [];
  return (
    await client.query<Submission>(
      'SELECT id,fee_id,status,reference,rejection_reason,submitted_at,reviewed_at FROM platform_fee_submissions WHERE fee_id=$1 ORDER BY submitted_at DESC,id DESC',
      [f.id],
    )
  ).rows;
}
export async function statement(actor: FeeActor, contractId: string) {
  return inTradeTransaction(async (client) => {
    const f = await fee(client, actor, contractId);
    return {
      fee: f,
      submissions: await submissions(client, f, actor),
      statementNumber: `CT-FEE-${f.id}`,
      documentType: 'commercial_fee_statement',
      collectionMethod: 'external_payment_reference',
      taxNotice: 'Tax treatment is not configured. This is not a tax invoice.',
    };
  });
}
export async function submitFee(actor: FeeActor, contractId: string, reference: string) {
  if (!actor.permissions.some((p) => ['*', 'offer.respond', 'offer.create'].includes(p)))
    throw new ForbiddenError('Commercial permission is required');
  const ref = textInput(reference, 3, 'Payment reference');
  return inTradeTransaction(async (client) => {
    const f = await fee(client, actor, contractId, true);
    if (f.payer_organization_id !== actor.organizationId)
      throw new ForbiddenError('Only the recorded fee payer can submit payment');
    const pending = (await submissions(client, f, actor)).find((s) => s.status === 'submitted');
    if (pending) {
      if (pending.reference === ref) return pending;
      throw new ConflictError('A fee payment already awaits platform verification');
    }
    requireCollectible(f);
    const row = (
      await client.query<Submission>(
        'INSERT INTO platform_fee_submissions(fee_id,submitted_by_user_id,submitted_by_organization_id,reference) VALUES($1,$2,$3,$4) RETURNING *',
        [f.id, actor.id, actor.organizationId, ref],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'fee.payment.submit', 'platform_fee_invoice', f.id, {
      submissionId: row.id,
      reference: ref,
    });
    return row;
  });
}
export type FeeReview =
  | { decision: 'verify'; amount: string; currency: string; receiptReference: string }
  | { decision: 'reject'; reason: string };
export async function reviewFee(
  actor: FeeActor,
  contractId: string,
  submissionId: string,
  input: FeeReview,
) {
  requireAdmin(actor);
  const detail =
    input.decision === 'verify'
      ? textInput(input.receiptReference, 3, 'Platform receipt reference')
      : textInput(input.reason, 10, 'Rejection reason');
  if (
    input.decision === 'verify' &&
    (!/^\d{1,12}(\.\d{1,2})?$/.test(input.amount) || !/^[A-Z]{3}$/.test(input.currency))
  )
    throw new ValidationError('Enter the exact received amount and ISO currency');
  return inTradeTransaction(async (client) => {
    const f = await fee(client, actor, contractId, true);
    if (input.decision === 'verify') decimalUnits(input.amount, f.currency_minor_units ?? 2);
    if (actor.organizationId === f.payer_organization_id)
      throw new ForbiddenError('The fee payer cannot verify its own receipt');
    const s = (
      await client.query<Submission>(
        'SELECT * FROM platform_fee_submissions WHERE id=$1 AND fee_id=$2 FOR UPDATE',
        [submissionId, f.id],
      )
    ).rows[0];
    if (!s) throw new NotFoundError('Fee submission');
    if (input.decision === 'verify' && s.status === 'verified') {
      const matching = (
        await client.query(
          'SELECT id FROM platform_fee_invoices WHERE id=$1 AND amount_total=$2::numeric AND currency=$3 AND platform_receipt_reference=$4',
          [f.id, input.amount, input.currency, detail],
        )
      ).rows[0];
      if (matching) return s;
      throw new ConflictError('This payment was verified with different receipt details');
    }
    if (input.decision === 'reject' && s.status === 'rejected' && s.rejection_reason === detail)
      return s;
    if (s.status !== 'submitted')
      throw new ConflictError('This submission has already been reviewed');
    requireCollectible(f);
    if (input.decision === 'verify') {
      const matches = (
        await client.query(
          'SELECT id FROM platform_fee_invoices WHERE id=$1 AND amount_total=$2::numeric AND currency=$3',
          [f.id, input.amount, input.currency],
        )
      ).rows[0];
      if (!matches)
        throw new ConflictError(
          'Received amount or currency does not match the fee; resolve the discrepancy before confirming',
        );
      // A unique database index also protects competing confirmations on different invoices.
      const used = (
        await client.query(
          'SELECT id FROM platform_fee_invoices WHERE lower(trim(platform_receipt_reference))=lower(trim($1)) AND id<>$2',
          [detail, f.id],
        )
      ).rows[0];
      if (used) throw new ConflictError('This platform receipt reference has already been used');
      await client.query(
        "UPDATE platform_fee_invoices SET status='paid',paid_at=NOW(),verified_by_user_id=$2,platform_receipt_reference=$3 WHERE id=$1",
        [f.id, actor.id, detail],
      );
    }
    const reviewed = (
      await client.query<Submission>(
        `UPDATE platform_fee_submissions SET status=$2,reviewed_by_user_id=$3,reviewed_at=NOW(),rejection_reason=$4 WHERE id=$1 RETURNING *`,
        [
          s.id,
          input.decision === 'verify' ? 'verified' : 'rejected',
          actor.id,
          input.decision === 'reject' ? detail : null,
        ],
      )
    ).rows[0];
    await recordTradeAudit(
      client,
      actor,
      `fee.payment.${input.decision}`,
      'platform_fee_invoice',
      f.id,
      {
        submissionId: s.id,
        ...(input.decision === 'verify'
          ? { amount: input.amount, currency: input.currency, receiptReference: detail }
          : { reason: detail }),
      },
    );
    return reviewed;
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')
      throw new ConflictError('This platform receipt reference has already been used');
    throw error;
  });
}
export async function writeOffFee(actor: FeeActor, contractId: string, reason: string) {
  requireAdmin(actor);
  const detail = textInput(reason, 10, 'Write-off reason');
  return inTradeTransaction(async (client) => {
    const f = await fee(client, actor, contractId, true);
    if (actor.organizationId === f.payer_organization_id)
      throw new ForbiddenError('The fee payer cannot write off its own debt');
    if (f.status === 'written_off') {
      const previous = (
        await client.query('SELECT write_off_reason FROM platform_fee_invoices WHERE id=$1', [f.id])
      ).rows[0];
      if (previous?.write_off_reason === detail) return f;
      throw new ConflictError('This fee already has a different write-off reason');
    }
    requireCollectible(f);
    if ((await submissions(client, f, actor)).some((s) => s.status === 'submitted'))
      throw new ConflictError('Review the submitted payment before writing off the fee');
    const row = (
      await client.query<FeeRecord>(
        "UPDATE platform_fee_invoices SET status='written_off',written_off_at=NOW(),write_off_reason=$2,verified_by_user_id=$3 WHERE id=$1 RETURNING *",
        [f.id, detail, actor.id],
      )
    ).rows[0];
    await recordTradeAudit(client, actor, 'fee.write_off', 'platform_fee_invoice', f.id, {
      reason: detail,
    });
    return row;
  });
}
export async function listFees(actor: FeeActor) {
  return inTradeTransaction(
    async (client) =>
      (
        await client.query<FeeRecord>(
          `${projection} WHERE $2 OR f.payer_organization_id=$1 ORDER BY f.created_at DESC,f.id DESC LIMIT 200`,
          [actor.organizationId, isFinanceAdmin(actor)],
        )
      ).rows,
  );
}
