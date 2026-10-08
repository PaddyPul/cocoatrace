# Payment workspace paging

GET /payment-requests/page requires payment.read. Every row must belong to a contract with the requesting organization as buyer or seller; payment.read.all, logistics assignment and platform privileges do not expand this scope. Existing payment detail and write boundaries are unchanged.

Parameters: limit (1–100, default 50), cursor, search (literal, max 80), direction (all/purchases/sales), status (all/open/cancelled or an exact existing workflow state), currency (empty or three-letter code), sort=id. All filtering happens before UUID keyset LIMIT. Cursors bind organization, search, direction, state, currency and order; every request rechecks current scope. Search covers payment/contract IDs, stored workflow status, currency, workflow reference and contract payment plan. It does not search bank security details or evidence bytes.

GET /payment-requests/summary returns count/open_count/settled_count/cancelled_count across all permitted workflows, independent of page filters. Open requires payment status not settled and contract status neither settled nor cancelled. Settled counts payment-request state, not delivery acceptance. Cancelled counts contract cancellation. These categories are not promised to partition every historical state. No mixed-currency money aggregate is returned.

Existing bounded read-only repeatable-read snapshots use a 2-second statement timeout and 5-second read deadline. GET /payment-requests compatibility array refuses >1,000 rows with 422 CATALOG_READ_LIMIT instead of silently truncating. PaymentRecordsPage uses the page API and separate totals, labelled partial counts, accessible detail buttons and explicit retry/unavailable states. Summary failures never become zero balances or empty-workspace claims. Focus refresh reads the current page and totals again.

No migration, new secret, backfill or mutation policy. Roll back API/UI together if needed. Native release must pass on the candidate SHA before merge. Database tests exercise a production page query with EXPLAIN at 1,005 workflows; hosted load acceptance and legacy aggregate/detail/export coverage remain separate PER-001/ARC-024 work.
