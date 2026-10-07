# Source record pages

| Endpoint | Permission | Filters / output |
| --- | --- | --- |
| GET /farms/page | farm.read | owned, search, limit, cursor; page envelope |
| GET /farms/summary | farm.read | full authorized count and owned_count |
| GET /batches/page | batch.read | mine, farm UUID, search, limit, cursor; trusted batch page envelope |
| GET /batches/summary | batch.read | optional farm UUID; count and recorded_quantity_kg |

Default page size 50, maximum 100; literal search capped at 80 characters. Stable UUID order is a browsing order, not chronology. Scoped cursors include organization, live explicit read-all permission, filters and order. Unknown or malformed page filters fail. Query values are parameterized and explicitly typed. Existing authentication/read permissions remain; cursors are not authorization.

Farm list visibility retains owner, cooperative and certificate-issuer relationships. Batch list visibility retains current holder, farmer/cooperative, holding, attestation and contract relationships. Explicit farm.read.all / batch.read.all retain broad reads. Detail-only relationships are not newly granted list access. Owner-only farm selection is a narrowing filter; it does not grant create rights. Server harvest creation still checks ownership. Certificate selection preserves the selected farm object for the existing issue payload.

Pages use catalog read-only repeatable-read transactions, statement/elapsed deadlines and bounded proof enrichment. Trust status is computed by the authoritative assessment; no raw organic flag becomes reviewed proof. Legacy farm/batch arrays refuse more than 1,000 records with CATALOG_READ_LIMIT; they never return a silent first page. Legacy dashboards, evidence record selectors and control-tower consumers not yet migrated to these pages can report that explicit overflow error. Those consumers remain follow-up work.

FarmsPage and BatchesPage are extracted from DataPages. Search and retry controls remain available during loading/failure. Harvest and certificate farm selectors can search/page and retain the selected record across pages. Farm detail batch history filters by farm on the server, while source totals aggregate the full authorized set. Recorded source quantity is not available inventory; batch totals never imply unreserved stock. Home uses owned farm totals for source-setup guidance and pauses recommendations if authorized farm totals fail.

No migration, backfill, dependency or environment change. Revert API/web together. Other detail collections (plots/certificates/evidence), remaining list/export consumers and hosted query plans/index tuning/load SLO acceptance stay open.

Automated regressions cover typed SQL/cursor/permission scope, 1,005 owned farms/batches, off-page search, exact farm filtering, cooperative/certifier/holding/attestation access, unrelated-tenant isolation, read-permission removal, complete totals and legacy refusal. Browser regressions cover farm/batch navigation, harvest-selector search/selection retention and visible retry on failed source reads; existing source creation/evidence flows remain in the release suite. Author-side native Docker/browser execution is unavailable; founder must pass the exact candidate through verify:release before merge.
