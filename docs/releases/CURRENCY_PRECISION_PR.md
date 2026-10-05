# PR title

Add snapshotted currency precision and whole-yen JPY trades

## Outcome

Suppliers can publish JPY supply. Accepted JPY trades calculate whole-yen totals, deposits, balances and seller completion fees; buyers see whole-yen payment schedules and finance cannot verify a fractional-yen receipt. Existing records—including historical fractional JPY—keep their original amounts and two-decimal meaning.

## Tracking

- Backlog ID(s): CUR-001, CUR-002, CUR-003
- Issue/ADR: docs/runbooks/CURRENCY_PRECISION.md
- Target phase/environment: Phase 2 currency foundation; disposable test environments then controlled pilot

## Change summary

- Add server-recorded currency_minor_units snapshots to contracts, payment requests, installments and fee invoices, plus database precision constraints.
- Extend exact decimal multiplication/deposit allocation to zero precision; use whole-yen fee rounding and precision-aware reconciliation/receipt validation.
- New JPY starts with a draft prepayment plan; reject deposit plans that round either installment to zero. Supplier proposal and buyer agreement remain required.
- Display monetary snapshots and retain four-decimal unit quotes. Enable JPY publication; expand native regressions and the real fee journey to GHS and JPY.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing permissions, contract-first locks and transactional audits remain. Reject precision drift, fractional money and fractional JPY receipts; no silent currency conversion. Financial snapshots are created server-side. No new provider call, email, file handling or secrets. Physical arrival/containment records remain available; dispatch and settlement enforce financial alignment.

## Database and deployment

- Migration required: Yes, 030_currency_precision.ts, registered in the manifest.
- Backfill/lock implications: Adds NOT NULL default-2 precision metadata and CHECK constraints; validates existing monetary rows, requiring ALTER TABLE locks. No amount, currency, status or ownership changes. Defaults preserve legacy JPY decimals. New accepted JPY explicitly uses 0. Schedule during a low-traffic window when applied to a live database.
- Rollback or compensation: Down refuses precision-history deletion. Use a forward correction; older images should not process whole-yen contracts without reviewing compatibility.
- Configuration/secrets changed: None. New fee policy label seller-completion-v2 snapshots precision-aware behavior; existing fee policies/amounts remain unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 294 API unit tests, quality checks, workspace/browser types, builds and migration integrity passed locally. Supplemental PGlite serial checks passed for JPY fulfillment, deposit conservation, fractional-amount database rejection, zero-split rollback, actual settlement, fractional receipt rejection, fee verification/reconciliation and the EUR regression. An actual 029-to-030 supplemental upgrade preserved existing fractional JPY records; down refused erasure. Native Docker/database/concurrency/browser/container/restore checks remain mandatory via npm run verify:release. Mark those boxes after the native gate passes.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Currency dropdowns remain labeled; three-decimal currencies/FX are not enabled. Whole-yen totals use the recorded snapshot; fractional per-kg quotes remain possible. Native responsive verification remains pending. CocoaTrace coordinates payments without holding money.

## Follow-up work

- CUR-001: commercial pilot currency/provider coverage approval.
- CUR-002: refund workflows and any remaining legacy export presentation.
- CUR-003: close zero/two-decimal acceptance criteria after native release/CI passes; three-decimal currencies require a separate approved extension.
- CUR-004–CUR-005: display preferences and actual FX design.
- LNG-001–LNG-005: language foundation and translated journeys.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
