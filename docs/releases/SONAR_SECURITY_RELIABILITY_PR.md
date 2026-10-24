## Outcome

Recovery rehearsals keep database/object archives in fresh private container directories. Critical user forms explicitly retain submit behavior, payment error presentation no longer shadows the built-in Error, and CI uses the lockfile-installed Playwright CLI without on-demand package resolution.

## Tracking

- Backlog ID(s): SEC-006, QLT-002; baseline findings tracked individually in docs/quality/sonar-triage-2026-10-24.json
- Issue/ADR: Founder-authorized SonarCloud remediation, 2026-10-24
- Target phase/environment: Phase 0 investor rehearsal and disposable release/CI; deployment remains on hold

## Change summary

- Address 31 baseline findings in source: 21 explicit form submit buttons, one component name, four CI package-resolution findings and five temporary-file findings.
- Allocate fresh mode-0700 directories in disposable database/Moto containers and pass the object workspace to all phases; reject insecure ownership, permissions or symlinks.
- Track all 211 exported issues with honest pending/review statuses; record Moto-only context for 25 findings without dismissing them.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing authorization, tenant isolation, audit/outbox, action confirmation and idempotency remain authoritative. Explicit submit types preserve existing enclosing forms. Private paths are generated inside the fixed disposable Compose project and are validated before backup. No real S3 endpoint, credential or bucket scope is added. npm install-script policy, PATH controls, default/demo credentials and the rest of the baseline remain open; no broad suppressions or gate relaxation are introduced.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert this commit; no trade data compensation required. Recovery directories are ephemeral and removed with rehearsal containers.
- Configuration/secrets changed: internal RECOVERY_WORKSPACE passed between runner and Moto-only script; no customer configuration or secrets changed

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable; Sonar severity does not establish a confirmed product P0
- Regression test and failure behavior: scripts/recovery-objects.test.mjs checks archive failure, invalid workspace output, stopping before pg_dump and teardown of only the disposable project. Existing browser suites exercise the affected submit actions and payment read errors. No test/action retries are added.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author passed 29 production-build Chromium cases across nine mocked-API suites, three recovery runner/canary cases, all API/web/browser typechecks, code quality, production web build and unchanged 90 KiB initial JavaScript budget, three backlog cases and both dependency audits without exceptions. An isolated Python guard check accepted an owned 0700 directory and rejected a public directory and symlink. Browser-backed identity/access-suspension, actual Docker backup/restore and hosted staging are not claimed as executed. Full Docker recovery, exact-candidate Windows release and SonarCloud rescan are required before acceptance. Local source changes are not proof of Sonar closure.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Four shared keyboard/accessibility regressions pass; no universal accessibility certification is claimed. No copy or navigation redesign; broader accessibility review remains open. No paid services or deployment resources are created.

## Follow-up work

- SEC-006/QLT-002: review 155 remaining baseline findings and finalize explicit dispositions for the 25 Moto-only findings. Reconcile all 31 source corrections against a fresh scan.
- SEC-006: obtain the eight dependency-risk package/version/advisory details and reconcile with the repository dependency gate.
- QLT-002: complete founder rehearsal and Docker/CI verification; preserve deterministic hash/signature ordering in later sorting remediation.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
