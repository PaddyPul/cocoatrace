# CocoaTrace venture-scale product blueprint

## The ambition, stated honestly

A redesign cannot make a company worth one billion dollars. A product earns that outcome by becoming critical infrastructure for a large market, growing efficiently, retaining customers, and developing a compounding advantage.

The design goal is therefore to make CocoaTrace behave like the first version of that infrastructure:

> The product identity and safety network for trusted food trade.

Cocoa is the entry corridor, not the eventual category boundary. Ghana → EU is the first proving ground, not a reason to build a generic commodity platform before product-market fit.

## The wedge

Start with exporters, cooperatives and EU buyers that must assemble trustworthy evidence across fragmented organizations.

CocoaTrace turns one export lot into four connected assets:

1. **Product passport** — the stable QR identity a buyer or consumer can open.
2. **Trace graph** — the farm, lot, transformation, custody and distribution genealogy.
3. **Assurance file** — certificates, geolocation, evidence, policy checks and audit history.
4. **Response plan** — the exact products, quantities and recipients implicated by an incident.

The paid outcome is not “record storage.” It is buyer acceptance, faster market access and lower recall exposure.

## The four product planes

| Product plane | User question | Primary surface | Compounding value |
|---|---|---|---|
| Identity | What is this product? | Products | Every published passport becomes a durable network endpoint |
| Network | Where did it come from and go? | Trace & Recall | Each event improves the shared genealogy |
| Assurance | Can I trust and trade it? | Control Tower and batch detail | Reusable evidence reduces repeated diligence |
| Response | What must we contain now? | Trace & Recall | Real incident outcomes improve workflows and trust |

Operational modules—farms, certificates, inventory, contracts, shipments and payments—support these planes. They should never dominate the first-use experience.

## New information architecture

### Primary

- **Control Tower** — readiness, risk, evidence gaps and next actions.
- **Products** — living product passports and their public safety state.
- **Trace & Recall** — trace-back, trace-forward and incident response.

### Guided

- **Investor Demo** — the three-minute Scan → Verify → Respond story.

### Supporting tools

- Origin and proof: farms, batches, certificates, evidence.
- Trade: inventory, listings, offers, contracts, shipments, payments.
- Governance: organizations and audit history.

## Experience principles

1. **Outcomes before records.** Show readiness, exceptions and risk before tables.
2. **One object, one identity.** A lot or product retains context across evidence, trade and recall.
3. **Progressive disclosure.** Plain-language result first; formulas and raw events on demand.
4. **Exceptions drive work.** The control tower highlights what blocks trade or increases risk.
5. **Public and private views connect.** Operators see the effect their actions have on the scanned product page.
6. **No invented certainty.** Declared, estimated and incomplete data are visibly distinct.
7. **Interoperability is product behavior.** Adopt GS1 identifiers and EPCIS-compatible events rather than trapping customers in a proprietary ledger.

## Standards and regulatory posture

- GS1 EPCIS 2.0 provides a common event language and capture/query interfaces for cross-company visibility: <https://www.gs1.org/standards/epcis>
- GS1 Digital Link should become the canonical QR identifier format as the product moves beyond demo slugs.
- EUDR currently enters application for large and medium operators on 30 December 2026 and for micro and small operators on 30 June 2027: <https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en>
- CocoaTrace should exchange evidence with Ghana’s national traceability infrastructure rather than attempt to replace it.

## Venture-scale moat

The moat is not QR generation. It is the verified, permissioned graph created when organizations use CocoaTrace together.

1. **Network density** — more connected suppliers and buyers reduce onboarding friction for the next participant.
2. **Accumulated evidence** — reusable farm, certificate and facility records make each new trade file cheaper to prepare.
3. **Workflow embed** — incident and buyer-acceptance processes create high switching cost when they work reliably.
4. **Interoperability trust** — standards-based exchange makes CocoaTrace easier to adopt than a closed platform.
5. **Outcome data** — over time, the platform can benchmark readiness, evidence quality and containment performance without selling unverifiable “AI risk scores.”

## Commercial model to validate

### Phase 1 — paid corridor pilots

- One exporter/cooperative, one EU buyer and one certifier.
- One shipment converted into a buyer-reviewed assurance file.
- Setup fee plus per-lot or per-dossier pricing.
- Measure hours saved, buyer acceptance time, missing-data rate and trace response time.

### Phase 2 — organization SaaS

- Workspace subscription by organization size and corridor volume.
- Usage component for active product passports or trace events.
- Paid buyer portal, dossier generation, integrations and incident workflows.

### Phase 3 — network infrastructure

- API and EPCIS exchange for enterprise participants.
- Multi-corridor and multi-commodity support after repeatable cocoa adoption.
- Optional finance/insurance integrations only when verified provenance demonstrably improves underwriting.

## North-star and operating metrics

### North-star metric

**Buyer-accepted traceable product volume** — kilograms or units attached to a complete, buyer-reviewed product identity.

### Product metrics

- Time to onboard a supplier
- Percentage of lots with complete origin and approved evidence
- Percentage of product passports published
- Buyer assurance-file acceptance rate
- Median trace-back and trace-forward response time
- Recall overreach ratio: full recall quantity ÷ suspect-equivalent quantity
- Organizations contributing verified events per active corridor
- Monthly retained active organizations

Scan count is a useful engagement signal, but it is not the north-star metric.

## Product roadmap

### Now — credible design partner product

- Control Tower, Products, Trace & Recall
- Stable public passports and live safety state
- Quantity-aware genealogy
- Guided investor and pilot demonstration
- Buyer-readable language with technical drill-down

### Next — pilot readiness

- Multi-tenant isolation and production hosting
- Spreadsheet/API imports and data-quality inbox
- Product passport management and bulk QR export
- Buyer assurance file with downloadable PDF
- Recipient contacts and notification workflow
- GS1 Digital Link identifiers and EPCIS 2.0 capture/export
- Organization invitations, approvals and scoped sharing

### Later — network scale

- Partner API and connector framework
- Facility and transformation onboarding
- Cross-corridor control tower
- Supplier performance and evidence reuse
- Recall drills, playbooks and response-time analytics
- Carefully selected adjacent commodities

## Explicit exclusions

- Blockchain-first positioning
- Replacing COCOBOD or another national system
- Marketplace-first growth
- Farmer-as-first-payer strategy
- Generic ERP scope
- Opaque AI-generated compliance verdicts
- Multi-commodity expansion before repeatable cocoa adoption

## Current implementation change

This sprint introduces the product model into the application:

- Dashboard becomes a network **Control Tower**.
- **Products** becomes a first-class registry with safety, evidence and scan state.
- **Trace & Recall** remains the response surface.
- Global command search provides permission-aware navigation.
- Operational modules remain available under **More tools**.

This is a product foundation, not a valuation claim. The next proof is a design-partner pilot that produces measurable buyer acceptance and trace-response outcomes.
