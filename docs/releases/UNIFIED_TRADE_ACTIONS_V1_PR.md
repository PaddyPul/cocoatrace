# PR title

Unify buyer and supplier next actions across dashboard and deal room

# PR description

## Outcome

Buyers and suppliers see the same permitted next step on their dashboard, deal room and contract page. The supplier proposes payment protection before the buyer is asked to confirm. Payment references require seller receipt verification; document-triggered payment, delivery consent and Incoterm handoffs remain distinct. Read-only colleagues see who must act instead of receiving unusable mutation buttons.

## Tracking

- Backlog ID(s): PRD-006; partial contribution to PRD-011. Acknowledge merged IDN-011 evidence separately.
- Issue/ADR: docs/runbooks/TRADE_NEXT_ACTION_POLICY.md; docs/pilot-gates.json (CORE-actions).
- Target phase/environment: core pre-pilot product coherence; local/CI automated acceptance, hosted staging pending.

## Change summary

- Share one party-scoped fact repository and typed policy between `/trade-actions` and contract `nextAction` responses.
- Separate commercial, fulfilment, closeout and permission policy modules; remove independent deal-room/contract decision trees.
- Include payment issues, recall holds, exact dispatch money, document-triggered installments and Incoterm responsibility in guidance.
- Share document-presentation milestone policy with its mutation, including DPU unloading.
- Select the exact payment installment and retain direct buyer submission/seller verification controls.
- Explain empty and failed action reads; label supply/sourcing setup separately from active trade actions.
- Add policy/repository tests, native API equivalence/isolation tests and a real browser transition journey; update the FOB prepayment expectation to wait for buyer booking.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Reads are organization-scoped and require the corresponding resource permission; foreign and ambiguous party facts yield no actions. Mutation endpoints retain their transactional authorization/payment/recall gates. Guidance is not authorization and can become stale; APIs revalidate every mutation. No new audit/outbox mutation or file/URL ingestion path is introduced.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; new read projection includes existing payment/recall state. No new mutation lock order.
- Rollback or compensation: deploy the previous application images; no data compensation required.
- Configuration/secrets changed: none. Deploy API and web together for the additive action response.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author quality, workspace/browser types, API units, builds and migration integrity passed. Three native API cases and one actual buyer/supplier browser journey are included in `verify:release`; Docker execution must be recorded on the candidate SHA before merge. Check these boxes only after that report passes. Hosted staging is not claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Existing structured API logging remains; failed action reads surface an alert. Labels and responsive action controls are retained. Full accessibility review remains separate; application coordination is not escrow, bank validation or legal Incoterm delivery.

## Follow-up work

- PRD-011: remaining permitted empty states across the platform.
- PRD-003 / PRD-004 / QLT-009: record-anchored evidence entry, coherent source/direct-inventory entry points and sourcing persistence journeys.
- Hosted security/operational acceptance, performance measurements and provider marketplace launch remain separate backlog gates.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Native release and merge acknowledgement close PRD-006. PRD-011 receives partial credit only.
