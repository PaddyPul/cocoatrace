# PR title

Bound public recall safety histories and complete audit exports

# Replacement PR description

## Outcome

Public product safety stays accurate when notices exceed one page or are linked only to material lots. Buyers can find notice instructions without downloading an entire history; searches cannot hide aggregate warnings. Audit downloads remain complete or fail explicitly before generating a partial report.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — focused slices; both remain IN PROGRESS
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/PUBLIC_NOTICE_PAGES.md; docs/runbooks/AUDIT_EXPORT_BOUNDS.md
- Target phase/environment: pre-pilot; local release candidate, then staging

## Change summary

- Add max-100 published notice pages with literal search, scoped cursors and status filters; embed a 50-active-notice first page with metadata.
- Derive full safety/counts independently of filters and include lot-only, retained-hold and returned/destroyed relationships without duplicates. Reuse the relation in journeys.
- Present explicit unavailable safety/retry after notice read failure; recheck publication association before returning assembled public profiles.
- Cap complete audit exports at 1,000 records / 4 MiB with ID/byte preflight and stable ordering. Preserve organization/explicit network authority and JSON-array attachment format.
- Fix durable export attribution; no file is sent if attribution fails. Record accepted public journey release.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: published identity/batch and cursor scope rechecked; no-store, existing read budgets and abuse limits retained. Notice DTO excludes contacts/recovery/storage data. Export metadata retains existing authorized fields; new attribution logs filters/count/bytes, not report contents. No recall resolution/stock-release change.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; bounded read-only snapshots
- Rollback or compensation: revert API/UI together; no data conversion
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 651 API unit assertions pass; quality, workspace/browser types, builds, migration integrity, backlog checks and strict native-test source compilation pass. Thirteen PostgreSQL cases added across notice and audit boundaries, plus browser regressions. Native Docker/browser execution unavailable author-side. Tick integration/E2E only after exact-candidate npm run verify:release passes; append tested SHA/report evidence. Required GitHub CI must pass before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named notice region, explicit filters/navigation/retry; browser verification pending. Empty search results do not establish safety. Oversized complete exports return explicit errors rather than misleading truncated reports.

## Follow-up work

- PER-001 / ARC-024: audit register paging, provenance export and remaining embedded collection bounds.
- PER-003 / PER-004: hosted query-plan and representative concurrent-load acceptance.
- Public recorded-event field consent/redaction policy remains open; this change adds no new public contact or commercial fields.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Candidate completion awaits exact release and founder merge/pull acceptance. Broad items remain open beyond these slices.
