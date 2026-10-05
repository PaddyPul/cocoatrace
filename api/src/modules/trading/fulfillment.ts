import { PoolClient, QueryResultRow } from 'pg';
import { feePolicyVersion } from '../fees/policy';
import { tradeTotal, requireTradeCurrency, tradeMinorUnits } from '../../services/tradeMoney';
import { config } from '../../config/env';
import { buildInstallments, requiredBeforeDispatch } from '../../services/paymentProtection';
import { recordTradeAudit, TradeActor } from './transaction';

/** Acceptance creates the whole actionable deal inside the inventory transaction. */
export async function createFulfillment(client: PoolClient, actor: TradeActor, offer: QueryResultRow, holdingId: string) {
  requireTradeCurrency(offer.currency);
  const units = tradeMinorUnits(offer.currency);
  const plan = units === 0 ? 'pay_before_dispatch' : 'deposit_balance';
  const value = tradeTotal(offer.quantity_kg, offer.offered_price_per_kg, units);
  const contractRes = await client.query(
    `INSERT INTO sales_contracts (listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,
      quantity_kg,price_per_kg,currency,incoterm,payment_plan,deposit_percentage,payment_terms_status,currency_minor_units)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,20,'draft',$11) RETURNING *`,
    [offer.listing_id, offer.id, actor.organizationId, offer.buyer_organization_id, holdingId,
      offer.quantity_kg, offer.offered_price_per_kg, offer.currency, offer.incoterm, plan, units]);
  const contract = contractRes.rows[0];
  const paymentRes = await client.query(`INSERT INTO payment_requests
    (contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,due_trigger,dispatch_required_amount,security_status,currency_minor_units)
    VALUES($1,$2,$3,$4,'awaiting_terms',$7,'terms_agreed',$5,'not_required',$6) RETURNING *`,
    [contract.id, actor.organizationId, value, offer.currency, requiredBeforeDispatch(plan, value, 20, units), units, plan]);
  const paymentRequest = paymentRes.rows[0];
  for (const installment of buildInstallments(plan, value, 20, units)) {
    await client.query(`INSERT INTO payment_installments
      (payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status,currency_minor_units)
      VALUES($1,$2,$3,$4,$5,'awaiting_trigger',$6)`,
    [paymentRequest.id, installment.installmentType, installment.sequenceNumber, installment.amountDue, installment.dueTrigger, units]);
  }
  const fee = (await client.query(`INSERT INTO platform_fee_invoices(contract_id,fee_payer,payer_organization_id,policy_version,rate_bps,amount_total,currency,currency_minor_units)
    SELECT id,'seller',seller_organization_id,$3,$2::integer,ROUND(quantity_kg*price_per_kg*$2::integer/10000,currency_minor_units),currency,currency_minor_units FROM sales_contracts WHERE id=$1 RETURNING *`,
  [contract.id, config.platformFeeBps, feePolicyVersion])).rows[0];
  await recordTradeAudit(client, actor, 'fee.estimate.create', 'platform_fee_invoice', fee.id, {contractId:contract.id,amount:fee.amount_total,currency:fee.currency,rateBps:fee.rate_bps,policyVersion:feePolicyVersion,currencyMinorUnits:units});
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
