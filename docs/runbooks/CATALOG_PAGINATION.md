# Inventory and marketplace pagination

Tracking: PER-001 / ARC-024. Resource slice; universal pagination and hosted capacity remain open.

## API contract

| Endpoint | Permission | Inputs | Output |
| --- | --- | --- | --- |
| GET /holdings/page | holding.read | search, available=true/false, limit, cursor | items, hasMore, nextCursor |
| GET /holdings/summary | holding.read | none | count, available_count, available_kg, commodities |
| GET /listings/page | listing.read | search, mine, commodity, organic, origin, minimum, currency, id, sort, limit, cursor | items, hasMore, nextCursor |
| GET /listings/summary | listing.read | none | count, quantity_kg, own_count |

Default 50/max 100 page rows; query fetches limit+1 to detect continuation. Search/origin/commodity maximum 80 characters, literal SQL LIKE wildcards; flags accept only true/false; currency enum EUR/USD/GHS/GBP/JPY; exact listing ID must be a UUID. Unknown/array/malformed inputs and overlarge cursors/limits return 400. Minimum quantity accepts a bounded positive decimal or zero. Cursors are at most 512 characters and contain version, tenant/filter/search/order scope hash, last UUID and optional exact NUMERIC key. They convey position, never authorization; no signing is necessary to enforce access because SQL always reapplies it.

Inventory queries always restrict holder organization. Available-only excludes committed/held/transferred stock and current/retained recall safety holds. All-stock inventory still exposes its hold state for investigation. Marketplace includes only active positive-quantity supply with available seller-owned inventory and no safety hold. `mine` adds current seller organization; callers cannot choose another private owner. Marketplace commercial records are deliberately visible under existing listing.read permissions.

Search/commodity/origin/minimum/currency/organic filters run before LIMIT. Commodity normalization matches existing request presentation. Organic filtering mirrors authoritative certificate linkage, actor organization, independent verified certifier, active status, crop scope, validity at harvest/current UTC date and past attestation; it never reads a legacy attested flag as proof. Seven native parity cases compare the filter with detailed trust assessment. Full returned trust uses the existing assessment service in the same transaction.

Default stable UUID ascending order is not chronological order. Quantity order is descending NUMERIC+UUID, price ascending NUMERIC+UUID. Price order requires a selected currency; no implicit FX conversion or cross-currency ranking. Match scores are displayed/ranked within the current page, explicitly labeled as such; this slice does not implement a global match-score cursor. UUID/numeric tie breakers avoid offset skips within a fixed dataset. Each request is a read-only repeatable-read snapshot; pages are not a frozen multi-request snapshot. Concurrent changes may move rows between pages, so refresh or search restarts discovery when exact completeness matters.

## Read and memory bounds

All catalog pages, aggregates and compatibility lists run in a read-only transaction with 2-second statement timeout and 5-second total elapsed checks. PostgreSQL cancellation becomes 503 CATALOG_READ_TIMEOUT; transaction rolls back/releases. Aggregates return scalar totals, never infer totals from one page. A summary timeout is unavailable, not zero inventory.

Trust enrichment operates on only visible page batch IDs. Related plots/reviews query at most 5,001 rows and reject over 5,000 with 422 CATALOG_READ_LIMIT rather than truncate proof and derive an incorrect claim. These are fail-closed resource bounds, not hosted latency assurances. Inventory commodity summaries allow 100 distinct normalized commodities; overflow fails rather than presenting a partial demand-matching set.

Legacy GET /holdings and GET /listings retain array contracts up to 1,000 rows, query at most 1,001 and return an explicit limit error beyond that. They also use read deadlines and bounded proof enrichment. Remaining legacy clients must migrate to pages/aggregates rather than treating overflow as empty. Other resource lists/exports are outside this slice; PER-001/ARC-024 are not complete.

## Product integration

- Inventory table is extracted from DataPages into InventoryPage, with server search and previous/next controls; incoming-transfer/create controls remain intact.
- Publish selector pages available, non-held inventory. Newly created conventional stock links to its exact holding search so an unrelated first page is not selected.
- Marketplace retains ordinary browsing versus explicit request context, periodic/focus refresh, supplier/origin search, minimum quantity and assurance filtering. A separately checked published-ID lookup keeps off-page links truthful and can pin that item when browsing without filters. At most one extra pinned card supplements the page.
- My published supply uses server-side mine/search rather than filtering a global first page. Filtered misses and later empty pages do not imply an empty workspace.
- Primary buyer/supplier and role dashboards use supply aggregates. Supply-summary failure pauses primary setup recommendations while guided trade actions remain accessible. The former unlisted-batch inference from a loaded listing array becomes a neutral batch-readiness action; unrelated batch/offer/request totals still depend on their existing read paths and need later pagination work.
- Shortlists are account-scoped, capped at 20 and compared through bounded exact-availability lookups, not a full marketplace scan. Old shared-session shortlist state is intentionally not reused. Comparison prices show their recorded currency.

Read-only work adds no audit/outbox mutations and no migration/configuration/dependency change. Existing holding-holder, primary-key and safety indexes are reused. Query plans and index choices still need representative hosted measurements before a real pilot capacity claim.

## Automated acceptance

Author: unit/query/transaction tests plus workspace/browser typing, builds, quality and backlog checks. Native: catalogPagination.integration.test.ts creates 1,005 holdings/listings plus foreign stock, exercises disjoint keyset pages, search beyond page one, aggregate counts independent of pages, exact off-page lookup, cursor isolation, literal/request filtering, exact numeric ties, compatibility overflow, committed/recall exclusion and an EXPLAIN bounded-page plan. trustAccuracy.integration.test.ts checks organic filter/detail agreement across valid, revoked, expired, wrong-crop, direct inventory, self-certifier and future-attestation states.

Browser: catalogPages.spec.ts exercises inventory/publish/marketplace navigation, off-page published supply and truthful/failed aggregate states. Existing real creation, trade and source journeys remain in the full release; marketplace visibility/trust presentation fixtures reflect server filtering and the page envelope. Native Docker/browser execution is pending author-side because the tools are unavailable. Run npm run verify:release on the candidate SHA before merge. No lengthy manual test, reseed or volume removal is needed.
