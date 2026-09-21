import { Request, Response } from 'express';
import { query } from '../db';
import { adviseReadiness, ReadinessFacts } from '../services/readinessAdvisor';
import { createReadinessNarrative } from '../services/readinessNarrative';

export async function getReadiness(req: Request, res: Response): Promise<void> {
  const orgType = req.user!.orgType;
  const networkScope = (req.user!.permissions || []).includes('*') || ['regulator', 'importer', 'certifier'].includes(orgType);
  const result = await query(
    `WITH scoped_batches AS (
       SELECT b.id, b.organic_claim_status FROM harvest_batches b
       WHERE $1::boolean OR b.current_holder_id=$2
     ), scoped_products AS (
       SELECT pp.id, pp.batch_id, pp.visibility FROM product_profiles pp
       JOIN scoped_batches b ON b.id=pp.batch_id
     )
     SELECT
       (SELECT COUNT(*) FROM scoped_batches)::int AS batches_total,
       (SELECT COUNT(*) FROM scoped_batches WHERE organic_claim_status='attested')::int AS batches_attested,
       (SELECT COUNT(*) FROM scoped_products)::int AS products_total,
       (SELECT COUNT(*) FROM scoped_products WHERE visibility='published')::int AS products_published,
       (SELECT COUNT(*) FROM scoped_products pp WHERE EXISTS (
         SELECT 1 FROM evidence_items e WHERE e.linked_entity_type='batch' AND e.linked_entity_id=pp.batch_id AND e.review_status='approved'
       ))::int AS products_with_evidence,
       (SELECT COUNT(*) FROM recall_notices r WHERE r.status='active' AND ($1::boolean OR r.initiated_by_organization_id=$2))::int AS active_recalls,
       (SELECT COUNT(*) FROM shipments s JOIN sales_contracts c ON c.id=s.contract_id
        WHERE s.delivered_at IS NULL AND ($1::boolean OR c.seller_organization_id=$2 OR c.buyer_organization_id=$2 OR s.logistics_organization_id=$2))::int AS shipments_in_progress`,
    [networkScope, req.user!.organizationId]
  );
  const row = result.rows[0];
  const facts: ReadinessFacts = {
    batchesTotal: row.batches_total, batchesAttested: row.batches_attested,
    productsTotal: row.products_total, productsPublished: row.products_published,
    productsWithEvidence: row.products_with_evidence, activeRecalls: row.active_recalls,
    shipmentsInProgress: row.shipments_in_progress,
  };
  const advice = adviseReadiness(facts);
  const narrative = await createReadinessNarrative(advice.score, facts, advice.recommendations);
  res.json({ ...advice, facts, narrative, scope: networkScope ? 'permitted network' : 'your organization', disclaimer: 'Operational guidance only; not a legal compliance or certification decision.' });
}
