# PR title

feat(operations): add audited recovery for terminal notification emails

# PR body

## Outcome

Platform operators can review failed payment-reminder and recall emails and requeue eligible records with an explanation. Refreshes and rejected decisions retain that explanation. Retries preserve the original recipient and business identity and require current administrator authority and fresh passkey assurance.

## Tracking

- Backlog ID(s): OPS-006, OPS-010, ARC-014; pilot gate CORE-workers.
- Issue/ADR: existing durable-operations runbook; no new ADR.
- Target phase/environment: pre-pilot local release candidate; hosted operation remains open.

## Change summary

- Add bounded, redacted terminal-email registers and queue-specific retry actions to the Operations monitor.
- Lock and recheck authority, session and outbox state; commit the retry and audit together. Concurrent retries produce one successful decision.
- Cover denied authority, suspension races, stale assurance, invalid input, inconsistent state, audit rollback and preserved browser drafts.
- Record the implementation as a candidate without closing broader operations gates.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: platform-admin routes only; enumerated queue identifiers, UUID IDs and strict 10–500 character explanations. Registers omit recipients, message content and raw provider errors. Only terminal, unleased records without recorded submission are eligible. Requeueing is not direct sending. Existing workers retain delivery checks. SMTP acceptance before a crash can still lead to duplicate email; the review dialog states that limit.

## Database and deployment

- Migration required: no; existing migration 036 terminal-outbox indexes are reused.
- Backfill/lock implications: no backfill; short transactional identity/session and outbox-row locks during each decision.
- Rollback or compensation: revert application changes; already queued rows remain durable worker input and committed audits remain. Investigate any ambiguous SMTP submission before another retry.
- Configuration/secrets changed: none.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author checks passed: 793 API unit tests in 93 files, quality, workspace types, strict native integration compilation, API/web builds and 3 backlog tests; details are recorded in TERMINAL_EMAIL_RECOVERY_WINDOWS.md. The supplied IDE handoff reports 26 focused integration and 6 mocked-browser cases passed. Full exact-commit release verification and required GitHub CI must pass before merge; add the passing SHA/date here. No hosted verification is claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: accessible named queue sections/dialogs and explicitly associated explanation labels; automated locator coverage supplied. No separate visual/mobile or hosted acceptance is claimed. A queued result does not confirm inbox receipt, acknowledge a recall or release inventory.

## Follow-up work

- OPS-006 / OPS-010: complete backlog/failure monitoring, external alerts, incident ownership and hosted failure drills.
- ARC-014: complete operational adoption and hosted validation; this slice covers reviewed terminal-email recovery only.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Broad operations items and CORE-workers remain partial. Record founder release/merge acceptance after confirmation without treating this slice as completion of all monitoring work.
