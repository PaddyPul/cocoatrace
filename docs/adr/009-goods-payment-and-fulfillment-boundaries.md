# ADR 009 — Goods payment records and independent fulfillment responsibilities

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review accepted on 2026-10-15 with the pilot-integrity release. This status does not assert hosted deployment or independent security acceptance.

## Context

Recording that a buyer sent funds is not proof the seller received them; recording physical delivery is not buyer acceptance. Transport assignment must not grant payment or inventory settlement powers.

## Decision

Keep BetterTrade a recorder of externally arranged goods payments, not an escrow, bank, funds custodian or guarantee. Supplier-proposed payment terms require buyer confirmation. Buyer installment submission and seller receipt verification remain separate authorized transitions with protected evidence/release rules. Dispatch gates follow agreed payment plans and reviewed exceptions; settlement additionally respects buyer delivery acceptance. Incoterm-derived transport responsibilities are enforced by server policy and are distinct from payment timing and ownership transfer. Future logistics service orders remain a separate proposed design under ADR 002 and cannot inherit goods-payment authority.

## Alternatives and rationale

A single paid/delivered flag collapses incompatible actors and allows unilateral settlement. Automatically trusting a payment reference invites fraud. Integrating a regulated payment provider may be a future product decision but adds legal/commercial/operational obligations not authorized by the manual pilot workflow.

## Consequences, validation and change control

UI copy must distinguish submitted funds, seller-confirmed receipt, arrival, acceptance and settlement. External bank-security documents are seller-reviewed, not bank-authenticated by the platform. Fee/tax/channel commercial approval remains separate; no ADR settles those open decisions. Transition changes require atomic audit/concurrency tests and compatibility with existing agreements; never rewrite historical payment terms to fit a new default.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [api/src/modules/payments/terms.ts](../../api/src/modules/payments/terms.ts)
- [api/src/modules/payments/installments.ts](../../api/src/modules/payments/installments.ts)
- [api/src/modules/payments/documentPolicy.ts](../../api/src/modules/payments/documentPolicy.ts)
- [api/src/modules/transport/responsibilities.ts](../../api/src/modules/transport/responsibilities.ts)
- [docs/runbooks/PAYMENT_TERMS_WORKFLOW.md](../../docs/runbooks/PAYMENT_TERMS_WORKFLOW.md)
- [api/test/integration/paymentWorkflow.integration.test.ts](../../api/test/integration/paymentWorkflow.integration.test.ts)
- [api/test/integration/transportResponsibilities.integration.test.ts](../../api/test/integration/transportResponsibilities.integration.test.ts)
