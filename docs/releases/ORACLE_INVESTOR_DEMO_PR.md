## Outcome

Provide a supervised Oracle investor demo with normal Request access and branded Gmail delivery, private administrator credentials and retained trade data. Keep the public maintenance page until the application is healthy and the first administrator is created. Permit optional updates only after successful quality-gate on the exact current main SHA.

## Tracking

- Backlog ID(s): INV-001, INV-003, IDN-021, OPS-008, OPS-009
- Issue/ADR: docs/adr/004-oracle-synthetic-demo.md; extends ADR 003 for synthetic demonstrations
- Target phase/environment: Phase 0 / Oracle synthetic investor demo; staging and production remain separate

## Change summary

- Separate Compose project, independent persistent volumes, loopback web ingress and private API/database/scanner.
- Root-only generated secrets, existing authenticated Gmail configuration and normal login with privileged passkey assurance.
- First-installation administrator bootstrap with password hashing, identity locks and transactional audit; refuse occupied installations.
- Withhold raw verification/invitation bearer links when demo rehearsal mode is off.
- Maintenance deployment, pre-migration database/evidence snapshots and fail-closed optional pull-based CI/CD.
- Detailed first deployment, hosted acceptance, pause and recovery instructions.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No shared seed users or public database/API ports. No real customer/commercial data admitted. SMTP and administrator passwords never enter command arguments or repository files. Bootstrap refuses existing identities and rolls back if audit fails. Deployment/CD share an exclusive lock; missing or unsuccessful exact-main CI blocks deployment. API proxy trust remains disabled, so the small demo audience shares an IP rate bucket.

## Database and deployment

- Migration required: no new migration; normal startup applies existing manifest-verified migrations
- Backfill/lock implications: initial bootstrap locks identity tables inside one short transaction; existing installations cannot use it
- Rollback or compensation: failed updates retain maintenance; restore matching database, evidence and secrets after isolated recovery verification; no automatic schema downgrade
- Configuration/secrets changed: new root-only demo.env with independent random database/JWT/evidence/invitation keys; existing smtp.env reused; no secret values committed

## Defect regression

- Defect severity: none; new hosted profile and preventive admission controls
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: bootstrap unit tests cover invalid input, occupied identities, hashing/atomic commit and audit rollback. PostgreSQL integration regression additionally covers concurrent installers and refusal of password replacement. Identity-link policy tests prevent hosted-demo bearer-link exposure while retaining explicit local rehearsal behavior.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: All 1,701 API unit tests passed across 178 files, including 21 focused bootstrap, identity-link policy, access workflow and email branding tests. API typecheck, API/web builds, lint and package script contracts passed. Bash syntax and Python/Compose YAML parsing passed; only web loopback ingress is published. PostgreSQL integration test added but not executed in the author environment. Full native release, GitHub CI, actual ARM64 Docker startup, SMTP inbox delivery and hosted founder acceptance remain mandatory and are not inferred.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

Browser diagnostics follow-up: founder's native release stopped on the contract unavailable-totals assertion and a supplier language-journey aborted navigation. The contract suite passed 24 author browser runs (eight tests repeated three times), so the root cause is not yet reproduced. Add masked failure JSON/screenshots, credential-free source locations and explicit focused suite selection. This instrumentation does not resolve or waive either failure; require focused evidence and a passing full release before push/deployment.

INV-001/INV-003: hosted buyer/supplier/admin rehearsal and restart acceptance. IDN-021: actual verification/invitation/team/reset inbox delivery and safe retries. OPS-008: scanner/outage exercise. OPS-009: coordinated restore, off-VM encrypted backup and immutable-image rollback evidence. Staging/production storage, database TLS and separate environments remain open under the existing environment backlog. Enable the optional updater only after the first hosted rehearsal passes.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
