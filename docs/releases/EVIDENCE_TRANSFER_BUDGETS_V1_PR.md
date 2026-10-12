# PR title

Bound evidence transfer concurrency and storage reads

# Replacement PR description

## Outcome

A burst of evidence transfers cannot start unlimited buffered uploads/downloads in one API process. Signed upload capabilities are validated before body allocation; saturation returns a retryable error. Oversized or stalled storage objects fail safely without a partial download.

## Tracking

- Backlog IDs: PER-003, SAF-002 (focused implementation slices; broad items remain open)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/EVIDENCE_RESOURCE_GAPS.md
- Target phase/environment: controlled pilot foundation/local release, then staging

## Change summary

- Share four process/two tenant nonqueued transfer slots across upload/download requests.
- Authenticate signed upload capability before raw body parsing and enforce a finite body deadline.
- Retain download admission until response finish/disconnect; release parser/processing failures safely.
- Cap local and S3 file reads and apply finite storage deadlines; remove a duplicate S3 upload buffer copy.
- Sanitize request queries, headers and invitation bearer-token paths so live capabilities cannot be logged.
- Record founder acceptance of access review and pilot feedback queues.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: tenant identity for signed upload admission comes from the validated intent, not a client-supplied organization. Completion still rechecks the authoritative intent lifecycle and exact bytes. Download authorization, scan status and payment release gates precede storage reads. Limits are process-local; no distributed lease claim.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert code/configuration together; existing data unchanged.
- Configuration/secrets changed: optional EVIDENCE_STORAGE_TIMEOUT_MS, default15000 and range500–120000; no new secret.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 739 API unit assertions passed. Quality, workspace/browser types, API/web builds, migration integrity and backlog checks passed. Ten new PostgreSQL/API regression cases compile strictly; native PostgreSQL/storage/scanner/browser runs require the exact-candidate verify:release. Append release SHA/report after pass and require GitHub CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- PER-003: durable scanner claims, quota-accounted object cleanup, storage existence checks outside transaction locks and maximum-size RSS/backpressure stress.
- PER-004 / PER-006: hosted SLO measurements, multi-instance admission/leases and crash recovery.
- SAF-002: owner-recorded deployment secret rotation and revocation; log sanitation alone is not completion.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Native acceptance and broad performance/security requirements remain pending.
