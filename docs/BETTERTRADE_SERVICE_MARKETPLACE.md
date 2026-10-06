# BetterTrade service marketplace boundary

Planning specification, 2026-10-06. Not yet implemented. Backlog GEO-002–005, SVC-001–012. Core goods trade and external/manual transport stay supported.

## Agreement and responsibility

Keep three independently versioned records: the goods agreement (quantity, unit, price/currency, claims and payment plan), fulfillment terms (route/named places, coordinator, service payer, handling, dates and agreed delivery/risk policy), and a logistics service order (accepted provider quote and assigned job). Changing any material fulfillment/price term requires the relevant parties' consent. Transport responsibility does not imply payment timing or custody/title transfer.

Incoterms can apply to domestic and international trade, allocate obligations/costs/risks, and require appropriate modes/named places; they do not define the entire sale/payment agreement. FOB/CIF must not become generic road-delivery defaults. Domestic delivery must not require customs clearance, vessel, container or bill of lading when inappropriate. See [ICC guidance](https://iccwbo.org/business-solutions/incoterms-rules/) and the [Incoterms 2020 overview](https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/). Detailed legal obligations and insurance policies require corridor-specific professional review.

## Customer flow

1. Buyer and supplier agree goods trade and fulfillment terms, including who arranges and pays for transport.
2. Coordinator chooses externally arranged transport or **Find a logistics provider**. Both paths show goods payment/recall readiness.
3. Eligible registered providers appear with capability scope, verification source/expiry, modes, route coverage and explained match. Availability is explicit; listing a provider is not a guaranteed booking.
4. Coordinator sends a minimized RFQ to selected providers. Providers submit scoped expiring quotes, or decline.
5. Authorized coordinator selects a quote; service payer/other goods party approves material costs/terms when required. Award request is pending until the provider accepts. Acceptance creates the active service order atomically.
6. Parties prepare permitted pickup. Goods payment/security/document/recall gates remain server-enforced. The provider cannot override them.
7. Assigned provider records pickup/transport progress and proof of delivery. Buyer acknowledges receipt/quality through existing delivery acceptance; provider proof alone cannot settle the goods trade.
8. Service charges and goods payments are reconciled separately. Completion, rejection, cancellation/replacement and dispute preserve all accepted versions and audit history.

Initial scope: one provider and one leg per goods agreement, manually maintained capability/availability, curated invitation-only providers and portal actions. Multi-leg tendering, live carrier tracking, rate aggregators and subcontractor chains are later capabilities. Provider APIs are adapters added only when validated, not required integrations.

## Authorization and disclosure

| Actor | Allowed | Forbidden |
| --- | --- | --- |
| Buyer/supplier goods party | Own goods agreement, permitted evidence, agreed fulfillment terms and role-appropriate actions | Unrelated trades/organizations; unilateral changes to agreed commercial terms |
| Fulfillment coordinator | Scoped RFQ, quote selection and job updates for own agreement | Award without payer consent where required; bypass payment/recall holds |
| Unselected provider | Own invitations/RFQs/quotes and minimum disclosed route/cargo facts | Goods price, bank/payment proofs, other providers' quotes, unrelated farms/evidence/contact details |
| Assigned provider | Accepted service order, necessary pickup contacts/locations, assigned transport proof and milestones | Verify goods funds, alter goods price, accept buyer delivery, settle custody, release payment-controlled originals or override recalls |
| Platform reviewer | Review provider evidence within explicit administrative permission and audit | Automatically convert organization approval into universal transport certification |

Provider grant derives from active accepted assignment, not organization membership or a generic shipment read permission. Recheck verification/expiry and current assignment on reads, downloads and writes; revoke old grants on replacement. Define limited historical retention access separately. Avoid exposing farm GPS when the job only needs warehouse pickup. Secure private proof through the existing upload/scanner infrastructure with service-order-specific policies.

## Provider verification

Store who reviewed what, legal organization/contact, operating jurisdictions, mode/cargo capability, applicable license/insurance evidence, coverage/limits, effective and expiry dates, review method and rejection/revocation reason. Display precisely what is reviewed. Valid provider identity is distinct from route/cargo eligibility and capacity. Document expiry, insurance mismatch or revoked approval must block new awards and trigger review of active jobs; do not silently cancel an in-transit job without customer/incident handling.

## Lifecycle and invariants

RFQ: draft → sent → quoted/declined/expired → closed. Quote: submitted → revised/superseded → selected/expired/rejected. Job: award pending → accepted → pickup ready → in transit → delivery reported → customer accepted → closed. Rejection, cancellation, dispute and replacement are explicit reasoned branches. Terms version, actors and time are snapshotted.

Enforce one active award per agreed leg, unique idempotent requests, contract-first lock ordering, assignment uniqueness and atomic audit/outbox. Reject stale term/quote versions and invalid state skips. Financial/custody settlement remains in its existing authoritative domain. No business commit may succeed while its required audit/outbox fails.

Service order has independent currency/tax/insurance exclusions and payment schedule. A goods installment is not a service invoice. Any platform service commission needs an approved versioned policy, payer disclosure and separate ledger; do not charge both goods and service commissions unintentionally. No automated escrow, bank transfer or refund claims until a separately reviewed regulated-provider design exists.

## Acceptance evidence

Negative tenant/job/document tests; expired/revoked capability and grant tests; two providers racing an award; repeated acceptance after timeout; reassignment revoking old access; stale quotations; provider attempting goods settlement; pickup while payment/recall blocked; conventional/domestic routes without invented farms/customs; proof reported without buyer acceptance; separate currency/fee reconciliation; and complete buyer/supplier/provider browser journeys. Exercise provider refusal/delay and operational recovery with real invited companies before enabling the provider pilot.
