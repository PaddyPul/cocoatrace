# PR title

feat(operations): expose bounded queue backlog and actionable incident states

# PR body

## Outcome

A platform operator can distinguish delayed cleanup/notification work, terminal failures, expired leases and an incomplete observation from an empty queue. Failed or malformed monitoring clears the observation instead of claiming health, while retaining an open recovery explanation. Queue reads never claim or mutate work or send email.

## Tracking

- Backlog ID(s): OPS-006, OPS-010, ARC-014; CORE-workers.
- Issue/ADR: existing durable-operations runbook; no new ADR.
- Target phase/environment: pre-pilot local release candidate; hosted drills remain open.

## Change summary

- Add a private, snapshot-consistent backlog endpoint for object cleanup and payment-reminder/recall email queues.
- Probe indexed work states with a 1,001-row sentinel, cap displayed counts at 1,000 and label lower bounds. Retry/expired-lease observations cover the first 1,000 records.
- Show terminal, expired/missing lease, due-for-15-minutes and observation-limit incidents alongside job health. Reject inconsistent client envelopes.
- Add four partial indexes and native/browser/contract regression coverage. Carry forward founder acceptance of terminal-email recovery without closing broader operations gates.
- Correct Windows native-output capture while preserving exit-code and exact-commit release guards.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: wildcard platform-admin permission is required for global aggregate reads. Query parameters are rejected. Fixed SQL identifiers, no-store responses, bounded probes and read deadlines remain enforced. Responses omit recipient identities, message/provider content, object keys and record IDs. Reads do not claim, requeue or audit a mutation. Existing recovery retains its transactional authority, passkey, lease and audit checks.

## Database and deployment

- Migration required: yes, 037_operations_backlog_indexes; manifest registered without editing frozen migrations.
- Backfill/lock implications: no data backfill; four standard partial-index builds can block queue writes during migration. Apply during a controlled API/worker restart.
- Rollback or compensation: revert monitor code first; down migration drops only the added indexes. No queue records, audit events or quota accounting need compensation.
- Configuration/secrets changed: none. No outgoing alert recipient or paid provider configured.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author checks passed: 807 API unit tests, 13 final-probe signal cases, one client contract case, type checks, builds, quality, migration integrity and 3 backlog tests. Results and runtime limits are recorded in OPERATIONS_BACKLOG_WINDOWS.md. Full Docker release and required GitHub CI must pass for the candidate commit before merge; add passing SHA/date here. Native cases include denied reads, capped signals, unchanged state and a blocked read recovering after lock release. Browser cases cover incident display, malformed/unavailable observations and retained draft explanation. No hosted performance or failure drill is claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named queue region, scoped table headers and horizontal overflow; browser locator coverage added, no separate mobile visual acceptance claimed. Counts are state observations rather than confirmed inbox delivery or an SLA. The 15-minute threshold is an investigation warning, not a measured hosted SLO. Evidence scanning still uses durable job status; its complete backlog signals remain open.

## Follow-up work

- OPS-006: scanner/DB/HTTP/abuse signals, external alert delivery, incident owner and hosted drills.
- OPS-010 / ARC-014: complete operational adoption, general alert/callback outboxes and hosted failure evidence.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- OPS-006/OPS-010/ARC-014 and CORE-workers remain partial. Previous terminal-email acceptance is recorded separately; this candidate adds no full-item closure or progress credit before broader criteria are met.
