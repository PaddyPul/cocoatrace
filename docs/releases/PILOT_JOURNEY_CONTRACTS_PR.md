# PR title

test: complete supplier publishing and recovery journeys with adapter contracts

# PR body

## Outcome

Pilot verification now covers complete conventional/source-organic supplier publishing, damaged-delivery recovery with deferred payment, and recall accounting rejection/correction. A maintained adapter inventory and additional SMTP wire contracts make the current external-port expectations explicit.

## Tracking

- Backlog ID(s): QLT-010, QLT-012, QLT-014 closure targets; accepted RCL-008/RCL-013/INV-010 reconciled.
- Issue/ADR: docs/testing/PILOT_JOURNEY_CONTRACTS.md; docs/testing/ADAPTER_CONTRACTS.md.
- Target phase/environment: Phase2 disposable pilot journey/adapter verification; full runtime release remains required.

## Change summary

- Add two real supplier journeys from physical records and PDF proof to persisted conventional/organic listings, with no invented conventional provenance or unattributed review.
- Add full-quantity damaged delivery, supplier proposal, buyer approval/inspection and deferred-payment verification; custody remains committed until settlement creates exactly one transfer/fee.
- Extend real recall response journey with UI overflow denial/draft preservation, server bypass rejection without mutation and successful corrected accounting.
- Check all six current concrete storage/scanner/email implementations and their maintained evidence pointers. Add SMTP timeout, required-TLS refusal, malformed-response, recipient-rejection/redaction and no-delivery readiness contracts.
- Keep prospective provider admission explicit: no logistics adapter or provider certification exists or is claimed.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No production code/permission changes. Browser identities and decision paths are real. Organic assurance setup is guarded to the dedicated local disposable database and does not grant seller review powers. Current native authorization/atomicity gates remain required. Relay tests bind loopback only; provider error details and private content are not exposed. No external inbox delivery is inferred.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None. Setup fixtures use existing schema in the disposable stack only.
- Rollback or compensation: Revert tests/documentation if required; no production data compensation.
- Configuration/secrets changed: None; dependencies unchanged. Tests auto-discover through existing API/browser gates.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1408 API unit tests, workspace API/web/browser types, quality, API/web builds,222-route register, pilot evidence/backlog/risk/branding and existing migration-integrity checks passed. New adapter suite8 tests; no native/browser runtime pass is claimed. Full exact-commit Docker/native/browser/evidence-stress release and required CI remain pending. Update with passing SHA/date and check native/browser boxes after execution.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No rendered product change. Certifier issuance/accreditation is setup-only, current harvest UI links farm rather than selected plot, and external replacement is a recorded explanation. New tests do not claim a return/refund/partial-settlement workflow, hosted capacity, inbox delivery, future provider functionality or an accessibility audit.

## Follow-up work

- LOG-006: Partial settlement, refunds, paid cancellation and returned inventory remain explicit product scope.
- SVC-001–012: Logistics-provider product and integration acceptance remain open; future concrete ports require inventory and protocol/sandbox contracts.
- QLT-002/SEC-018: Full per-action/resource/field matrix and independent review.
- UX-008/PER-005: Keyboard/mobile accessibility and representative performance acceptance.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted145/343 (42.3%); three targets yield148/343 (43.1%) after full release/review/merge. Core11/28 and provider-inclusive11/40 unchanged. This is backlog completion, not a valuation or launch-readiness score.
