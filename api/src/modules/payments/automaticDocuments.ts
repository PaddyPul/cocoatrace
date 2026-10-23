import { query } from '../../db';
import { ConflictError, ValidationError, NotFoundError } from '../../errors';
import { automaticallyPresentDocuments } from './documentsAndSecurity';

// Rotating keyset prevents one unavailable storage object starving later trades.
// State is only an optimization: readiness and exactly-once activation live in SQL.
let cursor: string | null = null;
export async function reconcileDocumentSets() {
  const candidates = await query(
    `SELECT p.id,c.seller_organization_id FROM payment_requests p
     JOIN sales_contracts c ON c.id=p.contract_id
     JOIN LATERAL (SELECT current_milestone,transport_document_reference FROM shipments
       WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) ship ON TRUE
     WHERE p.documents_presented_at IS NULL AND c.status NOT IN ('cancelled','settled')
       AND c.payment_terms_status='agreed'
       AND c.payment_plan IN ('deposit_balance','documentary_collection','bank_secured')
       AND (c.payment_plan<>'bank_secured' OR p.security_status='verified')
       AND ship.current_milestone IN ('handed_over','loaded','departed','arrived','customs_cleared','unloaded','delivered')
       AND NULLIF(BTRIM(ship.transport_document_reference),'') IS NOT NULL
       AND ($1::uuid IS NULL OR p.id>$1::uuid)
       AND NOT EXISTS (SELECT 1 FROM payment_issues WHERE payment_request_id=p.id AND status<>'resolved')
     ORDER BY p.id LIMIT 20`,
    [cursor],
  );
  let failed = 0;
  let presented = 0;
  for (const row of candidates.rows) {
    cursor = row.id;
    try {
      await automaticallyPresentDocuments(row.seller_organization_id, row.id);
      presented++;
    } catch (error) {
      // Incomplete sets and concurrent edits are expected. Storage/audit/DB failures
      // remain visible to operations and will be retried from durable trade state.
      const code =
        error instanceof ValidationError &&
        error.message.startsWith('Upload validated, scan-clean documents first:')
          ? 'DOCUMENT_FILES_UNAVAILABLE'
          : error instanceof ConflictError || error instanceof ValidationError
            ? 'TRADE_REQUIREMENTS_INCOMPLETE'
            : 'DOCUMENT_SUBMISSION_RETRY_PENDING';
      if (!(error instanceof NotFoundError))
        await query(
          `UPDATE payment_requests SET documents_submission_error_code=$2,documents_submission_checked_at=NOW()
         WHERE id=$1 AND documents_presented_at IS NULL`,
          [row.id, code],
        );
      if (
        !(
          error instanceof ValidationError ||
          error instanceof ConflictError ||
          error instanceof NotFoundError
        )
      )
        failed++;
    }
  }
  if (candidates.rows.length < 20) cursor = null;
  return { failed, presented };
}
