# PR title

Add bilateral cancellation for unstarted trades with protected stock release

# PR description

## Outcome

Buyers and suppliers can agree to cancel an unstarted trade from its deal room. The other organization reviews the request; approval releases the exact reserved stock once and closes unused payment obligations. Trades with payment, security, booking or transport activity are blocked from this shortcut.

## Tracking

- Backlog ID(s): LOG-006, TRD-017, QLT-007
- Issue/ADR: No separate issue linked; runbooks/PRE_DISPATCH_CANCELLATION.md defines this bounded workflow.
- Target phase/environment: Phase 2 customer MVP; native release gates and CI before controlled pilot.

## Change summary

- Add scoped request, cross-organization approval and rejection with immutable review history.
- Recheck payment/security/transport, inventory, issue, fee and recall state inside a transaction.
- Release the exact committed holding without relisting or changing quantity; void only estimated fees.
- Cancel unused installments, protect closed payment/transport writes and commit critical audit atomically.
- Add dashboard review/waiting/archive states and cancellation controls in the deal room and contract detail.
- Extend strict typing scope and add 23 unit cases, dashboard regression, eleven PostgreSQL API cases and a real browser journey.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Contract scope and commercial write permissions are enforced server-side. Requester organization cannot self-approve. UUID/reason validation is retained at the boundary. Critical audit and state mutations commit together. Pending requests do not freeze progress; approval rechecks current activity. No outbound cancellation email or new upload behavior is included. Native races remain pending verification.

## Database and deployment

- Migration required: Yes, additive 028_pre_dispatch_cancellation.ts; manifest registered.
- Backfill/lock implications: No backfill. One pending request per contract. Recall boundary, contract and dependent payment/shipment/holding locks protect approval.
- Rollback or compensation: Keep history and use a forward correction after any request exists. Down refuses deletion of existing history. Do not restore an application lacking cancelled-state guards after releasing stock.
- Configuration/secrets changed: None.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 235 API unit tests, ten quality/script policy checks, API/web/browser types, API/web builds, migration integrity and diff checks pass locally. Supplemental WASM PostgreSQL migration/state checks pass, with advisory locks bypassed; this is not native concurrency proof. Native verify:release, eleven new API cases, real cancellation browser journey, image scans, recovery and CI still need to pass. Update the relevant boxes only after their actual runs pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Labels, loading/errors, permission visibility and cancelled archive state are implemented. Existing log redaction is retained. Native browser/accessibility verification remains pending. No refunds, escrow, automatic relisting or funds transfer is implied.

## Follow-up work

- LOG-006: Paid cancellation, partial settlement, refunds and returned inventory disposition.
- TRD-017: Administrator resolution, broader disputes and cancellation notifications.
- PAY-011–PAY-013 / LEG-010: Fee payer, invoice/collection, tax and credit/refund policies.
- QLT-007: Adopt strict typing in remaining high-risk modules.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

This bounded slice does not close wider cancellation, refund or return scope.
