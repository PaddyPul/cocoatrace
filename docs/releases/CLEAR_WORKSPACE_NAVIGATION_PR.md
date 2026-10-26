## Outcome

Buyers inspect source provenance through listings and trades without supplier source/harvest registers in their menu. Suppliers retain their source registers, and both organization-admin roles retain team access. Platform administrators can reach document review and operational records without switching trading workspaces. Supporting navigation is organized into Records, Organization and Account & help, preserving one whole-sidebar scroll.

## Tracking

- Backlog ID(s): UX-002, INV-003
- Issue/ADR: Founder-requested navigation content and route-coverage revision, 2026-10-26
- Target phase/environment: Local investor rehearsal; deployment preparation remains separate

## Change summary

- Keep Sources & plots and Harvest batches out of the buyer menu and workflow search, even when provenance read permissions are present. Preserve source/detail routes and permissions for contextual inspection through listings and trades.
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
- Regression test and failure behavior: buyer/supplier admin and ordinary-member cases check Team & access visibility and navigation; an admin case opens Document review. Existing desktop/mobile single-scroll, keyboard, workspace switching, malformed response and unsaved-change cases remain. Model tests cover buyer source-register exclusion and every registered route's entry classification.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: This buyer-menu correction passes 10 navigation model/route cases, 23 production-build mocked-API navigation Chromium cases, web/browser typechecks, changed-file lint, production web build and the unchanged initial-transfer budget. Prior broader navigation checks are recorded in the previous commit. Full native release, database-backed journeys, CI and founder acceptance remain pending. Nothing has been pushed.

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
