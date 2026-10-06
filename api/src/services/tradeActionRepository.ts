import { query } from '../db';
import { activeBatchRecallSql } from '../modules/recall/safety';
import { buildTradeActions, has, type TradeAction } from './tradeNextAction';

export async function loadTradeActions(
  actor: { organizationId: string; permissions: string[] },
  contractId?: string,
): Promise<TradeAction[]> {
  const organizationId = actor.organizationId;
  const [offers, deals] = await Promise.all([
    !contractId && has(actor.permissions, 'offer.respond', 'offer.create')
      ? query(
          `SELECT o.id,o.status,o.buyer_organization_id,l.seller_organization_id,b.name buyer_name,s.name seller_name
      FROM trade_offers o JOIN listings l ON l.id=o.listing_id JOIN organizations b ON b.id=o.buyer_organization_id JOIN organizations s ON s.id=l.seller_organization_id
      WHERE o.status='pending' AND (o.buyer_organization_id=$1 OR l.seller_organization_id=$1)`,
          [organizationId],
        )
      : Promise.resolve({ rows: [] }),
    has(actor.permissions, 'contract.read')
      ? query(
          `SELECT TRUE facts_loaded,fee.status fee_status,fee.payer_organization_id fee_payer_organization_id,fee.amount_total fee_amount,EXISTS(SELECT 1 FROM platform_fee_submissions fs WHERE fs.fee_id=fee.id AND fs.status='submitted') fee_payment_submitted,c.incoterm,c.id,c.status,c.seller_organization_id,c.buyer_organization_id,c.payment_terms_status,c.payment_plan,c.currency,c.currency_minor_units,
      seller.name seller_name,buyer.name buyer_name,p.id payment_request_id,p.status payment_status,p.security_status,p.amount_confirmed,p.dispatch_required_amount,p.documents_presented_at,
      EXISTS(SELECT 1 FROM payment_installments WHERE payment_request_id=p.id AND status='awaiting_trigger' AND due_trigger='documents_presented') documents_pending,
      (SELECT status FROM payment_issues WHERE payment_request_id=p.id AND status<>'resolved' LIMIT 1) payment_issue_status,
      ${activeBatchRecallSql('h.batch_id')} recall_held,
      i.id installment_id,i.status installment_status,i.installment_type,i.amount_due,
      sh.id shipment_id,sh.transport_coordinator_organization_id,sh.current_milestone,
      (SELECT accepted_at FROM delivery_acceptances WHERE contract_id=c.id) AS delivery_accepted_at,
      (SELECT status FROM delivery_discrepancies WHERE contract_id=c.id AND status<>'resolved' LIMIT 1) AS delivery_discrepancy_status,
      (SELECT requested_by_organization_id FROM contract_cancellation_requests WHERE contract_id=c.id AND status='requested') AS cancellation_requested_by_organization_id
      FROM sales_contracts c JOIN batch_holdings h ON h.id=c.holding_id LEFT JOIN platform_fee_invoices fee ON fee.contract_id=c.id JOIN organizations seller ON seller.id=c.seller_organization_id JOIN organizations buyer ON buyer.id=c.buyer_organization_id
      LEFT JOIN LATERAL(SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)p ON TRUE
      LEFT JOIN LATERAL(SELECT * FROM payment_installments WHERE payment_request_id=p.id AND status IN('payment_submitted','due') ORDER BY CASE status WHEN 'payment_submitted' THEN 0 ELSE 1 END,sequence_number LIMIT 1)i ON TRUE
      LEFT JOIN LATERAL(SELECT * FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)sh ON TRUE
      WHERE (c.seller_organization_id=$1 OR c.buyer_organization_id=$1) AND ($2::uuid IS NULL OR c.id=$2) ORDER BY c.created_at DESC`,
          [organizationId, contractId || null],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return buildTradeActions(
    contractId ? [] : offers.rows,
    deals.rows,
    organizationId,
    actor.permissions,
  );
}
