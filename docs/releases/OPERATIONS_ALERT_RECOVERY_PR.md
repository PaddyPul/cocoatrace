# PR title

feat(operations): add reviewed and audited terminal operator-alert recovery

# PR body

## Outcome

Platform administrators can investigate and retry failed operator alerts while preserving the original incident and recipient. Recovery refuses disabled delivery, resolved incidents, withdrawn/ineligible recipients, leases, recorded submissions and inconsistent or unknown failures. Failed refreshes keep the review explanation and never claim an empty register.

## Tracking

- Backlog ID(s): OPS-010, OPS-006, ARC-014; CORE-workers.
- Issue/ADR: durable-operations runbook; no new ADR.
- Target phase/environment: pre-pilot local release candidate; external inbox and hosted drills remain open.

## Change summary

- Add a bounded private terminal-alert metadata register and a strict reviewed-retry endpoint.
- Recheck fresh assurance and current operator/session authority inside the transaction; share the locked recipient-eligibility check with delivery.
- Preserve outbox/incident/recipient identity and atomically record the reviewing actor and explanation; concurrent reviews produce one successful transition.
- Add operator-alert recovery to Operations and preserve review state through conflicts, assurance errors and failed refreshes.
- Record founder-reported acceptance of the prior alerting workflow without inventing external delivery or hosted evidence.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: wildcard platform-admin access is required. Current user/organization/role/session and five-minute passkey assurance are rechecked under locks. Only a UUID and a trimmed 10–500-character reason are accepted; extra fields/query parameters are rejected. Reads use no-store, a fifty-row cap and bounded snapshot deadlines. Contacts, incident payloads, lease credentials and raw errors are omitted. Retry cannot send directly, replace the recipient, acknowledge a recall or change inventory/trade/payment state. SMTP is at least once; ambiguous earlier acceptance can still cause duplicate mail.

## Database and deployment

- Migration required: no; migration 038 and existing terminal index are unchanged.
- Backfill/lock implications: no backfill. Reviewed mutations hold existing actor/session/outbox/incident/recipient locks through audit commit; reads hydrate only the bounded terminal candidate set.
- Rollback or compensation: revert API/web code to remove the recovery control; preserve outbox and audit history. The earlier guarded schema rollback remains unchanged. No domain compensation required.
- Configuration/secrets changed: none. Default-off alerts and the existing opt-in local Mailpit configuration remain. No real external provider configured.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed 834 API assertions in 96 files, quality, workspace/browser types, strict native compilation, builds, pure client contract, migration integrity and backlog consistency. Twenty native cases and two additional browser scenarios supplied. Docker/full browser execution is unavailable here. Add the founder's passing candidate SHA/date and required CI results before merge; compilation is not a runtime pass. See OPERATIONS_ALERT_RECOVERY_WINDOWS.md.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named terminal region and existing labelled review dialog, retained-draft and failure regressions added. No separate mobile/visual audit claimed. Queueing is not SMTP acceptance, inbox delivery, incident resolution or inventory clearance.

## Follow-up work

- OPS-006/OPS-007/OPS-012: actual external inbox receipt, named incident owner, independent monitoring, broader scanner/HTTP/DB/abuse signals and agreed thresholds/hosted drills.
- OPS-010/ARC-014: complete hosted operational adoption, retention and external-callback acceptance.
- QLT-002/SEC/SAF: pilot authorization/resource evidence matrix and deployment-specific security verification.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- No full-row completion credit: roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%). Prior alerting workflow acceptance is recorded separately from this candidate and external acceptance.
