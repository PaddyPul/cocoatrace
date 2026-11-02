## Outcome

Make the existing Oracle investor demo updateable without the temporary web health override or Git permission failures. Reject malformed administrator input with safe, field-specific errors. Add consistent database/document snapshots and a separate restore rehearsal that cannot replace the live installation.

## Tracking

- Backlog ID(s): INV-001, ENV-005, ENV-013, ENV-017, OPS-002, OPS-009, IDN-021
- Issue/ADR: extends docs/adr/004-oracle-synthetic-demo.md; founder-reported deployment failures on merged ab7dcfb
- Target phase/environment: Phase 0/1; existing synthetic Oracle investor demo, not staging/production admission

## Change summary

- Permanent IPv4 web-to-API readiness; formatted Caddy configuration.
- Read-only Git inspection, explicit failure handling, narrow legacy index repair and shared maintenance locking; refuse older/divergent releases.
- Collect administrator input before starting its bootstrap container, reject control characters explicitly, preserve valid Unicode passwords and provide value-free input/SQLSTATE diagnostics. Existing accounts and secrets are preserved.
- Stop writers for consistent snapshots; record exact source images, schema/table/sequence state and evidence-byte fingerprints. Verify restores in isolated, labeled, networkless disposable resources, with corruption rejection and failure cleanup.
- Add a disposable CI restore job and reconcile partial backlog/gate evidence with the founder's real demo/email observations.
- Address PR #158 security findings: eliminate administrator CLI output paths, use fixed private CI report filenames, reject symlink output directories, move locks out of publicly writable /run/lock and replace the email backtracking regex. No Sonar exclusions or suppressions.
- Patch the newly reported qs, Vite and minimatch advisories. The minimatch development-tool override crosses a major version because the advisory's patched release is 11.0.1; lint and the repository policy checks exercise the ESLint consumers. No advisory suppression is added.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Root-only snapshot data/credentials; no secret values in errors or public reports. Restore archive traversal, links, special files, duplicate objects and corruption are rejected. Rehearsals use exact cached images and never start the app or SMTP. Cleanup checks per-run labels and only targets newly created resources. Bootstrap still refuses occupied installations and persists audit atomically. Missing/failed CI or Git inspection stops deployment. No real customer data admission follows.

## Database and deployment

- Migration required: no new migration; normal startup retains existing manifest checks
- Backfill/lock implications: short maintenance window stops API/web writers for a consistent database/evidence snapshot; existing bootstrap identity-table lock retained
- Rollback or compensation: failed deployment retains maintenance; isolated restore verification only, with no automatic live database restore or migration downgrade
- Configuration/secrets changed: health command and maintenance tooling; no rotation, replacement or regeneration of existing secrets; legacy temporary health overlay can be retained privately

## Defect regression

- Defect severity: P1
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: Git inspection cannot fall through on command error; dirty worktrees and unsuccessful/wrong-SHA CI fail closed. Bootstrap tests identify invalid fields without exposing values and reject terminal controls while retaining Unicode. Recovery tests reject malicious/corrupt archives and running writers; CI restores actual synthetic rows/sequences/document bytes and checks failed-restore cleanup/source preservation.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author: 1,704 API unit tests, workspace type checks, API/web builds, 15 quality-policy tests (including five Linux maintenance checks and ten Python admission tests), eight Sonar closeout tests and backlog/risk/pilot-evidence checks passed. Clean npm ci and npm ls passed with qs 6.16.1, Vite 6.4.5 and minimatch 11.0.1; the production and complete dependency gates passed with no exceptions. Native full release, Docker database/browser suites, the CI restore fixture and actual Oracle update/non-empty-evidence restore require their own passing reports; Docker is unavailable in the author environment. No run is inferred from a script or YAML parse.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

OPS-002/009: actual Oracle non-empty-evidence rehearsal, encrypted off-VM backup and reviewed disaster-recovery cutover/RPO/RTO. ENV-004/006/009/010: separate staging/production isolation, encrypted storage, database TLS and immutable promotion/approval. IDN-021/BRD-005: spam placement and verification/invitation/team/reset inbox acceptance. INV-002/003: independent hosted trade rehearsal. PER-004: capacity under concurrent hosted work. These are not closed by this tooling.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Reconciles reported live demo, Request access and spam-folder delivery without inventing whole-item closures. Strict completed-item percentage is regenerated from the current tracker, with no partial credit.
