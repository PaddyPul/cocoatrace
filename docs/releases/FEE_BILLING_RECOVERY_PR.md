# Title
feat: deliver durable fee statements and review external fee refund recovery

## Outcome
Payers receive a queued commercial fee statement when an invoice is issued, and operators can investigate/retry terminal email failures without changing payment state. An eligible unstarted trade with a verified paid platform fee can progress through a full external fee refund review before bilateral cancellation. Recording a reference does not claim a bank transfer or automatically refund goods payments.

## Tracking
- Backlog ID(s): PAY-011/PAY-012 in progress; PAY-013 compatibility; no broad closure credit
- Issue/ADR: agreed fee collection and cancellation recovery follow-up
- Target phase/environment: pilot candidate; existing SMTP adapter and external manual refund

## Change summary
- Commit fee statement outbox work with invoice issuance, deduplicate by fee/recipient and recheck current payer contact eligibility before SMTP.
- Add bounded lease/retry/terminal processing and a fifth independent scheduled worker. Extend private metadata-only backlog and reviewed terminal email recovery.
- Add immutable full-fee refund request/history, independent fresh-assurance finance review and external-reference recording, followed by payer confirmation.
- Bind mutations to current snapshots/revisions; preserve exact invoice currency/amount, recipient, authorization and audit transaction boundaries.
- Keep cancellation blocked until eligible fee recovery is confirmed; preserve started transport, goods-payment, delivery, dispute and custody protections.
- Present billing/refund states and preserve review drafts through refresh and refused/conflicting requests.

## Security and data review
- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: live account/session/authority and fresh assurance are rechecked for reviewed mutations. Critical audit failure rolls back financial/recovery changes. SMTP remains at least once; recorded submissions cannot be retried. No arbitrary recipient override or external bank execution.

## Database and deployment
- Migration required: yes, 050 immutable refund requests/events and 051 fee statement outbox/job-name extension/indexes.
- Backfill/lock implications: no historical invoice rewrite or fabricated refund receipt. New indexes and constraint changes require controlled migration/startup planning.
- Rollback or compensation: prefer forward correction and preserve financial/outbox/audit history. Revert application code before any schema change; do not drop populated refund history or rewrite payment state manually.
- Configuration/secrets changed: no new bank/payment credentials. Delivery uses existing configured SMTP; disabled email is not delivery success. Five worker lock connections per replica, plus the separate enabled alert coordinator, must fit database capacity.

## Verification
- [x] Unit tests — 1,472 passed
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck; web/browser types and strict native-suite compilation
- [x] Web production build and compressed entry budget
- [ ] Staging verification
- Evidence/results: Author units, types, API/web builds, authorization register, migration integrity, backlog and risk checks passed. Native/browser/full release runtime remains pending. Native suites: feeRefunds, feeStatementDelivery and expanded operationsEmailRecovery. Browser coverage must exercise refund review and fee email recovery. Author environment cannot claim native/browser runtime acceptance.

## Product and operations
- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: queueing/submission is distinct from inbox receipt; sent refund reference is distinct from payer-confirmed receipt. Full platform-fee recovery only for eligible unstarted trades; no tax calculation, partial refund, goods refund or provider transfer promise.

## Follow-up work
PAY-012 may close after full release/merge acceptance of commercial statement delivery plus existing paid/write-off status. PAY-011 and LEG-010 remain open for approved channels/instructions, tax/legal treatment, broader cancellation/partial-refund recovery and provider-confirmed collection. Independent hosted monitoring, real inbox acceptance and named incident ownership remain separate acceptance work. Accepted completion is 153/343 (44.6%); PAY-012 acceptance would make 154/343 (44.9%).

## Backlog update
- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
