# Recall response pages

GET `/recalls/:id/response?limit=50` returns independently bounded `participants`, `holdings`, `recoveries`, and `evidence` arrays. Each has `paging[name]` with `nextCursor`, `hasMore`, and full scoped `count`. Counts are independent of search and current page. Default page size follows catalog policy; explicit sizes must be 1–100.

Use `participantsCursor`/`participantsSearch`, `holdingsCursor`/`holdingsSearch`, `recoveriesCursor`/`recoveriesSearch`, and `evidenceCursor`/`evidenceSearch`. Searches are literal and capped at 80 characters. Unknown/repeated/malformed parameters fail validation. Cursors bind recall, user, organization, permissions, collection and search; they cannot move across tenants or collections.

`selectedHoldingId` optionally returns one current scoped `selectedHolding`, or null when absent/ineligible. It does not alter collection cursors. This revalidates an off-page recovery selection rather than trusting a cached record. Holdings contain their saved recovery snapshot even when recovery-history pagination is elsewhere.

Notice access requires issuer membership, recall participation or explicit network recall management. Recipients see their organization’s participants, holdings and recoveries; managers receive the permitted recall scope. Evidence metadata requires evidence-read permission and validated, clean evidence. File downloads retain their separate server authorization. Candidate IDs are limited before participant/outbox and recovery projection. All reads use the existing repeatable-read, read-only catalog transaction and deadlines.

Legacy requests without parameters return arrays only for collections of at most 1,000 records. Lightweight ID preflight rejects overflow with HTTP 422 / `CATALOG_READ_LIMIT`, rather than returning a misleading partial response. Query timeouts retain their distinct catalog error.

The UI retains one selected holding, at most 100 selected resolution evidence IDs, quantities, explanation and file across successful pages and focus refreshes. Actions are disabled while pending. Failed/malformed reads remove stale action controls and offer retry; context changes reset drafts. Recovery writes and resolution still validate authoritative server state for the entire recall, not just the visible page. Returned/destroyed inventory holds are not released by this work.

## Verification

Author unit, type, quality and build checks passed. PostgreSQL cases cover 1,005-record collections, literal off-page search, cross-tenant/collection cursor rejection, exact selection, invalid parameters and revoked membership. Browser cases cover independent navigation, recovery/file draft retention, evidence selection, malformed/retry states and revoked access. Docker-backed execution is pending founder `npm run verify:release`; do not mark this slice complete before the exact candidate passes and is merged. No migration, dependency or secret change.
