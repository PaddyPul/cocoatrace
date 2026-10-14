# PR title

feat(operations): add opt-in durable incident alerts for registered operators

# PR body

## Outcome

Platform operators can opt into email alerts for failed/stale scheduled jobs and overdue, expired or terminal queue work, with durable incident episodes and explicit alert-delivery status. Incomplete monitoring preserves prior incidents. Default-off configuration keeps synthetic demos and disposable tests from sending operator mail.

## Tracking

- Backlog ID(s): OPS-006, OPS-010, ARC-014; CORE-workers and CORE-observability.
- Issue/ADR: durable-operations runbook; no new ADR.
- Target phase/environment: pre-pilot local release candidate; external delivery and hosted acceptance remain open.

## Change summary

- Persist incident episodes, unique per-episode/operator outbox records and polling health; serialize one-minute cycles across replicas and CLI.
- Use bounded batches, finite retries, claim leases, SMTP readiness and current user/organization/role checks before submission.
- Show private disabled/unknown/pending/failed/stale/terminal status without leaking recipients or provider payloads.
- Add default-off configuration, local Mailpit-only override and maintenance commands; isolate tests/stress/public demos from opt-in settings.
- Record founder acceptance of the previous monitoring slice and retain broader operations gates as partial.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: status requires wildcard platform-admin permission and uses no-store; query parameters are rejected. Configuration accepts 1–5 registered user UUIDs, never request-provided addresses. Current eligible account email is resolved under locks. Generic messages contain only safe signals, detection time and the authenticated console link. No customer facts, tokens, keys or raw provider errors are included. Incident/outbox history records automatic actions without inventing a human audit actor. SMTP is at least once; a crash after relay acceptance can duplicate mail.

## Database and deployment

- Migration required: yes, 038_operations_incident_alerts; manifest registered, frozen migrations untouched.
- Backfill/lock implications: three new empty tables with indexes; no existing domain-row backfill. Controlled migrate/restart required. Enabled workers add one coordination connection per API process and require session-compatible PostgreSQL connections.
- Rollback or compensation: disable/revert code first and preserve incident/outbox records. Down migration refuses pending or terminal alerts; investigate rather than reset/delete history.
- Configuration/secrets changed: OPERATIONS_ALERTS_ENABLED (false), OPERATIONS_ALERT_RECIPIENT_USER_IDS (empty). Existing SMTP adapter reused with a maximum 10-second timeout and deployed TLS verification. No real provider credentials or recipients configured.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed 820 API assertions across 95 files, the pure client contract, workspace/browser types, strict native-suite/CLI compilation, quality, builds, migration integrity and backlog checks. Twelve native cases and two browser cases supplied. Docker/full browser execution is unavailable here. Add the founder's passing exact commit/report and required CI results before merge; compilation is not runtime acceptance. See OPERATIONS_ALERTS_WINDOWS.md.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named status region and retained recovery-draft regressions are supplied; no visual/mobile audit claimed. A successful SMTP check/submission is not inbox receipt. Pending work remains visible, terminal alerts require investigation, and continuous incidents do not send repeated reminders. A stopped API/database/SMTP path needs independent monitoring.

## Follow-up work

- OPS-006/OPS-007: actual external inbox/owner acceptance, independent alert path and hosted drills; scanner/HTTP/DB/abuse signal expansion.
- OPS-010/ARC-014: reviewed terminal-operator-alert recovery, retention/operational adoption, external callbacks and hosted failure acceptance.
- OPS-012: agree measured pilot SLOs and warning thresholds.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Broad gates remain partial. No full-item completion credit: roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%).
