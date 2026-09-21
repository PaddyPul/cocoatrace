# CocoaTrace pilot operating model

## The product decision

CocoaTrace is a product identity and safety network for trusted food trade. It begins with the Ghana-to-EU cocoa corridor. It is not a marketplace, generic farm ERP, blockchain product, or replacement for a national traceability system.

The paying wedge is the exporter or cooperative compliance and operations team. Their job is to assemble a buyer-accepted, traceable product lot without chasing evidence through spreadsheets and messaging apps.

| Participant | Job in CocoaTrace | First successful outcome |
| --- | --- | --- |
| Exporter/cooperative operator | Own the product record and release decision | Prepare one buyer-ready export lot |
| Farmer/field operator | Contribute origin facts | Capture a farm, plot and harvest batch |
| Certifier/auditor | Verify a bounded claim | Attest a batch against source evidence |
| Logistics partner | Add custody milestones | Connect shipment events to the lot |
| Buyer/importer | Review assurance before acceptance | Inspect a product passport and its evidence |
| Regulator | Investigate exceptions | Trace backward and forward with quantities |
| Public scanner | Understand the product | Scan the QR and see provenance and safety state |

The primary metric is **buyer-accepted traceable product volume**. QR scans are useful engagement telemetry, not the business outcome.

## Product planes

1. **Identity** — stable product passport, lot code and QR destination.
2. **Network** — farms, organizations, custody and transformation relationships.
3. **Assurance** — evidence, attestations, completeness and buyer review.
4. **Response** — quantity-aware trace-back, trace-forward and public safety notices.

Commodity-specific fields belong in configurable schemas. Identity, event, evidence and recall primitives stay shared, allowing expansion after the cocoa workflow is repeatable.

## Four-week design-partner pilot

Recruit 3 exporters/cooperatives, 2 buyers, 1 certifier and 1 logistics partner. Use named accounts created through **Pilot team**; do not share demo credentials.

Each exporter runs one real but non-public lot through five tasks:

1. Create or confirm the farm and plot.
2. Create the harvest batch and attach source evidence.
3. Obtain an attestation and create the product passport.
4. Give the buyer the passport for an independent review.
5. Run a tabletop recall from a suspect quantity and confirm every downstream recipient.

Participants use the explicit **Pilot feedback** control after each task. The platform stores a 1–5 clarity score and a written note. It does not record hidden clickstreams, fingerprints or public QR visitor identities.

### Pilot exit criteria

| Signal | Target |
| --- | --- |
| Export lot prepared without product-team intervention | 80% of pilot lots |
| Buyer finds required evidence in under 3 minutes | 80% of buyer reviews |
| Trace-back identifies all contributing source lots | 100% of tabletop tests |
| Trace-forward quantity reconciles and lists all recipients | 100% of tabletop tests |
| Median task clarity rating | at least 4/5 |
| Critical authorization or data-isolation defects | zero |

Do not add another commodity until two exporters complete the workflow twice and at least one buyer accepts the output as usable in its assurance process.

## AI boundary

The readiness assistant operates on named database counts and deterministic recommendations. An optional language model may rewrite the summary, but it receives only the aggregate facts shown in the interface. It may not invent source data, certify a claim, declare legal compliance or silently change operational records. Every recommendation exposes the fields it used.

Future high-value AI candidates are evidence extraction with human confirmation, anomaly detection across quantities and dates, and natural-language investigation over authorized trace graphs. None should become an autonomous compliance decision.
