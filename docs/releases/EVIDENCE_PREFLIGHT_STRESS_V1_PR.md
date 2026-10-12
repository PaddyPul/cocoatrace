# PR title

Move proof checks outside trade locks and gate transfer memory

# Replacement PR description

## Outcome

Slow evidence storage no longer holds payment, document-presentation or discrepancy write locks. Transactions revalidate current proof and party authority before mutation. A disposable parallel transfer canary now gates release and CI using measured API RSS.

## Tracking

- Backlog ID(s): PER-003, OPS-010
- Issue/ADR: docs/runbooks/EVIDENCE_RESOURCE_GAPS.md
- Target phase/environment: pilot prerequisites; disposable local/CI test

## Change summary

- Commit a scoped read before bounded metadata probes; lock and compare current proof metadata including review, scan and cleanup state before changing a trade.
- Preserve idempotent payment replay and reject changed or unrelated proof.
- Exercise four 10 MiB uploads and slow downloads through real HTTP, Moto S3 and ClamAV; verify busy responses and downloaded hashes, sample API RSS against 512 MiB.
- Add release/CI gate and correct hardened runtime maintenance instructions.
- Correct synthetic bucket environment isolation, test the real config parser and report allowlisted startup failure stages.
- Configure the disposable Knex migration source explicitly and verify real migration file enumeration.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: strict disposable database and empty-schema guards; diagnostics use child IPC, no public endpoint. Reports omit credentials/capabilities. Boolean HEAD cannot prevent out-of-band storage mutation after preflight.

## Database and deployment

- Migration required: no
- Backfill/lock implications: provider I/O moves outside write locks; proof rows remain locked during authoritative mutation validation.
- Rollback or compensation: revert code; no data rewrite.
- Configuration/secrets changed: no production secrets; synthetic stress settings and loopback disposable ports.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 777 API assertions, types/builds/quality, 15 runner checks and migration integrity pass; nine new native race/authority cases compile strictly. Docker/native/browser/RSS execution awaits exact-commit founder release and CI. Append tested commit and safe stress report after those pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- No UI layout change. Measured host API RSS excludes scanner, database, storage and client processes; does not prove hosted capacity.

## Follow-up work

PER-003: streaming, distributed admission, slow/abort/crash canaries, provider versions and hosted measurements. OPS-010: scheduling, alerts and dead-letter recovery. Recall resolution proof eligibility is the next security slice.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Broad items remain open; founder acknowledgement records this slice only.
