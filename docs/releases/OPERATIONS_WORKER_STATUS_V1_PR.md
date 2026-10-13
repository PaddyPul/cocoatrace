# PR title

Schedule bounded operations and add audited cleanup recovery

## Outcome

Evidence scanning and private-object cleanup run automatically alongside existing reminder/recall delivery. Platform administrators can see missing, stale or failed jobs and review safe cleanup retries without editing database rows. Physical-byte ownership, recall holds and trade state remain protected.

## Tracking

- Backlog IDs: OPS-010, OPS-006; supporting PER-003 and UPL-015
- Issue/ADR: docs/runbooks/OPERATIONS_JOBS.md
- Target phase/environment: core pilot; local/captured-email acceptance before hosted rollout

## Change summary

- Four independent, bounded job loops with PostgreSQL session locks, durable run/failure records and unchanged domain leases; delivery retains its 15-second interval.
- Private Operations monitor and runtime status CLI; missing/stale/malformed/suppressed results cannot claim healthy delivery.
- Fresh-assurance platform-admin cleanup retry, locked current authority, atomic audit and preserved quota; unsafe reference/key/provider failures refuse retry.
- Graceful worker drain under the existing shutdown deadline, additive migration 036 and terminal-work indexes.
- Native concurrency/authorization/recovery regressions, browser monitor/error/form-preservation cases and backlog acceptance reconciliation.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: operations reads/writes require platform `*`; fresh assurance and current identity/session/role are rechecked inside recovery. No object keys or recipient addresses are returned. Retry does not delete evidence directly, clear inventory holds or release quota. SMTP remains at least once.

## Database and deployment

- Migration required: yes — 036_operations_job_status, manifest registered; frozen migrations unchanged.
- Backfill/lock implications: no business-data backfill; partial indexes are ordinary CREATE INDEX and can take write locks during migration. Schedule hosted upgrade accordingly. Worker locks use up to four additional PostgreSQL session connections per API replica; transaction-mode poolers are unsupported.
- Rollback or compensation: previous API/web images can run with the additive table/indexes present; preserve durable queues, cleanup ownership and audits.
- Configuration/secrets changed: no new secret or external provider; existing database/storage/scanner/SMTP configuration applies.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 788 API assertions across 92 files pass on sequential rerun; author quality, workspace/browser type checks, API/web builds, migration integrity and backlog tests pass. New native suite and CLI compile strictly. New PostgreSQL/browser cases await founder full release; author has no Docker/PostgreSQL/browser runtime. One existing trace-budget unit timed out when builds ran concurrently; the subsequent full-suite sequential rerun passed all 788 assertions. Production deadlines were not changed. Update native/E2E boxes only after verify:release passes for the exact candidate commit; hosted box remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named regions/controls, explicit failure presentation and horizontal table overflow are implemented; browser/keyboard/hosted acceptance remains pending. SMTP acceptance does not prove inbox delivery. The API RSS stress gate does not measure combined scheduled-worker load.

## Follow-up work

- OPS-006: external alert routing/collector, complete abuse/DB/backlog signals, named owner and hosted alert drills.
- OPS-010: reviewed terminal-email recovery and hosted scheduling/failure acceptance.
- PER-003: cross-instance transfer admission, streaming and combined hosted worker/transfer capacity.
- UPL-015: complete operational quota/abuse monitoring.

## Backlog update

- [x] Items remain open and are marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
