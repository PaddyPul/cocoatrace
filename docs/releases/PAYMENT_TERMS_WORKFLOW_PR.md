# PR title

Extract transactional payment-term workflows from the contract controller

# PR description

## Outcome

Make payment-term changes easier to maintain and extend safely by moving proposal/confirmation out of HTTP handling into typed use cases. Preserve the five existing plans and response shapes, standardize contract-first lock ordering, and reject changes to cancelled or settled contracts.

## Tracking

- Backlog ID(s): ARC-006, ARC-019, QLT-007
- Issue/ADR: No separate issue or ADR linked.
- Target phase/environment: Phase 2 architecture; local release checks and GitHub CI before pilot/staging.

## Change summary

- Extract supplier proposal and buyer agreement into modules/payments/terms.ts.
- Use typed contract/payment projections and an explicit next-payment-state map.
- Reuse the shared transaction boundary for mutation and critical audit records.
- Preserve party/tenant scope, commercial defaults and retry responses.
- Prevent closed-contract payment-term mutation.
- Add 23 unit regressions and four PostgreSQL API regressions, including simultaneous confirmation.
- Document the workflow boundary and record container-wave merge confirmation.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing route validation remains. Contract queries require the appropriate buyer/seller organization. Missing and unrelated-tenant workflows retain the same 404 response. Agreement retries do not reactivate deadlines or duplicate audit. Mutation and audit rollback together; native concurrent verification remains required. Upload behavior and email delivery are unchanged.

## Database and deployment

- Migration required: No.
- Backfill/lock implications: No backfill. Locks explicitly acquire contract before payment request, matching installment and settlement operations.
- Rollback or compensation: Redeploy the prior reviewed application image; no schema/data rollback is required.
- Configuration/secrets changed: None.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results: All 211 API unit tests, ten quality-policy tests, API build, API/web/browser types and migration integrity passed locally. Four integration regressions are included. Full native verify:release, existing five-plan browser journeys and CI remain pending confirmation. Update the corresponding boxes after those runs pass. No frontend production code changes.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Existing response shapes remain. Closed-contract mutations return an actionable 409 error. Logging/redaction are unchanged. No UI layout change or new funds-transfer claim is introduced.

## Follow-up work

- ARC-006: Continue extracting remaining payment/installment state transitions.
- ARC-019: Replace other compressed controller workflows incrementally.
- QLT-007: Extend strict typing to remaining high-risk modules.
- LOG-006: Define partial settlement, refund, cancellation and returned-stock policies before enabling those remedies.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

ARC-006 and ARC-019 are partial; this PR does not complete the wider architecture work.
