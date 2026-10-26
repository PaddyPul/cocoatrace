## Outcome

Buyers and suppliers can discover permitted source records and organization team access. Platform administrators can reach document review and operational records without switching trading workspaces. Supporting navigation is organized into Records, Organization and Account & help, preserving one whole-sidebar scroll.

## Tracking

- Backlog ID(s): UX-002, INV-003
- Issue/ADR: Founder-requested navigation content and route-coverage revision, 2026-10-26
- Target phase/environment: Local investor rehearsal; deployment preparation remains separate

## Change summary

- Show buyer source and batch records according to read permissions, rather than hiding them by workspace.
- Put Team & access and organization settings in Organization. Both buyer and supplier organization admins receive the same permission-based entry; ordinary members do not receive management rights.
- Add admin Document review and a separate Records group for contracts, inventory, sources, documents, payments and transport.
- Add Account & help entries for security, workspace setup, limitations, service status and platform responsibilities. Keep the walkthrough replay in the account card.
- Recognize current URLs when highlighting and expanding groups; preserve contextual detail routes and workflow search.
- Record all 59 route entry paths in docs/quality/navigation-route-coverage.json and check route coverage alongside role-specific menu boundaries.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No API endpoints, mutation retries, role grants or resource boundaries are changed. Existing offer-count failure handling remains authoritative. Tests retain denied workspace/private request behavior and no-write navigation checks. The test suite uses the existing single network-change recovery only for local read-only page navigation; no form action is replayed.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert the navigation change; no business-data compensation
- Configuration/secrets changed: none

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: buyer/supplier admin and ordinary-member cases check Team & access visibility and navigation; an admin case opens Document review. Existing desktop/mobile single-scroll, keyboard, workspace switching, malformed response and unsaved-change cases remain. Model tests cover permitted buyer records and every registered route's entry classification.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 42 frontend/policy cases, six locale cases and 33 production-build mocked-API Chromium cases pass. Web/browser typechecks, code quality, web production build and the unchanged 90 KiB initial transfer budget pass. Full native release, database-backed persona journeys, CI and founder acceptance remain pending; this bundle is for local review and has not been pushed.

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
