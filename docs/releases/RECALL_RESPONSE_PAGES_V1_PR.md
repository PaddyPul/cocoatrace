# PR title

Bound recall response collections and preserve recovery drafts

# Replacement PR description

## Outcome

Large recalls no longer require complete recipient, stock, recovery and evidence histories in one UI read. Each collection has scoped paging/search and full totals. Recovery selections and drafts survive successful paging and focus refreshes; unavailable or revoked reads remove stale action controls.

## Tracking

- Backlog ID(s): PER-001, ARC-024 (focused slice; broad items remain IN PROGRESS)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/RECALL_RESPONSE_PAGES.md
- Target phase/environment: pre-pilot; local release candidate, then staging

## Change summary

- Add independently scoped keyset pages capped at 100 records, literal search and full collection counts.
- Limit candidate IDs before participant/outbox and recovery projections; reject legacy overflow before hydration.
- Re-read one selected holding by exact scoped ID, include its saved recovery, and retain at most 100 evidence selections across pages.
- Keep whole-recall resolution, write authorization and safety holds authoritative on the server.
- Add large-collection/isolation PostgreSQL regressions and browser navigation/draft/failure regressions. Correct the embedded recovery assertion to expect PostgreSQL JSON numeric representation (1), rather than its ordinary driver numeric string ("1.000").

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: recipient scope and explicit manager access are rechecked on each read. Cursors bind user, organization, permissions, recall, collection and search. Only validated, clean evidence metadata is listed with evidence-read permission. File downloads and mutations retain their independent checks. Reads use existing repeatable-read and timeouts; no new audit/outbox writes.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; read-only transactions, limited candidate projections and existing deadlines
- Rollback or compensation: revert this application commit; no persistent data conversion
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 609 API unit assertions passed, quality and workspace/browser type checks passed, API/web builds passed. Founder initial PostgreSQL run passed 326/327 assertions; the remaining JSON numeric representation assertion is corrected. Six new PostgreSQL cases and five new browser cases require exact-candidate Windows Docker-backed release acceptance. Before merging, check the integration/E2E boxes only after the exact candidate passes `npm run verify:release`; attach its commit/report and required GitHub CI result.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: explicit labels and pending/retry states added; browser accessibility selectors are covered in the pending release suite. Existing redacted diagnostics retained.

## Follow-up work

- PER-001: remaining public product histories, exports and hosted performance acceptance.
- ARC-024: complete remaining bounded read consumers; keep broad item open.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- This candidate has no completion credit until founder exact-commit release and merge/pull acceptance. Prior recall-register acceptance is recorded separately.
