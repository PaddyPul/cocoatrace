import type { PoolClient } from 'pg';
import { AppError, ConflictError } from '../../errors';
import {
  buildInstallments,
  requiredBeforeDispatch,
  type PaymentPlan,
} from '../../services/paymentProtection';
import { inTradeTransaction, recordTradeAudit, type TradeActor } from '../trading/transaction';
import { activatePaymentInstallments } from './dueDates';

export interface PaymentTermsInput {
  paymentPlan: PaymentPlan;
  depositPercentage?: number;
  creditDays?: number;
  note?: string;
  paymentEvidenceRequired?: boolean;
}
interface TermsContract {
  id: string;
  status: string;
  payment_terms_status: string;
  payment_plan: PaymentPlan;
}
interface TermsPayment {
  id: string;
  amount_total: string;
}

/** Match the contract-first ordering used by installments, delivery and settlement. */
async function lockTerms(
  client: PoolClient,
  actor: TradeActor,
  id: string,
  party: 'seller' | 'buyer',
) {
  const contract = (
    await client.query<TermsContract>(
      `SELECT id,status,payment_terms_status,payment_plan FROM sales_contracts
     WHERE id=$1 AND ${party}_organization_id=$2 FOR UPDATE`,
      [id, actor.organizationId],
    )
  ).rows[0];
  const message =
    party === 'seller'
      ? 'Contract not found or only the seller can propose payment terms'
      : 'Contract not found or only the buyer can confirm its payment terms';
  if (!contract) throw new AppError(message, 404, 'NOT_FOUND');
  const payment = (
    await client.query<TermsPayment>(
      'SELECT id,amount_total FROM payment_requests WHERE contract_id=$1 FOR UPDATE',
      [id],
    )
  ).rows[0];
  if (!payment) throw new AppError(message, 404, 'NOT_FOUND');
  if (['cancelled', 'settled'].includes(contract.status))
    throw new ConflictError('Closed contracts cannot change payment terms');
  return { contract, payment };
}

export function paymentStateAfterAgreement(plan: PaymentPlan): string {
  const states: Record<PaymentPlan, string> = {
    pay_before_dispatch: 'payment_due',
    deposit_balance: 'payment_due',
    bank_secured: 'awaiting_security',
    documentary_collection: 'awaiting_documents',
    pay_after_delivery: 'awaiting_delivery',
  };
  return states[plan];
}

/** The route validates commercial inputs before invoking this use case. */
export async function proposePaymentTerms(actor: TradeActor, id: string, input: PaymentTermsInput) {
  const {
    paymentPlan,
    depositPercentage = 20,
    creditDays = 30,
    note,
    paymentEvidenceRequired = false,
  } = input;
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockTerms(client, actor, id, 'seller');
    if (contract.payment_terms_status === 'agreed')
      throw new ConflictError('Confirmed payment terms cannot be changed');
    const activity = await client.query(
      "SELECT 1 FROM payment_installments WHERE payment_request_id=$1 AND status IN('payment_submitted','paid') LIMIT 1",
      [payment.id],
    );
    if (activity.rows[0]) throw new ConflictError('Payment activity already exists');
    const total = Number(payment.amount_total);
    const required = requiredBeforeDispatch(paymentPlan, total, depositPercentage);
    const security = paymentPlan === 'bank_secured' ? 'awaiting_submission' : 'not_required';
    await client.query(
      `UPDATE sales_contracts SET payment_plan=$1,deposit_percentage=$2,credit_days=$3,payment_terms_note=$4,payment_terms_status='proposed',payment_terms_confirmed_at=NULL,payment_terms_confirmed_by_user_id=NULL WHERE id=$5`,
      [paymentPlan, depositPercentage, creditDays, note || null, id],
    );
    await client.query(
      `UPDATE payment_requests SET status='awaiting_terms',payment_method=$1,dispatch_required_amount=$2,amount_confirmed=0,security_status=$3,security_provider=NULL,security_reference=NULL,security_submitted_at=NULL,security_verified_at=NULL,security_verified_by_user_id=NULL,release_status='locked',updated_at=NOW() WHERE id=$4`,
      [paymentPlan, required, security, payment.id],
    );
    await client.query('UPDATE sales_contracts SET payment_evidence_required=$1 WHERE id=$2', [
      paymentEvidenceRequired,
      id,
    ]);
    await client.query('DELETE FROM payment_installments WHERE payment_request_id=$1', [
      payment.id,
    ]);
    for (const installment of buildInstallments(paymentPlan, total, depositPercentage)) {
      await client.query(
        `INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status) VALUES($1,$2,$3,$4,$5,'awaiting_trigger')`,
        [
          payment.id,
          installment.installmentType,
          installment.sequenceNumber,
          installment.amountDue,
          installment.dueTrigger,
        ],
      );
    }
    await recordTradeAudit(client, actor, 'payment.terms.propose', 'sales_contract', id, {
      paymentPlan,
      paymentEvidenceRequired,
    });
    return { ok: true as const };
  });
}

export async function agreePaymentTerms(actor: TradeActor, id: string) {
  return inTradeTransaction(async (client) => {
    const { contract, payment } = await lockTerms(client, actor, id, 'buyer');
    if (contract.payment_terms_status === 'agreed')
      return { ok: true as const, alreadyConfirmed: true };
    if (contract.payment_terms_status !== 'proposed')
      throw new ConflictError(
        'The supplier must propose the payment terms before the buyer can confirm them',
      );
    await client.query(
      "UPDATE sales_contracts SET payment_terms_status='agreed',payment_terms_confirmed_at=NOW(),payment_terms_confirmed_by_user_id=$1 WHERE id=$2",
      [actor.id, id],
    );
    await activatePaymentInstallments(client, payment.id, 'terms_agreed');
    await client.query(
      `UPDATE payment_requests SET status=$1,release_status=CASE WHEN $2='pay_after_delivery' THEN 'authorized' ELSE release_status END,updated_at=NOW() WHERE id=$3`,
      [paymentStateAfterAgreement(contract.payment_plan), contract.payment_plan, payment.id],
    );
    await recordTradeAudit(client, actor, 'payment.terms.confirm', 'sales_contract', id);
    return { ok: true as const };
  });
}
