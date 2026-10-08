# Farm plot and batch evidence collections

Farm/batch detail reads use independent paged collections rather than loading every embedded row. This is a bounded detail slice of PER-001/ARC-024; both remain IN PROGRESS.

## API contract

| Endpoint | Scope and response |
| --- | --- |
| GET /farms/:id/plots/page | farm.read plus current farm relationship or explicit farm.read.all; UUID cursor page |
| GET /farms/:id/plots/summary | same authorization; full count, no query parameters |
| GET /evidence/page?entityType=batch&entityId=:id | evidence.read and shared evidence entity authorization; safe metadata projection |
| GET /evidence/summary?entityType=batch&entityId=:id | same scope and authorization; full count |

Pages accept search, limit (maximum 100) and cursor. Search is literal, parameterized and applied before limits. Cursors bind filters and tenant scope; later reads recheck current relationships. Catalog transactions retain SQL/read deadlines. Summaries are independent of page position/search and do not establish certification, review approval, scan clearance or download eligibility.

Farm detail UI requests plotMode=paged and certificateMode=paged. plots:null with plot_collection:paged omits the plot array. Invalid plot modes return 400. Legacy farm detail plots are capped at 1,000 and reject overflow with 422 CATALOG_READ_LIMIT.

Batch detail UI requests evidenceMode=paged. evidence:null with evidence_collection:paged omits evidence metadata; without evidence.read the mode is unavailable. Invalid evidence modes return 400. Legacy evidence metadata uses the existing safe list policy and rejects overflow above 1,000. Batch access alone is insufficient. File bytes, quarantine state and download grants remain governed by the independent evidence download policy.

## UI behavior

FarmPlots and BatchEvidence own search, page navigation, focus refresh, named controls and visible retry. Full totals never become a false zero when summary loading fails. Plot creation refreshes the panel. Search/page navigation does not change plot creation, harvesting, certificate attestation or evidence upload transactions. Coordinates are rendered only when both numbers are finite.

## Verification and remaining scope

Six new unit cases, four native database definitions (including 1,005 records, literal search, overflow and relationship revocation) and five browser definitions cover this slice. Native/browser execution is part of verify:release and requires Docker on the founder machine; author test-source compilation is not execution evidence.

Remaining work: other embedded product/recall collections, exports, batch plot-ID/trust payload bounds and hosted concurrent-load/index acceptance. No migration, backfill, configuration, dependency update or database reset is required.
