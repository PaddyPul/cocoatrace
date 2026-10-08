# Authenticated product register pages

PER-001 / ARC-024 remain IN PROGRESS. This slice bounds the authenticated register, not public passport journey arrays or recall response/export collections.

## Contract and authorization

GET /product-profiles/page accepts limit (1–100, default 50), literal search (up to 80 characters), visibility (all/draft/published/archived/attention), UUID scope-bound cursor and the existing id order. Unknown parameters and cursor scope/filter changes return 400. Page response is items, hasMore and nextCursor.

GET /product-profiles/summary accepts no parameters and returns count, published_count and held_count across the complete authorized register, independent of the current page/search. Totals reuse the workspace aggregate policy.

Both routes require batch.read. Shared productScope retains current-holder, source farmer/cooperative, contract party and attestation certifier relationships; only explicit product_profile.read.all widens the register. Public published visibility does not widen authenticated register access. Analytics grants alone do not grant register read.

GET /product-profiles remains compatible for up to 1,000 records, then explicitly returns 422 CATALOG_READ_LIMIT. Its evidence_count now counts metadata rows, not independent evidence approval. Consumers must label this recorded evidence. Page ordering is deterministic by UUID rather than updated timestamp.

## Safety, trust and limits

Filters precede candidate LIMIT; the candidate CTE is materialized before per-profile scan/evidence counts. Trust is assessed for the returned page through the existing bounded authoritative loader. SQL/read deadlines remain 2/5 seconds. Pages never hydrate the entire register. Legacy overflow is detected before trust decoration.

Inventory hold assessment uses activeBatchRecallSql, including retained holds and returned/destroyed recovery stock after resolution. Active notice severity is preserved; retained-only hold falls back to warning. UI labels this safety hold, and labels absence as no recorded hold, not safety certification. Evidence metadata counts do not imply approval or scan clearance. File download gates remain independent. Missing direct-inventory origin is shown as Origin not recorded; recorded source location is supplier data.

## UI and verification

Products uses the shared page hook and named search/page controls. Full metrics are keyed to user/refresh; failed totals remain unavailable rather than zero. Read failure and malformed envelopes show explicit errors and retry; focus refresh reloads pages/totals. Publish/edit and trade mutations are unchanged.

Added seven unit cases, three PostgreSQL integration definitions (1,005 records, visibility, literal searches, tenant boundaries, legacy overflow, evidence counts, active/retained hold states and permission revocation) and five browser definitions. Native/browser execution requires the exact-candidate verify:release on Docker; source compilation alone is not execution evidence.

No migration, configuration change, backfill or database reset. Rollback API/UI together; no data compensation required. Remaining: public product detail histories, recall collections, exports, representative hosted query plans/load acceptance and frontend chunk splitting.
