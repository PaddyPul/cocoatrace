# PR title

Page authorized trace lot selection without loading the full workspace

# PR description

## Outcome

A supplier with more than 2,000 accessible lots can find and select an individual lot for trace/recall investigation using bounded search and cursor pages. Search filters run before the page limit; failed searches and filtered misses no longer imply an empty workspace. Recall response work remains available if selection fails.

## Tracking

- Backlog ID(s): PER-001 / ARC-024 (first resource slice, both remain in progress); acknowledge accepted PER-002.
- Issue/ADR: docs/runbooks/TRACE_LOT_PAGINATION.md
- Target phase/environment: core pre-pilot correctness and resource bounds; local/CI acceptance, hosted capacity pending.

## Change summary

- Add an authenticated lot-page endpoint: default 50/max 100 rows, bounded literal search, stable UUID keyset navigation and continuation detection without a full workspace count.
- Apply existing owner/custody/trade/distribution permissions in SQL on every page; bind cursor positions to organization, normalized search and visibility scope.
- Materialize the bounded page before decorating recall state and linked-record counts; reuse repeatable-read transactions and existing SQL deadlines.
- Add accessible search and previous/next controls, cancellation of stale search responses, truthful page counts and distinct failure/no-match states.
- Use exact accessible-label locators in the pagination browser test so the lot selector cannot also match the search textbox.
- Add parser/query unit coverage, PostgreSQL 2,501-record, query-plan and access regressions, and browser navigation/error tests. Update existing browser mocks to the new page envelope.
- Keep legacy summary callers on their existing bounded array endpoint, with explicit overflow errors, pending separate aggregate/paging work.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Every page reapplies current permissions. Cursors are position hints, never authorization tokens; changing position cannot bypass tenant filtering. Array/malformed/oversized inputs are rejected, SQL is parameterized, LIKE wildcards escaped. Read-only operation has no audit/outbox mutation. Page requests are individual snapshots; concurrent additions/removals can alter later pages and refresh restarts navigation.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; existing primary-key/genealogy/distribution indexes and transaction-local 2-second statement/5-second read budgets. No global database setting change.
- Rollback or compensation: deploy previous API/web together; no schema or data compensation required. Existing array endpoint remains.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author API suite 450 tests, code-quality checks, workspace/browser type checks, native integration-file compilation, API/web production builds, migration integrity and backlog checks passed. Native additions cover disjoint stable pages, off-page search, a foreign matching lot, current-access changes, cursor scope mismatch, invalid bounds, authentication/permission rejection, connected-trade access and EXPLAIN bounded-page structure. Browser case covers next/previous/search reset, filtered miss and failed retry. Docker/PostgreSQL/Chromium execution is unavailable author-side. Run `npm run verify:release` on the exact candidate before merge, then update native boxes and attach tested SHA/report or CI URL. No hosted performance claim.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Search and navigation have accessible labels, disabled busy states and page status. No new credential logging. Visual/responsive and hosted operations review remains separate. No success/failure result is interpreted as a safety certification.

## Follow-up work

- PER-001 / ARC-024: inventory, marketplace, remaining lists/exports and honest dashboard aggregates. Server-side matching/filtering and deep-linked published listing visibility must precede page limits.
- PER-003 / PER-004: archive representative hosted query plans, tune tenant/search indexes and prove concurrent capacity/SLOs; statement timeout is not latency assurance.
- ARC-008: broader trace/recall policy and repository separation.
- PRD-003 / PRD-005 / QLT-009: request-specific evidence checklist and saved-brief reopening/editing.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

This closes only the trace-selector implementation slice after native acceptance. Universal pagination and hosted performance receive no completion credit. Prior PER-002 release/merge acceptance is recorded.
