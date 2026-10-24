## Outcome

Buyers, suppliers and platform operators can find their own next tasks without navigating an undifferentiated administration menu. The workspace selector now controls both Home and navigation, saved buyer requests have a direct register, and critical help/safety links stay reachable while the longer menu scrolls.

## Tracking

- Backlog ID(s): INV-003, UX-001, UX-002; UX-004/UX-005 and BRD-003 regression coverage
- Issue/ADR: Founder requested role-aware navigation review and implementation, 2026-10-24
- Target phase/environment: Phase 0 local investor rehearsal; deployment remains on hold

## Change summary

- Introduce shared permission-filtered buyer, supplier and platform administration menus and workflow-search destinations.
- Separate records from administration; label My trades and Goods payments explicitly; preserve direct trade registers and task-specific deal-room routes.
- Use one account-specific, validated workspace preference with legacy reads, denied-storage session fallback and unsaved-change protection.
- Add scoped saved sourcing requests with pagination, search, explicit read failures and links into existing review/matching flows.
- Show only validated offer counts, align English/French navigation, pin help/safety links and fit the shell below environment notices.
- Honor the pending review deep link in the existing fee register; retain manual page-load recovery with concise guidance.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: UI filtering does not grant authority. Existing server routes, tenant checks, MFA and business audit/outbox behavior remain authoritative. The request register checks grants before reads and refuses unrelated-owner rows. Count responses are validated and cleared on failure/account changes. Workspace selection does not replay writes; cancelling an unsaved-change review does not save the new preference. URL preferences are allowlisted, and generated request links encode IDs.

## Database and deployment

- Migration required: no new migration in this slice; earlier guided-workspace migration 054 remains applicable if not already deployed
- Backfill/lock implications: none; legacy preference keys remain readable and are not deleted
- Rollback or compensation: revert this UI commit; no financial or record compensation required. The new preference is additive and grants no authority.
- Configuration/secrets changed: none

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: navigationWorkspaces.spec.ts and scripts/navigation.test.mjs cover role visibility, shared destinations, account isolation, explicit request failures, wrong-owner refusal, counter recovery, fee deep links, storage denial, unsaved changes and mobile behavior. Existing investor admin fixture explicitly enters the administration workspace while retaining its receipt-review assertion.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author passed 78 production-build Chromium cases across 16 mocked-API suites (including 10 new navigation cases), 27 frontend-boundary/policy cases including five new navigation policy cases, six locale cases, all workspace/browser type checks, code quality, route-state and branding compatibility inventories, backlog checks, a fresh web production build and the unchanged 90 KiB initial JavaScript budget. Both dependency audits pass without exceptions. Desktop/mobile mock-workspace screenshots were visually inspected internally; no real-account screenshots are published. This frontend slice does not change API runtime code; API typecheck passes, and no new API unit/database runtime execution is claimed. The source tree was prepared on merged PR #148 main (860bd1e2373c3a3a03991c7ac66b50166dcf9c42). Native database/storage journeys, exact-candidate full Windows release and required GitHub CI remain required; Docker/PostgreSQL and staging are unavailable in the author workspace.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Counts distinguish supplier action from buyer waiting. Desktop/mobile menu and keyboard checks are targeted evidence, not universal accessibility certification. Private sourcing data stays scoped. Default admin views are distinct from trading views. No paid resources or external services are provisioned.

## Follow-up work

- INV-003: founder completes the full buyer/supplier/admin rehearsal and records remaining product issues; investor readiness is not inferred from the menu change.
- UX-001/UX-002: complete remaining workflow, physical-device and accessibility acceptance beyond the tested navigation slice.
- UX-004/UX-005: continue whole-application unavailable/partial/offline-state acceptance; a missing navigation count does not prove zero work.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
