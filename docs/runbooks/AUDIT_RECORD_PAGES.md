# Audit register pages

The audit register uses `GET /audit/events/page`, not the legacy array or an in-browser filter of a first page. All reads require `audit.read`. Only explicit `audit.read.all` (or `*`) expands the scope beyond events attributed to the caller's organization. Export or analytics permissions do not grant network audit browsing.

## API contract

- `limit`: 1–100; default 50.
- `search`: at most 80 characters; literal case-insensitive action, entity type, entity ID or reason search before limiting. `%`, `_` and backslash are escaped. Event metadata is neither searched nor returned.
- `entityType`, `entityId`, `action`: optional exact filters. Entity ID must be a UUID and entity type a bounded identifier. These register filters may be used individually.
- `cursor`: opaque continuation scoped to current organization, current permissions, exact filters and search. Sort order is newest occurrence first, then descending event UUID. Timestamp microseconds are retained during continuation. Cursor timestamps are restricted to calendar years 1–9999; overflowing forged keys return 400 before SQL.
- `sort`: only `time` is accepted.

The envelope contains `items`, `nextCursor`, `hasMore`, `count` and `latestAt`. `count` and `latestAt` cover the complete authorized exact-filter scope, independent of search or current page. `GET /audit/events/summary` supports only the three exact filters and returns the same totals.

Pages select at most limit + 1 lightweight IDs before projecting register fields, under the shared repeatable-read read-only catalog budget. A full history is not materialized. The projection includes event identifiers, attribution, time, action, hashes and reason; it omits metadata. Organization/time/ID and global/time/ID indexes support chronological page reads.

`GET /audit/events` is a compatibility read. It accepts only exact filters and returns a complete register projection up to 1,000 records. A lightweight ID preflight returns `422 CATALOG_READ_LIMIT` for larger histories. Offset/limit pagination on this legacy endpoint is rejected explicitly; clients should migrate to the cursor endpoint.

## UI and export

The named Audit register region shows full scoped totals, page navigation, server-side search and applied exact filters. Failed or malformed reads show unavailable totals and an explicit retry, not an empty history. Null historical actor attribution is displayed safely. Record navigation still passes through the destination's authorization.

Export retains its separate `audit.export` / `audit.export.all` boundary and complete-report protections. The UI sends an entity export filter only when both entity type and ID are applied. Search and action do not change downloads. Complete downloads are capped at 1,000 records and 4 MiB; an overflow returns an explicit error without a partial attachment.

## Automated verification

- Unit tests: bounded candidates, literal filters, complete totals, explicit read privilege, cursor scope and legacy preflight.
- PostgreSQL/API tests: 1,005 rows, timestamp/UUID continuation including a microsecond difference, off-page literal search, excluded metadata, unrelated tenants, changing current permissions, invalid inputs, legacy limits and bounded production SQL plan.
- Browser tests: page/search/full totals, exact filters/export label, missing actor handling, failed/retry reads and malformed envelope/hash handling.

Native database and browser execution remains part of the exact-candidate release gate. Local type checking is not evidence of a passing native journey.
