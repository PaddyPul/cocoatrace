import type { PoolClient } from 'pg';
import { NotFoundError, ConflictError } from '../../errors';
import type { TradeActor } from '../trading/transaction';

// Every payment operation serializes on the contract first, then the request.
// Settlement also locks the contract, so installment-first locking can deadlock.
export async function lockPayment(
  client: PoolClient,
  actor: TradeActor,
  id: string,
  party: 'buyer' | 'seller',
  installment = false,
) {
  const lookup = await client.query(
    installment
      ? 'SELECT p.contract_id FROM payment_installments i JOIN payment_requests p ON p.id=i.payment_request_id WHERE i.id=$1'
      : 'SELECT contract_id FROM payment_requests WHERE id=$1',
    [id],
  );
  const contractId = lookup.rows[0]?.contract_id;
  if (!contractId) throw new NotFoundError('Payment workflow');
  const contract = (
    await client.query(
      `SELECT * FROM sales_contracts WHERE id=$1 AND ${party}_organization_id=$2 FOR UPDATE`,
      [contractId, actor.organizationId],
    )
  ).rows[0];
  if (!contract) throw new NotFoundError('Payment workflow');
  if (contract.status === 'cancelled') throw new ConflictError('This trade has been cancelled');
  const payment = (
    await client.query('SELECT * FROM payment_requests WHERE contract_id=$1 FOR UPDATE', [
      contractId,
    ])
  ).rows[0];
  if (!payment) throw new NotFoundError('Payment workflow');
  return { contract, payment };
}

export function requireAgreed(contract: { payment_terms_status: string }) {
  if (contract.payment_terms_status !== 'agreed')
    throw new ConflictError('The buyer must confirm the payment terms first');
}
