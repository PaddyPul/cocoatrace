# PR title

Make access review and pilot feedback searchable without silent truncation

# Replacement PR description

## Outcome

Platform reviewers can find access applications beyond the old 200-row cutoff, and organization administrators can review pilot feedback beyond the old 500-row cutoff. Server search and pagination retain complete scoped totals; failed reads remain explicit instead of presenting an empty history.

## Tracking

- Backlog IDs: PER-001 / ARC-024 (focused slices; broad items remain IN PROGRESS)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/REVIEW_QUEUE_PAGES.md
- Target phase/environment: pre-pilot local release, then staging

## Change summary

- Add bounded access application and pilot feedback pages, literal search, filters, scoped cursors and full summaries.
- Replace access review's local array filter and add a separate feedback register to the pilot workspace.
- Bound legacy complete reads at 1,000 records; reject overflow before hydration instead of silently truncating.
- Preserve access application approval/rejection, email verification and first-admin invitation workflows.
- Record founder acceptance of administration record paging and tenant directory isolation.
- Search/filter before opening the modal, then review the selected applicant. Separate the visible textarea label with htmlFor/id so typing cannot change its exact label; verify the dialog and labelled control remain available after entry.
- Correct legacy product overflow rejection to use authorized IDs before recall/scan/evidence/trust hydration; retain the existing read deadlines and size limits.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: access review remains wildcard-platform only. Feedback reads are own-organization for organization.admin, network for wildcard. Safe projections exclude token hashes, credentials and unrelated user contact details. Cursors bind authority and filters; reads use shared deadlines and no-store. Existing mutations remain authoritative.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert matching API/UI together; no data conversion.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 705 API unit assertions, quality, workspace/browser types, API/web builds, migration integrity and backlog checks passed. Twelve new PostgreSQL HTTP cases compile strictly; six browser cases added. Stable-label correction web/browser type checks, quality and web production build pass here; browser execution remains pending the founder rerun. Product overflow regressions check ID-only rejection and bounded small-history success; the founder run passed 393 of 394 integration tests before this correction. Docker/PostgreSQL/browser execution unavailable author-side. Tick integration/E2E only after exact-candidate verify:release passes, append SHA/report, and require GitHub CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- PER-001 / ARC-024: remaining embedded collections and representative query-plan acceptance.
- PER-003 / PER-004: upload/download concurrency, backpressure and hosted capacity measurements.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Candidate pending exact release and merge/pull acceptance; broad items remain open.
