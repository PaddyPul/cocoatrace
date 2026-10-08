# Contract paging and totals

GET /contracts/page requires contract.read and restricts records to the caller as seller or buyer, even for read-all/admin or logistics assignment. limit 1–100 (default 50); search up to 80 literal characters over IDs, parties, Incoterm and status; direction all|purchases|sales; status all|active|accepted|fulfilment_in_progress|in_transit|delivered|delivered_payment_risk|settled|cancelled; opaque scope-bound cursor. UUID ascending order is stable, not chronological. Filters apply before limiting. Queries run in existing bounded read-only repeatable-read snapshots with unchanged deadlines.

GET /contracts/summary has the same permission/party boundary. count, active_count, settled_count and cancelled_count are independent of pages/search. Active means stored status other than settled/cancelled; it does not assert payment cleared or cargo safe. latest_active_id is newest active created_at with ID tie-break, or null; queried separately with LIMIT 1 inside the same snapshot, without loading a history array. No cross-currency monetary total.

Contract rows retain existing fields and add SQL decimal trade_value rounded to stored currency_minor_units. Display recorded currency/precision, not inferred euros. Opening a deal still uses /deal-room/:id and existing authorization.

Legacy /contracts returns at most 1,000 rows or 422 CATALOG_READ_LIMIT. Legacy persona dashboard remains a separate aggregate migration and displays its existing explicit load error on overflow. Contract details/embedded collections remain separate. No migration, seed, secret or dependency change. Revert API/UI together if needed.

Release: npm run verify:release and exact SHA report before merge. Nine unit cases, three 1,005-deal native cases and five browser definitions cover boundaries, counts, literal search, precision, filters, retry, malformed envelopes and navigation. Browser fixtures include actual /me field names and completed onboarding. Native runtime is unavailable in author environment; founder gate required.
