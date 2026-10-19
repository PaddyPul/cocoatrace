# Defensibility narrative and evidence boundaries

Reviewed 2026-10-19 · INV-014 · Owner: founder/product lead

BetterTrade's proposed advantage is continuity of a buyer/seller trade record: source and quantity context, reviewed evidence, payment and delivery decisions, and traceability/recall response share authorized records instead of unrelated messages. Implementation supports this narrative; it does not establish a moat, market leadership, exclusive data rights, customer lock-in or independent verification of physical events. No customer adoption or network effect is asserted.

## Where cumulative value could arise

| Implemented foundation | Potential cumulative advantage to validate | Evidence and limits |
| --- | --- | --- |
| Transactional quantity reservation and trade acceptance | Repeated use could reduce reconciliation of available stock and committed quantities | [Trading integrity tests](../../api/test/integration/tradingIntegrity.integration.test.ts), [offer service](../../api/src/modules/trading/offers.ts). Recorded quantities still rely on parties and physical measurement. |
| Versioned commercial acknowledgements, payment plans and delivery acceptance | A consistent decision history could reduce re-entry and ambiguity about who accepted what | [Agreement repository](../../api/src/modules/agreements/repository.ts), [payment workflow tests](../../api/test/integration/paymentWorkflow.integration.test.ts), [delivery workflow](../../api/src/modules/delivery/workflow.ts). These are not legal signatures, escrow or bank authentication. |
| Private evidence, scan state and explicit review provenance | Authorized organizations could build a reusable understanding of which record supported which decision and its current state | [Evidence upload](../../api/src/services/evidenceUploadService.ts), [trust assessment](../../api/src/modules/trust/assessment.ts). Scan success is not claim truth; a declaration is not independent certification. Revoked, unavailable or stale evidence must remain uncertain. |
| Quantity-aware genealogy, recall holds and response accounting | Connected records could make affected-party and retained-stock investigation more useful as real authorized history grows | [Recall safety](../../api/src/modules/recall/safety.ts), [provenance export](../../api/src/modules/catalog/provenanceExport.ts), [recall tests](../../api/test/integration/recallSafety.integration.test.ts). Bounds can make a report unavailable; missing edges are not proof of safety. Physical recall effectiveness still needs live exercises and partner cooperation. |
| Audited decisions, tenant controls and durable operational recovery | Domain-specific failure handling could make the workflow more dependable than disconnected spreadsheets | [Transactions](../../api/src/services/databaseTransaction.ts), [audit writer](../../api/src/services/auditWriter.ts), [operations worker](../../api/src/modules/operations/worker.ts). Local release acceptance does not prove hosted reliability, independent security certification or complete control coverage. |

The compounding hypothesis is about authorized context and earned workflow reliability, not possession of raw uploads. A larger unreviewed dataset can add risk rather than value. There is no claim that all organizations may inspect one another's records or that private histories can be pooled for commercial analytics or model training.

## What is reproducible and what must be earned

Competitors can reproduce forms, dashboards, AI suggestions and common infrastructure. PostgreSQL, private storage, scanning and email are not proprietary advantages in themselves. The harder hypothesis is whether carefully maintained business rules, regression evidence, integrations with actual operating practice and longitudinal authorized context reduce the cost of a safe repeat trade. That is testable and remains unproven commercially.

No patents, exclusive corridor relationships, proprietary supplier certification network or guaranteed data exclusivity are asserted. Provider discovery/fulfillment marketplace, broad interoperability and verified third-party logistics remain roadmap. Dependence on manual verification, off-platform payment and complete participant records limits both scale and assurance. Customers should be retained by useful service, not obstructed export, invented safety claims or withheld access to essential history.

## Validation that would strengthen or falsify the narrative

For a permissioned pilot, compare first versus repeat trade re-entry time, evidence re-request frequency, unresolved discrepancies, time to identify affected records and recipient response completeness. Establish a baseline before use and distinguish product-assisted time from external waiting time. Track missing source links, inaccurate party entries, support effort and failed/incomplete reports alongside successes; do not infer causal improvement from a demo or synthetic test.

Interview both trade parties about whether retained history changes their choice to return, and whether equivalent exports or their existing process meet the same need. If repeat work is not reduced, evidence is not kept current, or parties bypass the workflow, the compounding-value hypothesis weakens. A small pilot does not prove network effects or generalize to every commodity/corridor.

Use only access-controlled, permissioned aggregate evidence in external presentations. Data ownership, purpose, retention/deletion, portability, confidentiality and any secondary analytics rights require approved policy and legal review; this document grants none. Safety records may need retention under applicable policy, which is not permission for unrestricted commercial reuse.

## Maintenance rule

At every investor/demo revision, and at least monthly during a pilot, the founder/product lead reviews this narrative against the [current capability matrix](CAPABILITY_MATRIX.md), [architecture/security boundaries](ARCHITECTURE_SECURITY_OVERVIEW.md), [pilot gates](../pilot-gates.json), [risk register](../RISK_REGISTER.md) and [delivery backlog](../DELIVERY_BACKLOG.md). Update the review date, source references, changed claims and known gaps. Retain dated permissioned pilot observations separately from repository test evidence. Downgrade claims when capability, permissions or operational evidence changes.

INV-014 covers maintaining this evidence-linked narrative. Measured differentiation, repeat paying use, hosted security/reliability acceptance, approved data rights and investor diligence remain outstanding; implementation completion percentage is not a measure of defensibility or investment readiness.
