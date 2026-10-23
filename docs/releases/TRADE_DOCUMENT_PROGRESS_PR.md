## Outcome

Sellers can identify the insurance certificate option required for CIF/CIP without mistaking Other for a qualifying document. The trade agreement displays recorded arrival/delivery and the current transport milestone, while keeping payment and buyer acceptance separate.

## Tracking

- Backlog ID(s): INV-003; PAY-007 regression
- Issue/ADR: Founder local rehearsal screenshots, 2026-10-23
- Target phase/environment: Phase 0 local investor rehearsal

## Change summary

- Rename Cargo insurance certificate to Insurance certificate (cargo cover for CIF/CIP), with explicit re-upload guidance for Other.
- Add labelled document/file controls.
- Show current transport milestone plus arrival and delivery steps in the trade agreement.
- Require actual departure before marking dispatch; preserve dispatch through unloading.
- Add eight browser regressions for insurance upload classification and seven shipment stages.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Presentation-only changes; existing party-scoped reads, typed uploads, clean-scan validation, document release and audit gates retained. No file-content classification or relabelling of historical evidence. Browser upload regression mocks the API; it is not a new malware-scan integration proof.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; existing Other evidence remains Other
- Rollback or compensation: revert this presentation commit; no data reset required
- Configuration/secrets changed: none

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: e2e/tradeDocumentProgress.spec.ts covers explicit CIF insurance selection, Other remaining insufficient, arrival/delivery with unsettled payment and unaccepted goods, handover/loading not implying departure, and unloading retaining dispatch.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [ ] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Focused Chromium regressions use production web output with mocked APIs; browser typecheck and web build pass. Full Windows release and GitHub CI remain required before merge. No hosted or physical-device acceptance inferred.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Added associated labels and completed/pending accessible descriptions. Responsive layout uses existing wrapping controls; no separate mobile-device acceptance claimed. A later transport milestone supports the earlier departure/arrival summary; optional customs clearance is shown as the current milestone when recorded, not independently invented.

## Follow-up work

- INV-003: founder uploads correctly typed insurance and completes the current trade, including actual fee verification, buyer acceptance and final settlement.
- BRD-005: provider/domain authentication and external inbox rendering remain open.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
