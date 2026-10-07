# Trace lot selection: bounded page contract

Tracking: PER-001 / ARC-024. This is the first resource slice, not universal pagination completion.

## API and security

`GET /traceability/lots/page?limit=50&search=peanut` requires authenticated `batch.read`. Response: `{items: MaterialLot[], nextCursor: string|null, hasMore: boolean}`. Use returned `nextCursor` as `cursor` for the next page; omit it to restart. Default 50 rows, maximum 100; queries fetch at most limit+1 for continuation detection. No global count is calculated.

Search is a literal, case-insensitive substring of lot code/material, or exact lot UUID. Maximum 80 characters; control characters, arrays, invalid limits, malformed/oversized cursors and unknown parameters return 400. SQL parameters escape LIKE wildcards so `%`/`_` do not expand user searches. Search and permission predicates run before LIMIT; no full permitted-ID materialization occurs.

Order is ascending lot UUID, with exclusive keyset continuation. This is stable record order, not chronology. The cursor records version, last ID and a hash of organization, network visibility and normalized search. It is a position hint, not a credential or cryptographic authorization token. Changing its position never expands permission; access is reapplied in SQL every page. Foreign-tenant, changed-search or changed-scope cursors return 400 and must be restarted.

Existing permissions are preserved: ownership, batch holdings, connected buyer/seller contracts or recipient distributions; explicit network permission may include all records. EXISTS predicates prevent duplicates from multiple holdings/contracts/distributions. Recall-held status and summary counts are calculated only for the materialized bounded page.

Each page uses the existing read-only repeatable-read transaction: 2-second statement timeout, 5-second elapsed read budget, rollback/release on failure. A timeout is an error, never an empty page. Pagination is not a long-lived snapshot across pages: concurrent creation/removal/access changes can change subsequent pages; refresh/search restarts from the beginning. New UUIDs preceding a cursor appear after restart. Access is not frozen by cursor possession.

## UI

Trace & Recall loads one page, offers Search lots / Previous lots / Next lots, and states the number on this page rather than an invented workspace total. New page/search clears selection and prior calculated results. Late requests cannot replace newer search results. Failed searches offer retry and do not instruct customers to create nonexistent missing inventory. Filtered zero matches also do not imply an empty workspace. Recall response and recovery remain independent of selector availability. Select a suspect lot on the current page before opening recall activation.

## Compatibility and remaining work

The original `/traceability/lots` array endpoint remains for control-tower/investor summary callers. Its previous 2,000-row bound and explicit overflow error remain; it is not silently truncated. These consumers need separately designed paged/aggregate summaries. Inventory, marketplace, batches, other list/export endpoints and related dashboard counts are not converted in this bundle. Marketplace request matching, reviewed-organic filtering and published-listing visibility must be applied server-side before paging, not to a truncated client list.

No migration or configuration change. Existing primary-key and genealogy/distribution indexes remain. Substring search and tenant access predicates can still scan candidates; timeouts bound execution but do not guarantee large hosted workload latency. Archive representative query plans and tune indexes before increasing capacity claims.

## Automated acceptance

Unit cases enforce input/cursor limits, scope binding, literal wildcard search, continuation and exact-page endings. PostgreSQL recall-safety suite adds a 2,501-owned-lot fixture with a foreign matching lot, disjoint stable pages, search beyond page one, permission/auth rejection, cross-tenant/search cursor rejection and connected-trade access. EXPLAIN ANALYZE/BUFFERS structurally verifies a bounded page against that fixture; wall-clock values are not treated as hosted SLO proof. Existing timeout/rollback unit cases cover the shared read wrapper.

`e2e/traceLotPages.spec.ts` checks navigation, reset-on-search, filtered misses and failed retry. Existing incomplete-trace and recall-response cases use the new envelope. Author-side unit/build/type/quality checks are separate from the founder's native Docker/browser release run. Run `npm run verify:release` on the exact candidate before merge; no manual fixture creation or data reset is required.
