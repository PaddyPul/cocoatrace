# Title
fix: explain why inspected delivery acceptance is disabled

## Outcome
A buyer who enters the full quantity and confirms inspection now sees that an inspection note is still required. The form lists every remaining prerequisite and reports when it is ready to submit. The existing full-quantity, note and buyer-confirmation safeguards remain.

## Tracking
- Backlog IDs: delivery acceptance regression; no additional completion credit.
- Issue/ADR: founder screenshot report,2026-10-17.
- Target phase/environment: local/pilot candidate.

## Change summary
- Show required inspection-note guidance and accessible live prerequisite checklist next to acceptance.
- Match note maximum to the existing 2,000-character API limit.
- Extend actual buyer/supplier delivery journey with blank/short-note and ready-state checks.
- Reconcile accepted UPL-009/UPL-011:153/343 (44.6%).

## Security and data review
- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: no server authorization, settlement, discrepancy or audit policy changes. Text is entered by the inspecting buyer; no invented inspection result.

## Database and deployment
- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert UI correction; no data rewrite
- Configuration/secrets changed: none

## Verification
- [ ] Unit tests (no new unit test; browser behavior regression added)
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author workspace/browser types, web build, quality and backlog checks; full release/browser runtime pending. Check boxes only after actual results.

## Product and operations
- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work
Existing hosted pilot acceptance and DAT-003/DAT-010 remain open; this correction adds no new backlog closure.

## Backlog update
- [ ] Item remains open and is marked IN PROGRESS
- [x] Item acceptance criteria and definition of done are met and it is checked complete (previous UPL-009/UPL-011 only, per founder acceptance)
