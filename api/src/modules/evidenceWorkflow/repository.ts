import { query } from '../../db';
import { DownloadEvidenceItem } from './policy';

export async function findDownloadEvidence(id: string): Promise<DownloadEvidenceItem | undefined> {
  const { rows } = await query(
    `SELECT e.*,
            c.seller_organization_id,
            c.buyer_organization_id,
            p.release_status
       FROM evidence_items e
       LEFT JOIN shipments sh ON e.linked_entity_type='shipment' AND e.linked_entity_id=sh.id
       LEFT JOIN sales_contracts c
         ON (e.linked_entity_type='contract' AND e.linked_entity_id=c.id) OR sh.contract_id=c.id
       LEFT JOIN LATERAL (
         SELECT release_status FROM payment_requests
          WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1
       ) p ON TRUE
      WHERE e.id=$1`,
    [id],
  );
  return rows[0] as DownloadEvidenceItem | undefined;
}
