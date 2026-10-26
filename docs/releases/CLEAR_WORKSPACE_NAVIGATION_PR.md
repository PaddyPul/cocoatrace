## Outcome

Expanding Records or Administration now grows the menu naturally. One scrollbar on the whole sidebar replaces the nested Records scroll area on every viewport, and account help expands inline. Buyers, suppliers and administrators can reach every link without operating a second scroll area.

## Tracking

- Backlog ID(s): UX-002, INV-003
- Issue/ADR: Founder-approved buyer/supplier/admin navigation revision, 2026-10-25
- Target phase/environment: Local investor rehearsal; deployment preparation remains separate

## Change summary

- Remove separate scrolling and sticky headings from supporting navigation.
- Use one whole-sidebar scroll on desktop and mobile; expand account help inline.
- Keep role-specific destinations, permission checks, active-record expansion and workspace switching.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No API requests, mutation retries, permissions or resource boundaries are added. Existing offer-count failure handling remains authoritative. Tests retain denied workspace/private request behavior and no-write navigation checks. The test suite uses the existing single network-change recovery only for local read-only page navigation; no form action is replayed.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert the navigation change; no business-data compensation
- Configuration/secrets changed: none

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: buyer/supplier/admin desktop cases expand supporting navigation, check that it has no scroll constraint, reach each supporting link and reach sign-out after expanding inline account help. Mobile Escape/focus and active record coverage remain in the suite.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Web/browser typechecks, six navigation model cases and the web production build pass. All 17 production-build mocked-API navigation Chromium cases pass; changed TypeScript lint and the web transfer budget pass. Full release, native database journeys, CI and founder acceptance remain pending. This bundle is for local review; nothing has been pushed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- UX-002: founder tests the revised buyer/supplier/admin menu during a retained-data local rehearsal, including shorter windows and expanded account controls.
- UX-002: new admin sidebar queue badges require complete, scoped aggregate endpoints before display; this change keeps fee review information on its existing queue page and does not invent counts from a page of records.
- INV-003: complete the whole investor persona journey before deployment; this navigation revision does not grant deployment readiness.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
