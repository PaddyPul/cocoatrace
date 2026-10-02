import { PoolClient, QueryResultRow } from 'pg';
import { config } from '../../config/env';
import { buildInstallments, requiredBeforeDispatch } from '../../services/paymentProtection';
import { recordTradeAudit, TradeActor } from './transaction';

/** Acceptance creates the whole actionable deal inside the inventory transaction. */
export async function createFulfillment(client: PoolClient, actor: TradeActor, offer: QueryResultRow, holdingId: string) {
  const contractRes = await client.query(
    `INSERT INTO sales_contracts (listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,
      quantity_kg,price_per_kg,currency,incoterm,payment_plan,deposit_percentage,payment_terms_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'deposit_balance',20,'draft') RETURNING *`,
    [offer.listing_id, offer.id, actor.organizationId, offer.buyer_organization_id, holdingId,
      offer.quantity_kg, offer.offered_price_per_kg, offer.currency, offer.incoterm]);
  const contract = contractRes.rows[0];
  const value = Number(offer.quantity_kg) * Number(offer.offered_price_per_kg);
  const paymentRes = await client.query(`INSERT INTO payment_requests
    (contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,due_trigger,dispatch_required_amount,security_status)
    VALUES($1,$2,$3,$4,'awaiting_terms','deposit_balance','terms_agreed',$5,'not_required') RETURNING *`,
    [contract.id, actor.organizationId, value, offer.currency, requiredBeforeDispatch('deposit_balance', value, 20)]);
  const paymentRequest = paymentRes.rows[0];
  for (const installment of buildInstallments('deposit_balance', value, 20)) {
    await client.query(`INSERT INTO payment_installments
      (payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status)
      VALUES($1,$2,$3,$4,$5,'awaiting_trigger')`,
    [paymentRequest.id, installment.installmentType, installment.sequenceNumber, installment.amountDue, installment.dueTrigger]);
  }
  await client.query(`INSERT INTO platform_fee_invoices(contract_id,fee_payer,rate_bps,amount_total,currency)
    VALUES($1,'seller',$2,$3,$4)`,
  [contract.id, config.platformFeeBps, Math.round(value * config.platformFeeBps / 100) / 100, offer.currency]);
  const buyerArranges = ['EXW', 'FCA', 'FAS', 'FOB'].includes(String(offer.incoterm).toUpperCase());
  const shipmentRes = await client.query(`INSERT INTO shipments
    (contract_id,transport_coordinator_organization_id,origin_port,destination_port,current_milestone,transport_mode)
    VALUES($1,$2,$3,$4,'planning','unspecified') RETURNING *`,
  [contract.id, buyerArranges ? offer.buyer_organization_id : actor.organizationId, offer.origin_location, offer.destination_location]);
  const shipment = shipmentRes.rows[0];
  await recordTradeAudit(client, actor, 'contract.create', 'sales_contract', contract.id, { offerId: offer.id, holdingId });
  await recordTradeAudit(client, actor, 'payment.prepare', 'payment_request', paymentRequest.id);
  await recordTradeAudit(client, actor, 'transport.workspace.create', 'shipment', shipment.id);
  return { contract, paymentRequest, shipment };
}
