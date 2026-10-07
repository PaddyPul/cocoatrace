# Custody transfer reads

`GET /transfers/page` retains `custody.transfer.request` permission, authentication and both-party tenant visibility. This slice does not change role grants or acceptance authorization.

| Parameter | Meaning |
| --- | --- |
| limit | Default 50, maximum 100 |
| direction | incoming (default), outgoing, all |
| status | requested (default), accepted, all |
| search | Maximum 80 characters; literal search across transfer/holding IDs, parties, material and warehouse |
| cursor | Scoped position bound to organization, direction, status, search and order |

Filters apply before LIMIT. Stable UUID ascending order is a browsing order, not chronological. Every SQL parameter is explicitly typed. Rows include recall state for presentation; acceptance still rechecks live recall, holding state and receiving organization under existing locks. Read-only repeatable-read transactions share catalog statement/elapsed deadlines. Cursor content is never authorization.

Legacy `/transfers` returns at most 1,000 rows, ordered by the actual `requested_at` timestamp. Larger histories fail with `CATALOG_READ_LIMIT` rather than silently truncating. The UI now uses pages; acceptance refreshes transfer requests and inventory. Empty search/page text never claims the entire workspace has no history. Read errors are explicit and retryable.

Inventory defaults to incoming requested transfers. Outgoing records never expose acceptance. The action is also conditional on the receiving account's existing acceptance permission and recall state; business rejection remains server-enforced. Controls pause during acceptance. No audit/outbox mutation is added to reads; existing acceptance audit and atomic inventory behavior remain.

No schema, dependencies, secrets, backfill or environment changes. Roll back API/web together. Prior compatibility code incorrectly ordered transfer reads by `created_at`; schema uses `requested_at`.

Automated coverage: SQL parameter/filter/cursor units; native 1,005-transfer paging and party isolation, legacy overflow and receiving-party acceptance/retry; browser navigation, search, outgoing action exclusion and failed-read retry. Native Docker execution remains a founder release gate. No hosted load capacity claim. Remaining resource lists/exports and benchmark/index tuning remain PER-001 / ARC-024 work.
