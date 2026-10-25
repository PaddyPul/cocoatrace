## Outcome

Buyers, suppliers and platform administrators can reach daily work without scrolling through the sidebar's record lists. A single supporting disclosure replaces the two supplier/buyer record groups. Compact screens retain one natural drawer/sidebar scroll so account and safety controls remain reachable.

## Tracking

- Backlog ID(s): UX-002, INV-003
- Issue/ADR: Founder-approved buyer/supplier/admin navigation revision, 2026-10-25
- Target phase/environment: Local investor rehearsal; deployment preparation remains separate

## Change summary

- Keep supplier Home, My supply, Offers and My trades in a fixed primary area, with one workspace label and a distinct Publish supply action.
- Keep buyer Home, Sourcing requests, Find supply, Offers and My trades in that primary area, with the existing create-request action.
- Reduce platform-admin daily navigation to Overview, Access requests, Fee verification and Operations; place occasional tools in Administration.
- Combine supporting source/trade registers under one Records disclosure. Auto-open the section for an active record and keep its summary reachable while supporting rows scroll.
- Keep Notifications, Trace & recall and Help in a compact visible utility row. Account controls use a disclosure; mobile and short viewports use one natural scroll instead of nested scrolling.
- Retain workspace switching, per-account preference storage, permission gates, offer count validation, workflow-search destinations, keyboard behavior and unsaved-navigation review. Preserve English/French navigation coverage.

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
- Regression test and failure behavior: buyer/supplier/admin primary links remain within a 1280x768 viewport while supporting records scroll independently; active record deep links open Records; a 390x600 mobile drawer uses one natural scroll and retains sign-out reachability and Escape focus return. Model tests enforce exact role-specific primary groups, one secondary group, permission filtering and no duplicate destinations.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 38 frontend/policy cases, six locale cases and 33 production-build mocked-API Chromium cases across navigation, shared accessibility, brand identity, unsaved changes and pilot-limitations suites pass. Web/browser typechecks and code quality pass. Production web build passes the unchanged 90 KiB initial transfer budget. Native database-backed full release, API build/typecheck, hosted staging and founder manual rehearsal were not run by the author; the exact-candidate Windows release and CI remain gates.

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
