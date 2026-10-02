import type { PoolClient } from 'pg';

export interface TradeIntegrityIssue {
  code: string;
  entity_type: string;
  entity_id: string;
}

// Read-only diagnostics, deliberately independent of mutation services. Quantity
// comparisons stay in PostgreSQL NUMERIC, not JavaScript floating-point numbers.
// Historical transferred holdings are excluded; distributions describe custody
// movement and must not be added to physical stock a second time.
export async function reconcileTradeIntegrity(client: Pick<PoolClient, 'query'>): Promise<TradeIntegrityIssue[]> {
  const { rows } = await client.query<TradeIntegrityIssue>(`
    WITH holding_totals AS (
      SELECT batch_id,SUM(quantity_kg) allocated FROM batch_holdings
      WHERE status <> 'transferred' GROUP BY batch_id
    ), listing_totals AS (
      SELECT holding_id,SUM(available_quantity_kg) listed FROM listings
      WHERE active GROUP BY holding_id
    ), transfer_totals AS (
      SELECT holding_id,SUM(quantity_kg) requested FROM custody_transfers
      WHERE status='requested' GROUP BY holding_id
    ), open_contracts AS (
      SELECT * FROM sales_contracts WHERE status NOT IN ('settled','cancelled')
    ), issues AS (
      SELECT 'SOURCE_OVERALLOCATED' code,'batch' entity_type,b.id entity_id
      FROM harvest_batches b JOIN holding_totals t ON t.batch_id=b.id
      WHERE t.allocated > b.quantity_kg
      UNION ALL
      SELECT 'HOLDING_OVERRESERVED','holding',h.id
      FROM batch_holdings h LEFT JOIN listing_totals l ON l.holding_id=h.id
      LEFT JOIN transfer_totals t ON t.holding_id=h.id
      WHERE COALESCE(l.listed,0)+COALESCE(t.requested,0) > h.quantity_kg
      UNION ALL
      SELECT 'INACTIVE_HOLDING_HAS_RESERVATION','holding',h.id
      FROM batch_holdings h LEFT JOIN listing_totals l ON l.holding_id=h.id
      LEFT JOIN transfer_totals t ON t.holding_id=h.id
      WHERE h.status <> 'available' AND (COALESCE(l.listed,0)>0 OR COALESCE(t.requested,0)>0)
      UNION ALL
      SELECT 'LISTING_OWNER_MISMATCH','listing',l.id
      FROM listings l JOIN batch_holdings h ON h.id=l.holding_id
      WHERE l.active AND l.seller_organization_id <> h.holder_organization_id
      UNION ALL
      SELECT 'PENDING_TRANSFER_OWNER_MISMATCH','transfer',t.id
      FROM custody_transfers t JOIN batch_holdings h ON h.id=t.holding_id
      WHERE t.status='requested' AND (t.from_organization_id <> h.holder_organization_id OR t.from_organization_id=t.to_organization_id)
      UNION ALL
      SELECT 'CONTRACT_HOLDING_MISMATCH','contract',c.id
      FROM open_contracts c JOIN batch_holdings h ON h.id=c.holding_id
      WHERE h.status <> 'committed' OR h.quantity_kg <> c.quantity_kg OR h.holder_organization_id <> c.seller_organization_id
      UNION ALL
      SELECT 'COMMITTED_HOLDING_WITHOUT_SINGLE_CONTRACT','holding',h.id
      FROM batch_holdings h LEFT JOIN open_contracts c ON c.holding_id=h.id
      WHERE h.status='committed' GROUP BY h.id HAVING COUNT(c.id)<>1
      UNION ALL
      SELECT 'ACCEPTED_OFFER_WITHOUT_SINGLE_CONTRACT','offer',o.id
      FROM trade_offers o LEFT JOIN sales_contracts c ON c.offer_id=o.id
      WHERE o.status='accepted' GROUP BY o.id HAVING COUNT(c.id)<>1
      UNION ALL
      SELECT 'CONTRACT_OFFER_MISMATCH','contract',c.id
      FROM sales_contracts c JOIN trade_offers o ON o.id=c.offer_id
      JOIN listings l ON l.id=c.listing_id
      WHERE o.status <> 'accepted' OR o.listing_id <> c.listing_id
        OR o.buyer_organization_id <> c.buyer_organization_id
        OR l.seller_organization_id <> c.seller_organization_id
        OR o.quantity_kg <> c.quantity_kg OR o.offered_price_per_kg <> c.price_per_kg OR o.currency <> c.currency
      UNION ALL
      SELECT 'CONTRACT_WORKFLOW_MISSING','contract',c.id
      FROM sales_contracts c WHERE c.status <> 'cancelled' AND (
        NOT EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=c.id)
        OR NOT EXISTS(SELECT 1 FROM shipments s WHERE s.contract_id=c.id)
        OR NOT EXISTS(SELECT 1 FROM platform_fee_invoices f WHERE f.contract_id=c.id))
      UNION ALL
      SELECT 'SETTLED_CONTRACT_NOT_READY','contract',c.id
      FROM sales_contracts c WHERE c.status='settled' AND (
        NOT EXISTS(SELECT 1 FROM payment_requests p WHERE p.contract_id=c.id AND p.status='settled')
        OR NOT EXISTS(SELECT 1 FROM shipments s WHERE s.contract_id=c.id AND s.current_milestone='delivered'))
      UNION ALL
      SELECT 'DELIVERED_SHIPMENT_DISTRIBUTION_MISMATCH','shipment',s.id
      FROM shipments s JOIN sales_contracts c ON c.id=s.contract_id
      LEFT JOIN lot_distributions d ON d.shipment_id=s.id
      WHERE s.current_milestone='delivered'
      GROUP BY s.id,c.quantity_kg HAVING COALESCE(SUM(d.quantity_kg),0)<>c.quantity_kg
      UNION ALL
      SELECT 'SHIPMENT_DISTRIBUTION_EXCEEDS_CONTRACT','shipment',s.id
      FROM shipments s JOIN sales_contracts c ON c.id=s.contract_id
      JOIN lot_distributions d ON d.shipment_id=s.id
      GROUP BY s.id,c.quantity_kg HAVING SUM(d.quantity_kg)>c.quantity_kg
    ) SELECT code,entity_type,entity_id FROM issues ORDER BY code,entity_id
  `);
  return rows;
}
