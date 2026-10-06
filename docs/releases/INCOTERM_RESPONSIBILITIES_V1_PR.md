# PR title

Enforce buyer/seller transport responsibilities for all 11 Incoterms

# PR description

## Outcome

A buyer viewing an FOB shipment can arrange main carriage but cannot confirm the seller's cargo readiness or onboard loading. All 11 supported Incoterms now restrict milestones by the organization's role in the specific contract. Dashboard handoffs and transport forms reflect those permissions, and skipped statuses no longer imply recorded confirmations.

## Tracking

- Backlog ID(s): LOG-001; related LOG-002/003/004/008, PRD-006/011, SEC-007.
- Issue/ADR: docs/runbooks/TRANSPORT_RESPONSIBILITIES.md.
- Target phase/environment: invited-pilot security foundation; disposable automated release before customer access.

## Change summary

- Introduce a strict transport responsibility policy separate from controller/payment logic; use it for shipment creation, server mutation authorization, API permission output and dashboard handoffs.
- Cover EXW buyer collection/loading, FAS buyer onboard loading, DPU seller unloading and DDP seller import clearance; keep buyer receipt/inspection separate from seller confirmations.
- Check persisted authorized origin events before onward progress, plus DPU unloading/DDP clearance before receipt. Keep existing payment, recall and issue gates.
- Attribute provider reports to the coordinating party; record Incoterm and actor role in the atomic milestone audit.
- Add all-term unit/API regression matrices and adapt real trade browser journeys to the correct FOB actor. Retain wildcard/unrelated-tenant denial checks and unchanged-state assertions.
- Record founder confirmation that access suspension/restoration was tested and merged; do not close privileged recovery/deactivation work.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Contract organization IDs, not importer/exporter labels, determine authority. Wildcard role does not bypass party policy. Wrong-role requests roll back before mutation; exceptional dispatch cannot bypass authorization. Existing transaction locks and forward-only retry behavior remain. No additional external calls, credentials or email dispatch. Unsupported Incoterms fail closed.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: no historical rewriting. Read authorized milestone events under existing shipment/contract/payment mutation locks. Legacy shipments missing correctly attributed origin events may require reviewed manual remediation; do not invent history or reset stock.
- Rollback or compensation: deploy API/UI together. Reverting to the old API reopens milestone authority; restrict write access before such rollback. Retain all audit events.
- Configuration/secrets changed: none.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author API unit suite 342 tests, targeted transport/dashboard suite 26 tests, quality policy/script checks and type/build checks. Twelve new real PostgreSQL cases cover the all-term authorization matrix and origin/DPU/DDP prerequisites; existing FOB browser journeys add selector restrictions. Author environment has no Docker/PostgreSQL; native release execution remains required. Add actual successful release commit and CI URL, and tick integration/E2E after they pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: API denies wrong party and explains missing prerequisite. UI shows responsible party and reports departure/arrival as externally sourced party updates. Existing logging retained; no claim of independently verified carrier events, ownership transfer or regulated escrow. Full translations/accessibility remain follow-ups.

## Follow-up work

LOG-002/003/004 and GEO-001: named-place/handover variants, mode/route validation, domestic customs applicability and agreed fulfillment terms. LOG-001: reviewed remediation for historical misattributed/missing confirmations. LOG-008: separate seller-risk authorization where EXW transport is buyer-controlled and scoped exception notifications. PRD-006/011: deal-room/dashboard consolidation. Provider marketplace remains separately scoped; no provider financial/acceptance delegation added. IDN-011 privileged recovery/permanent deactivation remain open.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: LOG-001 remains partial pending native release and broader mode/named-place/domestic acceptance criteria. CORE-transport evidence updated without giving partial progress full completion credit.
