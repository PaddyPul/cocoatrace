# PR title

Track failed evidence deletion and retain its quota charge

# Replacement PR description

## Outcome

Failed file deletion no longer silently releases tenant storage quota. Private object ownership is recorded before writes; retry and dead-letter work remains visible and charged until deletion is acknowledged. Completed clean evidence remains protected from cleanup.

## Tracking

- Backlog IDs: PER-003 / OPS-010 / UPL-015 (focused slices; broad items remain open)
- Issue/ADR: docs/DELIVERY_BACKLOG.md; docs/runbooks/EVIDENCE_CLEANUP.md
- Target phase/environment: controlled pilot foundation/local release, then staging

## Change summary

- Add migration035 private object ledger with ownership, provider snapshots, leased claims, retries and dead-letter states.
- Register quarantine before writes and final-copy reservations before promotion; complete evidence/intent/ledger changes atomically.
- Remove request-path deletion fan-out; immediate cleanup is acceleration after durable enqueue.
- Count unfinished object obligations toward quota without double-counting evidence; reserve temporary promotion copies.
- Persist maintenance infection and cleanup work together; preserve infected status when deletion fails.
- Prevent malformed replays from rejecting already claimed uploads.
- Record acceptance of scanner maintenance and metadata-only checks.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: no new public route. Worker checks environment, provider and live references; clean retained proof is never deletion work. Claim tokens fence durable completion. Logs omit object keys and raw provider errors. Historical provider ownership is not fabricated.

## Database and deployment

- Migration required: yes — 035_evidence_object_cleanup; existing frozen migrations unchanged.
- Backfill/lock implications: new table/indexes; no inferred historical-object ownership. Legacy noncompleted reservations remain conservatively charged until reviewed inventory.
- Rollback or compensation: preserve the ledger; down refuses while it owns unfinished/live objects. Stop new writes and use a reviewed forward repair. Do not drop/reset to free quota.
- Configuration/secrets changed: optional console-only EVIDENCE_CLEANUP_BATCH_SIZE, default50/max100; no new secret. Always-running scheduling remains follow-up.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 771 API unit assertions passed. Quality, workspace/browser types, API/web builds, migration integrity and backlog checks passed. Fifteen new PostgreSQL cases compile strictly; exact-candidate verify:release must supply native migration/storage/browser acceptance. Append SHA/report after pass and require GitHub CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- OPS-010: always-running scheduling, monitored retries and operator dead-letter recovery.
- PER-003: historical-object inventory, provider I/O outside trade locks and maximum-size RSS/backpressure stress.
- PER-004 / PER-006: hosted capacity and distributed admission/crash measurements.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Native acceptance and broader operational/performance requirements remain pending.
