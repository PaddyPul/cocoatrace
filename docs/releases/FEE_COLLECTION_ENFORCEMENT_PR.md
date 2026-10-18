# Title
feat: enforce versioned platform fee collection before dispatch

## Outcome
New trades require seller agreement to the displayed fee and verified platform receipt before dispatch. An independent finance operator can grant time-limited credit or record an audited write-off. A payer reference alone cannot unlock dispatch. Existing contracts retain their recorded completion-time policy.

## Tracking
- Backlog ID(s): PAY-011/PAY-012, partial; PAY-013 reconciliation compatibility
- Issue/ADR: agreed fee collection follow-up,2026-10-17
- Target phase/environment: pilot candidate; no automatic payment-provider integration

## Change summary
- New v3 snapshot prepared atomically at offer acceptance; explicit consent binds amount/currency/rate/payer and policy text by immutable fingerprint.
- Allow collection before goods settlement for v3; preserve v2 timing and existing receipt/amount/payer protections.
- Gate dispatch before goods-payment exceptional authorization; preserve later arrival/delivery/safety records.
- Independent finance requires live authority and real fresh passkey; credit reason/revision/expiry (maximum30days) and revoke are audited. Audited write-off is a waiver, never a receipt.
- Positive unpaid v3 invoices more than7days past due block the payer creating or accepting offers. No blanket login, listing, existing-trade or safety suspension. Shared advisory scopes serialize commitments and fee decisions.
- Unstarted unpaid/no-submission v3 invoices can be voided by bilateral cancellation. Submitted/paid financial activity remains blocked pending finance resolution; no automatic refund or manual SQL recovery is supplied.
- Home preserves goods-plan setup before fee prompts. UI explains current policy and preserves reviewed inputs on failure.

## Security and data review
- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: missing v3 terms and snapshot drift fail closed. Consent and credit audit failures roll back. Existing finance receipt references remain private to payer/platform. No external funds move in these endpoints.

## Database and deployment
- Migration required: yes,049 adds terms/fingerprint/credit and unpaid lookup index. No historical enrollment/backfill.
- Backfill/lock implications: index creation on fee ledger; schedule according to deployed size. New commitments require migration availability.
- Rollback or compensation: prefer forward correction. Retain new-policy terms and receipt/credit history; dropping049 would remove controls/history and is not a safe routine rollback for active v3 trades.
- Configuration/secrets changed: new test-only TEST_LEGACY_FEE_POLICY flag for historical regression fixtures. Rejected outside test/disposable database configuration. Never enable it in deployment; new production trades default to v3. No production credentials added.

## Verification
- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 1,450 API unit tests passed; workspace/browser types, both builds, quality,229-route authorization inventory, migration integrity, web budgets, backlog/risk checks and native strict compilation passed. Native five-case suite covers simultaneous consent, real fresh-passkey finance, receipt versus reference, waiver/credit expiry/revoke, actual HTTPdispatch exception, overdue offer acceptance, unpaid cancellation and audit rollback. Browser scenarios cover exact consent binding and retained credit review. Runtime/full release still required. Legacy suites explicitly exercise v2; dedicated native suite turns on new-default enrollment through real HTTPacceptance and covers v3.

## Product and operations
- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work
PAY-011/PAY-012,LEG-010: approved external bank/channel instructions,tax treatment,outbound invoicing and paid/submitted-trade refund/compensation execution. Provider split collection is separate. Hosted controls and independent CI evidence remain required.

## Backlog update
- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Accepted roadmap completion stays153/343 (44.6%); this implements agreed enforcement but does not claim tax, actual bank collection or full financial operations closure.
