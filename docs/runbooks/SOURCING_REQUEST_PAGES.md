# Sourcing request read boundaries

GET /sourcing-requests/page accepts limit (1–100, default 50), search (literal title/commodity, max 80), mine=true, id (UUID) and scope-bound cursor. Ordering is UUID descending, stable across equal timestamps; it is not chronological. Search and authorization apply before candidate LIMIT; only selected rows are hydrated. Pagination does not expose creator user IDs.

Buyers see their own requests. Actors with listing.create, offer.respond or wildcard permissions additionally see open matched requests from other organizations; this is the existing demand visibility policy, not a new general network permission. Foreign private/invited/draft/closed records remain unavailable even by ID. Cursor binds organization, current permissions, search and filters.

GET /sourcing-requests/summary returns own_count (all own states), open_count (visible foreign open matched demand), latest_own (newest own record) , latest_own_open (newest own open request regardless visibility) and latest_open (newest visible foreign matched demand). Latest values can be null. Totals are independent of search/page. Summary and page reads use shared repeatable-read snapshots and read deadlines. Dashboard unavailable totals remain unknown.

GET /sourcing-requests retains chronological legacy arrays up to 1,000 rows. A 1,001st candidate returns 422 CATALOG_READ_LIMIT before full hydration; callers should use paged search. Timeout returns 503 CATALOG_READ_TIMEOUT, never an empty array.

Acceptance requires the exact-candidate full release pass, PostgreSQL tenant/privacy/search/cursor/large-workspace regressions and browser selector/dashboard/error-state checks. No migration or app database reset is needed. Hosted capacity and all other collection bounds remain separate work.
