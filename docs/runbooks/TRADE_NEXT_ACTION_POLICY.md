# Shared permitted trade actions

`GET /trade-actions` and the `nextAction` member of `GET /contracts/:id` consume `loadTradeActions` and `buildTradeActions`. For the same user and unchanged records, the first dashboard action for a contract is the contract's action. Guidance reads do not authorize a mutation: the existing endpoint must recheck party, permission, payment conditions, recall holds and concurrency in its transaction.

## Ownership

- `services/tradeActionRepository.ts`: parameterized, organization-scoped read projection; only query resource families the caller can read. A selected contract skips the offers query.
- `services/tradeNextAction.ts`: orchestration and explicit dependency priority; no database or UI concerns.
- `modules/tradeActions/commercial.ts`: terms, security, submitted and due payment dependencies.
- `modules/tradeActions/fulfillment.ts`: document-triggered payments, delivery acceptance, dispatch protection and Incoterm transport handoffs.
- `modules/tradeActions/closeout.ts`: cancellation, discrepancy, completion and separate fee collection.
- `modules/tradeActions/permissions.ts`: account capability, readable destination and selected-installment projection. Permission defaults deny access.
- `components/trading/DealNextAction.tsx`: rendering and existing mutation controls keyed by the server's operation; no independent state-machine decisions.

## Dependency order

Cancelled trades are closed; cancellation review precedes normal work. Settled trades retain a separate fee action for the recorded payer. Unresolved delivery discrepancies precede further completion. Draft terms belong to the supplier; only proposed terms can ask the buyer to confirm. Unknown/incomplete payment protection is a review state. Payment issues and recall holds prevent normal progression. Bank security, submitted references and due installments each identify their responsible party.

After origin handover, document-triggered installments ask the supplier to prepare/present documents, then ask the buyer to pay and the supplier to verify. Due payments are surfaced before the delivery-acceptance recommendation; the existing delivery panel still permits inspection/reporting independently of payment. Completion requires both acceptance and verified settlement. Dispatch protection uses exact minor units through the existing `dispatchDecision`; a buyer reference alone does not clear it. Exceptional dispatch remains an explicit existing audited workflow, never a default recommendation.

Transport responsibility comes from the existing Incoterm policy. For example, FOB booking is buyer-owned, cargo preparation/loading is supplier-owned, onward departure is buyer-owned and reported destination receipt is buyer-owned. DDP import clearance and DPU unloading remain supplier-owned. The milestone names do not redefine legal Incoterm delivery or bank settlement.

## Response contract

Actions retain id, kind, priority, requiresAction, title, description, actionLabel, actionPath and optional contract/offer IDs. The additive `operation` selects a renderer (`view`, `configure_terms`, `confirm_terms`, `submit_payment`, `verify_payment`, `bank_security`, `documents`, `transport`). `installmentId` identifies the selected payment control. Read-only actors receive a waiting action and cannot receive a mutation operation. The contract adds `dispatchGate` for its presentation badge, using the existing payment protection decision and surfaced safety/incomplete-state holds.

No response includes credentials, reset links or unrelated-tenant facts. Internal paths are constructed from known entity IDs. If facts cannot load, fail the request; never substitute a successful empty action list. Dashboard failure is explicit. The room refreshes on focus and after mutations. Guidance is a read snapshot; stale actions can be rejected safely by the real endpoint.

## Acceptance

Run `npm run verify:release` on the candidate commit. Unit tests cover five payment plans, all 11 Incoterms, exact money, holds, read-only/foreign accounts and scoped repository calls. Native API cases compare workspace/contract responses through payment and FOB handoff. `e2e/tradeActions.spec.ts` compares actual rendered cards through supplier proposal, buyer confirmation, buyer reference and seller verification. Existing full payment, delivery, cancellation and recall journeys remain the end-to-end completion gates.

Remaining whole-platform empty-state coverage and hosted operational/performance acceptance stay open. This feature does not launch provider discovery, automatic carrier integration or regulated payment custody.
