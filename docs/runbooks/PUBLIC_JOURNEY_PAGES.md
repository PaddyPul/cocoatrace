# Public product journey pages

GET `/public/products/:slug/journey/page` accepts `limit` (1–100, default 50), literal `search` (max 80 characters), an opaque `cursor`, and optional `sort=time` (the only supported order). Response: `{items, count, hasMore, nextCursor}`. Count covers every eligible recorded event, independent of search/current page. Existing profile GET embeds a 50-row first page plus `journeyPaging`; array length is no longer a full event count.

Events are harvest/direct inventory, the batch’s current attestation, accepted custody with a response time, shipment milestones, and active/resolved batch recall notices. Missing timestamps are excluded, matching prior journey behavior. Search filters before limiting. Timeline order is ascending exact numeric timestamp plus a stable namespaced event UUID; source kinds cannot collide just because tables reuse the same source ID. Cursor keys shift epoch milliseconds to support pre-1970 dates and preserve PostgreSQL timestamp precision without JavaScript number coercion. Display timestamps remain ISO dates and use ordinary recorded-event semantics.

The read first verifies a published profile and binds its ID/batch/search/order into cursor scope. Small source/index rows are ordered/limited before selected-page source IDs are hydrated. The embedded read also checks that the profile association still matches the base response. Read-only repeatable-read transactions use existing statement and whole-read deadlines. Profile abuse limits and `no-store` headers apply. No new migration, secret, timeout or file/download permission.

Harvest/attestation presentation uses current authoritative trust assessment, never a legacy approval shortcut. Custody/shipment/recall rows describe recorded activity; they do not independently validate product claims or indicate clearance. No raw source IDs, payment fields, users, file bytes or storage keys are returned. Event IDs are opaque timeline identities.

The UI reports full totals, searches, pages and retries. Failure/malformed reads remove timeline rows and show unknown totals rather than an empty history. Focus/visible polling refreshes publication/current state. Recall warning cards and retained inventory holds stay separate from timeline search/page results. Public recall notice arrays are still an open slice; this change must not be described as complete public-profile boundedness.

## Verification

Author: 627 unit assertions, quality/type/build checks and strict PostgreSQL-test source compilation passed. Native regressions cover a 1,007-event timeline, all 1,005 same-time custody events exactly once, pre-1970 roots, off-page literal filtering, publication changes and cursor scope. Browser cases cover full totals, page/search, retry/malformed states and unavailable timeline with retained safety warning. Docker/PostgreSQL/browser execution is pending founder exact-commit `npm run verify:release`; no extra manual matrix.
