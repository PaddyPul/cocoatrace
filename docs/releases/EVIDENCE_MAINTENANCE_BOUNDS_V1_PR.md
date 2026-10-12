# PR title

Bound scanner maintenance and avoid full-file existence reads

# Replacement PR description

## Outcome

Maintenance scans no longer load every pending record or duplicate work across concurrent job invocations. Payment/delivery proof checks use metadata instead of buffering complete objects, and ClamAV receives bounded frames with backpressure rather than a second full-file payload.

## Tracking

- Backlog IDs: PER-003, OPS-010 (focused slices; broad items remain open)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/EVIDENCE_MAINTENANCE.md
- Target phase/environment: pre-pilot local release, then staging

## Change summary

- Cap scanner batches, process sequentially and serialize maintenance invocations with an exclusive database-session job lock.
- Persist infected status before file deletion; failed cleanup cannot erase known infection.
- Introduce local stat/S3 HEAD existence checks; replace payment/delivery reads that only checked for nonempty bytes.
- Stream ClamAV frames under socket backpressure, finite absolute deadlines and bounded response bytes.
- Record acceptance of the evidence transfer budget release.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: payment/delivery party, scan, review and document-release gates remain unchanged. The console scanner is a privileged operator action; no new public route. Locks are database-session scoped and released on process disconnect, not durable per-record claims. No file/token content is logged.

## Database and deployment

- Migration required: no
- Backfill/lock implications: one maintenance scanner job per database; scan I/O holds a session advisory lock, not a long database transaction.
- Rollback or compensation: revert code; do not erase infected metadata to force retry.
- Configuration/secrets changed: optional console-only EVIDENCE_SCAN_BATCH_SIZE, default50, integer1–100; no new secret.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 759 API unit assertions passed, including real TCP scanner tests. Quality, workspace/browser types, API/web builds, migration integrity and backlog checks passed. Eight new PostgreSQL/storage cases compile strictly; native PostgreSQL/storage/scanner and browser acceptance require exact-candidate verify:release. Append commit/report after pass and require GitHub CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- PER-003 / OPS-010: durable quota-accounted cleanup and scanner scheduling/dead-letter recovery; current job lock is not a persistent queue.
- PER-003: move remote existence checks outside trade transaction locks with authoritative revalidation.
- PER-004 / PER-006: maximum-size RSS/load measurements and distributed transfer admission/crash drills.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Native acceptance and broad performance/operations requirements remain pending.
