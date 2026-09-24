import { Pool } from 'pg';
import path from 'path';

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

type Check = { name: string; sql: string; expectation?: 'zero' | 'one-or-more' };

const checks: Check[] = [
  { name: 'new users belong to isolated organizations', sql: `
    SELECT COUNT(*)::int AS count FROM users
    WHERE (email='newbuyer@cocoatrace.io' AND organization_id <> '11111111-1111-1111-1111-111111111009')
       OR (email='newsupplier@cocoatrace.io' AND organization_id <> '11111111-1111-1111-1111-111111111010')`, expectation: 'zero' },
  { name: 'fresh workspaces contain no operational records', sql: `
    SELECT COUNT(*)::int AS count FROM (
      SELECT id FROM sourcing_requests WHERE buyer_organization_id='11111111-1111-1111-1111-111111111009'
      UNION ALL SELECT id FROM listings WHERE seller_organization_id='11111111-1111-1111-1111-111111111010'
      UNION ALL SELECT id FROM harvest_batches WHERE current_holder_id IN ('11111111-1111-1111-1111-111111111009','11111111-1111-1111-1111-111111111010')
    ) rows`, expectation: 'zero' },
  { name: 'active certificates are current on the demo date', sql: `
    SELECT COUNT(*)::int AS count FROM organic_certificates
    WHERE status='active' AND valid_to < DATE '2026-09-24'`, expectation: 'zero' },
  { name: 'active listings do not exceed their holdings', sql: `
    SELECT COUNT(*)::int AS count FROM listings l JOIN batch_holdings h ON h.id=l.holding_id
    WHERE l.active AND (l.available_quantity_kg > h.quantity_kg OR h.status <> 'available')`, expectation: 'zero' },
  { name: 'holding quantities reconcile to harvest quantities', sql: `
    SELECT COUNT(*)::int AS count FROM harvest_batches b
    JOIN (SELECT batch_id, SUM(quantity_kg) AS held FROM batch_holdings GROUP BY batch_id) h ON h.batch_id=b.id
    WHERE h.held <> b.quantity_kg`, expectation: 'zero' },
  { name: 'recalled batches are not offered for sale', sql: `
    SELECT COUNT(*)::int AS count FROM listings l
    JOIN batch_holdings h ON h.id=l.holding_id
    JOIN recall_affected_batches rb ON rb.batch_id=h.batch_id
    JOIN recall_notices r ON r.id=rb.recall_id AND r.status='active'
    WHERE l.active`, expectation: 'zero' },
  { name: 'offers do not exceed their listing quantity', sql: `
    SELECT COUNT(*)::int AS count FROM trade_offers o JOIN listings l ON l.id=o.listing_id
    WHERE o.quantity_kg > l.available_quantity_kg`, expectation: 'zero' },
  { name: 'shipment milestones are chronological', sql: `
    SELECT COUNT(*)::int AS count FROM (
      SELECT shipment_id, recorded_at, LAG(recorded_at) OVER (PARTITION BY shipment_id ORDER BY recorded_at) AS previous
      FROM shipment_milestones
    ) m WHERE previous IS NOT NULL AND recorded_at < previous`, expectation: 'zero' },
  { name: 'commercial events follow their parent records', sql: `
    SELECT COUNT(*)::int AS count FROM shipments s
    JOIN sales_contracts c ON c.id=s.contract_id
    JOIN trade_offers o ON o.id=c.offer_id
    JOIN listings l ON l.id=o.listing_id
    WHERE NOT (l.created_at <= o.created_at AND o.created_at <= c.created_at AND c.created_at <= s.created_at)
      OR EXISTS (SELECT 1 FROM shipment_milestones m WHERE m.shipment_id=s.id AND m.recorded_at < s.created_at)`, expectation: 'zero' },
  { name: 'incident happens after downstream distribution', sql: `
    SELECT COUNT(*)::int AS count FROM recall_notices r
    WHERE r.id='13131313-1313-1313-1313-131313131301'
      AND r.initiated_at <= (SELECT MAX(dispatched_at) FROM lot_distributions)`, expectation: 'zero' },
  { name: 'commercial scenario contains active supply', sql: `SELECT COUNT(*)::int AS count FROM listings WHERE active`, expectation: 'one-or-more' },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@127.0.0.1:15433/cocoatrace';
  const pool = new Pool({ connectionString });
  let failed = 0;
  try {
    for (const check of checks) {
      const result = await pool.query(check.sql);
      const count = Number(result.rows[0].count);
      const passed = check.expectation === 'one-or-more' ? count > 0 : count === 0;
      console.log(`${passed ? '✓' : '✗'} ${check.name}${passed ? '' : ` (found ${count})`}`);
      if (!passed) failed += 1;
    }
  } finally {
    await pool.end();
  }
  if (failed) throw new Error(`${failed} demo integrity check(s) failed`);
  console.log('✓ Demo data is internally consistent');
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
