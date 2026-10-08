# Offer paging and totals

GET /offers/page requires offer.respond or offer.create and always restricts rows to the caller organization as listing seller or offer buyer. Admin/read-all does not broaden this boundary. Parameters: direction=all|received|sent (default all), status=all|pending|accepted|rejected|expired (default all), search up to 80 characters, limit 1–100 (default 50), opaque cursor. Literal search covers offer/listing IDs, parties and status before limiting. UUID ascending order is stable, not chronological. Cursors bind tenant and filters and are not authorization tokens.

GET /offers/summary has the same permission and party boundary and returns received_count, sent_count, received_pending and sent_pending independently of page/search. Pending means stored status pending; this endpoint does not reinterpret validity or approve expired commercial offers. Existing accept/reject enforcement remains final.

Both run in the existing bounded read-only repeatable-read transaction with unchanged query/read deadlines. Pages expose existing offer fields, fee estimates and precision. No mixed-currency aggregate is introduced. Legacy GET /offers returns at most 1,000 rows and refuses overflow with 422 CATALOG_READ_LIMIT; remaining comparison consumers need migration to paging.

Offers UI supports both directions, server search, page navigation and retry. Counts are aggregate totals; row sections are explicitly page-local. Focus refreshes rows/counts, rejected offers refresh the same page, acceptance opens the existing deal room. Failed aggregate reads are unavailable, never zero. Home reads offer counts without loading histories; other home inputs and guided trade-action queries remain separate future work.

Release: npm run verify:release on the exact commit before merge. Native scenario covers 1,005 offers and party/cursor/permission/input/overflow/summary checks. Browser fixtures cover page/search/reset, retry, malformed envelope, rejection refresh and aggregate home counts; existing real trade journeys still cover acceptance. No data reset, migrations or new secrets. Revert API and UI together if required.
