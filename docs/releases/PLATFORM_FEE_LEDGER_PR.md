# PR title

Add platform fee statements, verified collection and finance reconciliation

# PR description

## Outcome

Completed trades now give the recorded fee payer a clear next action in the deal room. A submitted bank reference stays awaiting verification until platform finance confirms the full fee amount/currency and a unique receipt. Fees can be rejected or explicitly written off without changing completed goods payment or custody.

## Tracking

- Backlog ID(s): PAY-011, PAY-012, PAY-013, QLT-007
- Issue/ADR: No separate issue linked; runbooks/PLATFORM_FEE_LEDGER.md defines the bounded policy and open commercial decisions.
- Target phase/environment: Phase 2/3 commercial operations; local native release and GitHub CI before controlled pilot.

## Change summary

- Preserve seller-paid completion fees; snapshot payer organization, policy version and configured rate at acceptance.
- Calculate new fee estimates using PostgreSQL NUMERIC; display the quote before acceptance and reject stale quoted rates.
- Accrue due fees with critical audit inside the existing settlement transaction.
- Add scoped commercial statements/downloads, payer submissions and platform-only verified receipt/rejection/write-off operations.
- Keep history, block self-verification and enforce unique receipt references across concurrent confirmations.
- Integrate due/waiting states into the dashboard and fee controls into the deal room; add a platform finance page.
- Export read-only ledger statements, discrepancies and totals separately by currency as JSON.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Commercial payer permissions protect submissions. Platform finance permission protects global read/verification/write-off. Ordinary parties remain scoped; buyers do not receive payer payment references. Payers cannot self-verify/write off. UUID/reason/decimal/currency validation, contract-first locks, one pending submission and a case-insensitive unique receipt index protect mutations. Audit and mutation commit together. Finance exports are private JSON; no spreadsheet formula execution. No new outgoing email or payment provider call is added.

## Database and deployment

- Migration required: Yes, additive 029_platform_fee_ledger.ts with registered manifest hash.
- Backfill/lock implications: Resolve legacy payer metadata from existing seller/buyer labels and infer due timestamps from recorded issuance/completion; preserve amounts/currencies/statuses. Unknown/drifted records require review. Row locks acquire contract before fee/submission; receipt uniqueness also protects different invoices.
- Rollback or compensation: Retain financial/audit history and use a forward correction. Down refuses deletion. Do not restore an older image over collected-fee state without reviewing compatibility.
- Configuration/secrets changed: No new secrets. PLATFORM_FEE_BPS remains the existing setting/default and affects future trades only. Integration fixtures explicitly pin 100 bps; production settings are unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 261 API unit tests, ten quality/script-policy checks, API/web/browser type checks, builds, migration integrity and diff checks passed locally. Supplemental SQL exercised migrations, decimal fee creation, settlement, receipt verification/retry/uniqueness, write-off and reconciliation. Fourteen PostgreSQL API cases (including races and critical-audit rollback) and one real browser fee journey are included but not run here. Native verify:release, image scans, all browser journeys, recovery and CI must pass; mark relevant boxes after actual results. Supplemental SQL is not concurrency proof.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Explicit estimated/due/submitted/verified/void/write-off states and labeled inputs are present. Existing logging redaction is retained; private statements/export responses use no-store. Native browser/accessibility checks remain pending. The app does not hold money or call a receipt reference verified until finance acts. Statements explicitly say tax treatment is unconfigured and are not tax invoices.

## Follow-up work

- PAY-011 / LEG-010: Approve real commercial rate/payer policy, collection channel, legal entity and tax treatment before live charging.
- PAY-012: Official invoice numbering/tax content and outbound invoice email delivery.
- PAY-013: Reconcile actual bank/provider records and archive finance evidence.
- CUR-001–CUR-003: Currency policy, supported minor-unit precision and exact money throughout goods payments; this wave retains the existing two-decimal fee schema.
- LOG-006: Partial receipts/settlement, credits, refunds and return disposition.
- QLT-007: Continue strict-module adoption.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

The technical collection ledger does not close tax/commercial approval, official invoice delivery or actual bank reconciliation.
