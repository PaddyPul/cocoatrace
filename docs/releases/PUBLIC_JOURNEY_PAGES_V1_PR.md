# PR title

Bound public product journeys with chronological paging

# Replacement PR description

## Outcome

Published product timelines now page/search recorded events rather than loading entire custody and shipment histories. Full event totals stay independent of current page/filter, equal timestamps use a stable tie breaker, and timeline failure does not assert an empty or safe history. Recall warnings remain separate.

## Tracking

- Backlog ID(s): PER-001, ARC-024 (focused slice; broad items remain IN PROGRESS)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/PUBLIC_JOURNEY_PAGES.md
- Target phase/environment: pre-pilot; local release candidate, then staging

## Change summary

- Add public chronological pages capped at 100, literal search and full eligible event counts.
- Limit lightweight index rows before selected-page source hydration across harvest, attestation, custody, shipment and recall events.
- Replace embedded complete timeline with a 50-event first page and explicit `journeyPaging`.
- Bind exact numeric time cursors to profile/batch/search with namespaced event IDs; retain pre-1970 dates and current trust semantics.
- Extract journey UI from the public profile and add scoped navigation/failure regressions. Record accepted public-evidence release.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: publication and expected profile association rechecked; cursors reject profile/search reuse. Read-only repeatable-read, existing deadlines/abuse limiter and `no-store` remain enforced. Projection retains public recorded-event fields without source IDs, payment/user/storage data. No mutation, audit/outbox, download or recall-release policy change.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; read-only transactions
- Rollback or compensation: revert application commit; no data conversion
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 627 API unit assertions passed; quality, workspace/browser types, builds and strict native-test compilation passed. Five PostgreSQL and three browser regressions added. Tick integration/E2E only after exact-candidate `npm run verify:release` passes and append commit/report evidence. Required GitHub CI must pass before merge. Native execution is pending author delivery.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: explicit timeline region, search/navigation and retry labels; browser accessibility/responsive execution remains pending. Recorded events do not independently verify claims or release safety holds.

## Follow-up work

- PER-001 / ARC-024: public recall notice paging/aggregate safety, remaining exports and hosted performance/query-plan acceptance.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Candidate completion awaits exact release and founder merge/pull acceptance; broad items remain open beyond this slice.
