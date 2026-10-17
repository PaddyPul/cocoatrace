import { NotFoundError } from '../../errors';
import {
  buildInstallments,
  requiredBeforeDispatch,
  type PaymentPlan,
} from '../../services/paymentProtection';
import { inTradeTransaction, recordTradeAudit, type TradeActor } from '../trading/transaction';
import { activatePaymentInstallments } from './dueDates';
import {
  assertRequestCanBeCreated,
  assertRequestMoney,
  paymentStateAfterAgreement,
} from './requestPolicy';

export interface CreatePaymentRequestInput {
  amountTotal: number;
  currency: string;
}
interface RequestContract {
  id: string;
  status: string;
  currency: string;
  currency_minor_units: number;
  payment_plan: PaymentPlan;
  deposit_percentage: string | number;
  payment_terms_status: string;
  payment_terms_confirmed_at: Date | null;
}
/** Additional persisted columns are preserved in the existing response without projection changes. */
export interface CreatedPaymentRequest {
  id: string;
  contract_id: string;
  amount_total: string;
  currency: string;
  status: string;
  [column: string]: unknown;
}

/** Seller-scoped contract lock serializes duplicate creation; installments and audit commit atomically. */
export async function createPaymentRequest(
  actor: TradeActor,
  contractId: string,
  input: CreatePaymentRequestInput,
): Promise<CreatedPaymentRequest> {
  return inTradeTransaction(async (client) => {
    const contract = (
      await client.query<RequestContract>(
        'SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2 FOR UPDATE',
        [contractId, actor.organizationId],
      )
    ).rows[0];
    if (!contract) throw new NotFoundError('Contract');
    assertRequestCanBeCreated(contract.status, false);
    const existing = await client.query('SELECT id FROM payment_requests WHERE contract_id=$1', [
      contract.id,
    ]);
    assertRequestCanBeCreated(contract.status, Boolean(existing.rows[0]));
    const total = (
      await client.query<{ total: string }>(
        'SELECT ROUND(quantity_kg*price_per_kg,currency_minor_units) AS total FROM sales_contracts WHERE id=$1',
        [contract.id],
      )
    ).rows[0].total;
    assertRequestMoney(total, contract.currency, input);
    const created = (
      await client.query<CreatedPaymentRequest>(
        `INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,dispatch_required_amount,security_status,currency_minor_units)
      VALUES($1,$2,$3,$4,'awaiting_terms',$5,$6,$7,$8) RETURNING *`,
        [
          contract.id,
          actor.organizationId,
          total,
          contract.currency,
          contract.payment_plan,
          requiredBeforeDispatch(
            contract.payment_plan,
            total,
            Number(contract.deposit_percentage),
            contract.currency_minor_units,
          ),
          contract.payment_plan === 'bank_secured' ? 'awaiting_submission' : 'not_required',
          contract.currency_minor_units,
        ],
      )
    ).rows[0];
    for (const i of buildInstallments(
      contract.payment_plan,
      total,
      Number(contract.deposit_percentage),
      contract.currency_minor_units,
    )) {
      await client.query(
        `INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status,currency_minor_units)
        VALUES($1,$2,$3,$4,$5,'awaiting_trigger',$6)`,
        [
          created.id,
          i.installmentType,
          i.sequenceNumber,
          i.amountDue,
          i.dueTrigger,
          contract.currency_minor_units,
        ],
      );
    }
    if (contract.payment_terms_status === 'agreed') {
      const status = paymentStateAfterAgreement(contract.payment_plan);
      await activatePaymentInstallments(client, created.id, 'terms_agreed', {
        triggeredAt: contract.payment_terms_confirmed_at,
      });
      await client.query(
        "UPDATE payment_requests SET status=$1,release_status=CASE WHEN $2='pay_after_delivery' THEN 'authorized' ELSE release_status END WHERE id=$3",
        [status, contract.payment_plan, created.id],
      );
    }
    await recordTradeAudit(client, actor, 'payment.request', 'payment_request', created.id);
    return created;
  });
}
