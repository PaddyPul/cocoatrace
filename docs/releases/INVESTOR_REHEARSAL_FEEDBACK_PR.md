## Outcome

The yam sourcing rehearsal no longer silently labels new plots/harvests as cocoa. Buyers see the exact quantity shortfall before offering, finance operators can find pending fee receipts on Home and search dated statements, and buyers can reach delivery inspection ahead of secondary fee details. This candidate also includes the previously unapplied insurance and transport-timeline correction.

## Tracking

- Backlog ID(s): INV-003; PAY-007 and LOG-004 regression coverage
- Issue/ADR: Founder screenshots 686–692 and narrated rehearsal, 2026-10-23
- Target phase/environment: Phase 0 local investor rehearsal, localhost:14000

## Change summary

- Release correction: document presentation remains permitted after handover/loading with complete validated documents and a transport reference; dispatch presentation still waits for departure. Add direct handover/loading browser regressions. Existing fee-journey tests explicitly expand completed receipt details; the plot draft fixture supplies its required crop. A separate ERR_NETWORK_CHANGED navigation failure in the founder run remains an environment symptom, not a passing test.
- Blank plot crop entry, cooperative-ID labels, farm-plot crop suggestions for batches and required explicit crop API inputs.
- Yam and additional staple-crop extraction; precise missing-field errors for reviewed sourcing requirements.
- Requested/available/shortfall context in matches and offer entry, with partial-order acknowledgement.
- Scoped searchable fee pages with UTC timestamps, date/status/pending-review filters and cursor pagination; separate polling finance Home queue.
- Delivery acceptance before collapsed secondary fee details, with a direct next-action link.
- Insurance option/guidance and trade arrival/delivery presentation from the prior unapplied candidate.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing authenticated permissions and payer/platform-finance visibility remain. Fee filters are bounded, validated and parameterized before paging; cursors are scoped to visibility and filters. Farm crop summaries use the existing farm guard. Bank references are absent from the register projection. Read failures remain explicit. File scanning, document release, inventory reservation, fee verification, audit and passkey controls are retained. Partial-order acknowledgement explains quantity coverage; it is not inventory allocation or a new server authorization rule.

## Database and deployment

- Migration required: no
- Backfill/lock implications: read-only crop summary and fee register; no retagging or resetting existing records
- Rollback or compensation: revert this candidate; retained historical values are unchanged
- Configuration/secrets changed: none
- API compatibility: new plot/batch writes must supply nonempty crops/crop; legacy fee list shape retained, new paged mode documented

## Defect regression

- Defect severity: P1 (silent crop default); P2 presentation/discoverability corrections
- Confirmed P0 register ID (if applicable): not applicable; INV-003 priority does not classify these as confirmed P0 defects
- Regression test and failure behavior: API validation/parser/crop-summary/fee-register unit tests; native platformFees and sourceDetailCollections regressions; investorRehearsalFeedback browser scenarios and existing read-recovery/timeline checks. Unknown context/read failures do not report successful completion or empty queues.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 1,651 API unit tests and 23 Chromium scenarios pass. Browser scenarios use production web output and mocked APIs. Browser typecheck passes. Full Windows Docker release, GitHub checks and founder acceptance remain required. No native database, physical passkey or staging execution claimed here.
- Correction evidence: 18 focused production-web Chromium checks pass, including direct handover/loading presentation and plot-draft failure/discard regressions; web build, browser typecheck and quality checks pass. Actual bank/deposit/documentary and completed-fee journeys still require the corrected full Windows release. The founder's first release failed and was not pushed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Labelled search/filter/crop controls, explicit UTC timestamps, responsive existing grids and direct inspection link. Dedicated device/mobile acceptance remains a founder follow-up. No inbox-delivery, certification or full-request fulfilment claim is inferred from upload, crop selection or partial offers.

## Follow-up work

- INV-003: founder repeats the corrected yam trade, checks all seven observations and safety/fallback paths, and records final investor acceptance.
- BRD-005: verified domain/provider and actual inbox rendering remain open; hosting remains on hold.
- INV-003: inspect any historical harvests created under the previous cocoa default; this candidate does not silently rewrite evidence history.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
