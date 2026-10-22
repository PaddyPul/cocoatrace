## Outcome

Private evidence downloads cannot release bytes without a durable access event. Background scans and physical cleanup cannot report completed database transitions without their audit. Recovery keeps quota ownership when provider deletion succeeds before audit persistence fails.

## Tracking

- Backlog ID(s): UPL-014, ARC-013, QLT-002
- Issue/ADR: docs/engineering/EVIDENCE_LIFECYCLE_AUDIT.md; docs/engineering/mutation-audit-coverage.json
- Target phase/environment: Phases 1–2; local/native verification, then required CI. Hosted acceptance remains separate.

## Change summary

- Persist download release-readiness attribution before returning private bytes; omit successful access events on denied/missing content and fail closed on audit errors.
- Atomically audit maintenance clean/infected/failed decisions and cleanup completion, with explicit system attribution and recovery after provider deletion.
- Add seven native audit-trigger/recovery scenarios and two access-audit unit cases.
- Enforce an explicit 106-route mutation review inventory in CI/release, including read-only POST exemptions and curated background side effects. Explicit review gaps remain visible.
- Reconcile founder acceptance of PR #140 and remove already-complete PRD-005 from the next-unimplemented queue.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing access/scan/payment gates remain ahead of byte release. No object key, filename, document content, signature or raw provider error is added to audit metadata. Reserved non-human attribution is distinct from uploader identity. Provider deletion and PostgreSQL are not a distributed transaction; lost claims produce no completion event. The inventory checks declarations and drift, not universal transactional correctness.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no historical backfill; short conditional scan/completion statements additionally insert audit events. Each authorized nonempty download adds one critical audit insert.
- Rollback or compensation: code rollback stops new event coverage but preserves existing history/queue. On cleanup-completion audit failure, retain lease/quota ownership and retry after expiry; exhausted work uses existing reviewed recovery. Do not reset volumes or delete queue history.
- Configuration/secrets changed: none

## Defect regression

- Defect severity: P1
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: `audits only available authorized bytes and fails closed if access audit cannot persist`; `rolls a clean maintenance decision back if its audit fails and records the fail-closed outcome`; `does not queue infected bytes for deletion when the infected-decision audit rolls back`; `stops maintenance if the fail-closed state and its audit cannot commit together`; `retains cleanup ownership after provider deletion if its completion audit fails, then recovers once`. Native execution remains pending until the founder release run.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author 1,615 API unit tests, quality checks, API typecheck/build, web production build, authorization register/tests and 22 mutation-inventory/release-runner tests passed. Strict compilation of the final seven-case native addition also passed. Strict native-suite compilation is separate from execution. Record final author counts/builds and the founder candidate SHA/full-release summary before merge; Docker/PostgreSQL/browser runtime is unavailable on the author host. Seven new native cases are included in the existing evidence cleanup suite. No staging acceptance is inferred.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- No UI layout change. A critical access-audit failure returns the existing server-error path before attachment bytes/headers are sent. Existing browser evidence journeys remain part of full release verification.

## Follow-up work

ARC-013 exact-action mutation/outbox review and complete background-job inventory; QLT-002 remaining negative-resource matrix; UPL-010 expiring download links; UPL-013 retention/legal hold/backups; UPL-018 private restore; SEC-017 immutable retention; OPS-006 hosted ownership; IDN-021 real inbox; CT-01–18 optional Canton integration. The inventory's 97 review-required entries are unverified boundaries in existing implementations, not 97 confirmed missing-audit defects.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Accepted backlog remains 170/362 (47.0%). Target after UPL-014 runtime/matrix acceptance: 171/362 (47.2%). ARC-013/QLT-002 remain partial; core gates 11/28 and provider-inclusive 11/40 remain unchanged.
