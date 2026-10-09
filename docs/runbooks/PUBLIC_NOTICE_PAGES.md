# Public recall notices and aggregate safety

Tracking: PER-001 / ARC-024 remain IN PROGRESS.

Published profiles expose `/public/products/:slug/notices/page` with `limit` (1–100, default 50), literal `search` (80 characters), `status` (`all`, `active`, `resolved`) and opaque cursor. Cursors bind publication identity, batch, search and status. The public profile embeds at most 50 active notices plus `noticesPaging`; resolved history is obtained through pages.

`count` always represents all related active/resolved notices, independently of filters. `safety` includes status, inventoryHeld, activeCount, resolvedCount, criticalCount, warningCount, advisoryCount and checkedAt. Status is the strongest active severity, or warning for retained/returned/destroyed inventory; an empty filtered page is never proof that the material is clear.

Relationships include affected batches, material lots belonging to the batch, unreleased holding holds and returned/destroyed recovery records. EXISTS prevents duplicate notice projection. The journey shares this scope so lot-only notice instructions and history remain discoverable. DTOs exclude recipients, contacts, storage keys, audit actors and recovery accounting.

Reads use repeatable-read transactions, existing SQL/whole-read budgets, profile abuse limits and no-store. Root profile assembly rechecks published identity/batch before returning. UI read failures present unavailable safety and explicit retry, not a stale clear badge. Search/status paging does not release inventory or resolve a recall.

No migration, dependency, secret or backfill. Roll back API/UI together. Native tests cover more than 1,000 notices, lot-only severity, duplicate associations, publication/cursors and retained-stock fallbacks; automated browser definitions cover counts, filters, warning independence and failure/retry. Native execution must pass for the exact candidate before merge. Hosted load measurements and field-level publication consent remain open.
