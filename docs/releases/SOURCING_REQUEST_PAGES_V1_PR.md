# PR title

Page sourcing demand and preserve full dashboard totals

# Replacement PR description

## Outcome

Large sourcing histories remain searchable and selectable beyond page one. Buyer/supplier dashboards use full authorized totals and show failed reads explicitly instead of interpreting them as no demand.

## Tracking

- Backlog IDs: PER-001 / ARC-024 (focused slice; broad items remain IN PROGRESS)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/SOURCING_REQUEST_PAGES.md
- Target phase/environment: pre-pilot, local release then staging

## Change summary

- Add bounded sourcing pages, literal server search, own-only and exact authorized ID filters with tenant/filter/permission-bound cursors.
- Give the request selector an explicit associated label so option text cannot become part of its accessible name.
- Preserve request selection across search/page changes; resolve off-page links through the same authority predicate.
- Add full own-request and visible foreign matched-demand totals and bounded latest records for dashboard recommendations.
- Bound the legacy array route and explicitly reject overflow rather than return a partial history.
- Extract repository reads into a focused catalog module and record accepted audit/provenance work; ARC-010 complete.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: buyers see their own requests; authorized sellers additionally see foreign open matched demand. Private/invited/draft/closed foreign requests remain hidden even through exact ID lookup. Page projections omit creator user IDs. This changes reads, not writes/audit delivery. Existing shared snapshot/deadline controls remain enforced.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert API/UI together; no data conversion
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence: 682 API unit assertions pass; quality, workspace/browser types, builds, migration integrity and backlog checks pass. Six PostgreSQL cases and browser selector/dashboard/failure regressions are defined. Docker/PostgreSQL/browser execution unavailable author-side. Tick integration/E2E only after exact-candidate verify:release passes and append SHA/report. Required GitHub CI must pass before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- PER-001 / ARC-024: remaining administration/detail collection boundaries.
- PER-003 / PER-004: upload/download concurrency, representative capacity and hosted query plans.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Candidate pending release and merge/pull acceptance. Broad items remain open.
