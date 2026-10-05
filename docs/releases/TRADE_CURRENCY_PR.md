# PR title

Preserve trade currency and calculate contract payments exactly

## Outcome

A supplier can publish EUR, USD, GHS or GBP supply. Buyer offers use that listing currency instead of silently submitting EUR. Mismatched quotes are rejected before stock is committed; payment/contract currency drift blocks terms, payment mutations, dispatch progress and settlement. Payable trade totals and deposit balances use exact decimal arithmetic, with half-up rounding and cent conservation.

## Tracking

- Backlog ID(s): CUR-001, CUR-002, CUR-003 (partial)
- Issue/ADR: docs/runbooks/TRADE_CURRENCY.md
- Target phase/environment: Phase 2 foundation; local disposable tests, then controlled pilot

## Change summary

- Explicit four-currency write policy, selectors and currency-labeled marketplace/offer/deal displays.
- BigInt quantity/price multiplication, cent rounding/range validation and exact deposit remainder allocation across five payment plans.
- Listing/offer currency checks at creation and acceptance; contract/payment drift checks in operational mutations.
- PostgreSQL regressions for currency propagation, legacy mismatch and rollback; actual GHS buyer UI submission and fee verification browser coverage.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing authorization, locks and transactional audit remain. Currency validation runs inside the inventory transaction before commitment. No FX/provider call, additional personal data or file path is introduced. Historical financial data is not rewritten. Unsupported pending legacy quotes need replacement offers; completed records remain readable.

## Database and deployment

- Migration required: No
- Backfill/lock implications: No backfill; existing row-lock order retained.
- Rollback or compensation: Code rollback does not require a data migration. Keep recorded currencies/amounts; never relabel history to fix mismatches.
- Configuration/secrets changed: None; initial supported write policy is EUR/USD/GHS/GBP.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 284 API unit tests, code-quality checks, API/web/browser type checks, production builds and migration integrity passed locally. Supplemental PGlite SQL checks passed for GHS fulfillment, actual settlement, fees and reconciliation; this is not native PostgreSQL/API/concurrency verification. Nine new database cases and the GHS UI journey are authored; Docker is unavailable to the author. Run npm run verify:release before merging and check these boxes only after native results pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Currency selectors have labels; all new currency choices are explicit. Responsive browser/staging verification remains pending. The app coordinates recorded payments and does not perform actual FX or hold funds.

## Follow-up work

- CUR-001: commercial approval of supported pilot currencies/provider coverage.
- CUR-002: refunds and remaining financial exports under the currency policy.
- CUR-003: zero/three-decimal currencies and currency-specific policy snapshots; presentation-only numeric estimates remain separate from payable calculations.
- CUR-004–CUR-005: indicative FX preferences and provider-backed settlement design.
- LNG-001–LNG-005: language foundation and translated journeys.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
