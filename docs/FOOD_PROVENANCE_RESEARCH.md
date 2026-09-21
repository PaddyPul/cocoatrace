# CocoaTrace food provenance and recall research

Research date: 21 September 2026

## Executive recommendation

CocoaTrace should become a **lot-level product identity and recall-readiness service**, not a blockchain product and not merely a consumer storytelling page.

The useful mental model is “Twitter for physical products”:

- every traceable lot has a stable handle and public profile;
- verified supply-chain events form its chronological feed;
- certificates and evidence are attached proof;
- a safety notice is a pinned, high-priority post that changes immediately without reprinting the QR code;
- internal users see operational and compliance data, while consumers see a deliberately limited public view.

The QR experience is the visible surface. The defensible product is the data model and workflow underneath it: identities, lot genealogy, event capture, evidence, recall scope and fast trace-back/trace-forward.

## What problem is being solved?

Food provenance and recall are related but different jobs.

**Provenance** answers: What is this product, where did it originate, who handled it, what happened to it and which claims have evidence?

**Recall** answers: Given a hazard or suspect lot, exactly which inputs, finished lots, shipments, customers and packages are affected—and how quickly can they be stopped or notified?

The persistent industry problems are:

1. **Disconnected records.** Farms, cooperatives, processors, exporters, carriers and retailers use different identifiers and systems.
2. **Broken lineage at transformation.** Mixing, processing, repacking and relabelling turn one linear timeline into a many-to-many graph.
3. **Identifier mismatch.** A SKU identifies a product class, while a recall usually targets a particular lot, batch, date range or serialised item.
4. **Evidence is not truth.** A hash proves a record has not changed after hashing; it does not prove the original claim was accurate. Verification, source identity and audit controls still matter.
5. **Slow, over-broad recalls.** Weak genealogy forces a company to recall more product than necessary or spend days reconciling spreadsheets.
6. **Consumer ambiguity.** Marketing claims can overwhelm the one safety fact a scanner needs: “Is this exact lot affected, and what should I do?”
7. **Privacy and commercial sensitivity.** Public transparency must not expose exact smallholder coordinates, personal information, contract prices or confidential counterparties by default.
8. **Weak incentives at origin.** Data entry must provide immediate operational value to farmers and operators; compliance benefits that accrue only to a distant buyer are rarely enough.

## Regulatory and standards findings

### GS1: use one web-enabled product identity

[GS1 Digital Link](https://www.gs1us.org/industries-and-insights/gs1-digital-link/for-brands) is the strongest target for the QR layer. GS1 describes a standards-based URI in a 2D carrier that can direct consumers and retailers to different services, including product information and recall status. CocoaTrace should eventually resolve a GTIN plus lot/batch identifier, rather than permanently inventing its own QR syntax.

[EPCIS 2.0](https://www.gs1.org/standards/epcis) is the appropriate interoperability target for events. It gives supply-chain partners a common language for visibility events—the “what, when, where, why and how” of an object or lot. The MVP does not need a full EPCIS repository, but its event model should map cleanly to EPCIS concepts.

### European Union: traceability is operational, not promotional

The [EU General Food Law requirements](https://food.ec.europa.eu/horizontal-topics/general-food-law/food-law-general-requirements_en) define traceability across production, processing and distribution. At minimum, operators must identify their immediate supplier and immediate subsequent recipient. Unsafe food must be withdrawn or recalled, and competent authorities notified.

For cocoa, the [EU Deforestation Regulation implementation guidance](https://green-forum.ec.europa.eu/nature-and-biodiversity/deforestation-regulation-implementation_en) is directly relevant. The Commission states that cocoa is covered and that non-EU suppliers may need to provide where products were grown or harvested. The current application date shown by the Commission is 30 December 2026. CocoaTrace should keep exact geolocation in the controlled compliance view but expose only an appropriate public region/community view.

### United States: borrow the FSMA 204 data discipline

The [FDA Food Traceability Rule](https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods) formalises Critical Tracking Events (harvesting, initial packing, shipping, receiving and transformation), Key Data Elements and traceability lot codes. It also requires covered records to be supplied rapidly—generally within 24 hours. FDA states that enforcement will not occur before 20 July 2028.

Cocoa is **not** on the current [Food Traceability List](https://www.fda.gov/food/food-safety-modernization-act-fsma/food-traceability-list), so CocoaTrace should not market cocoa functionality as FSMA 204 compliance. The CTE/KDE structure is still an excellent product-design baseline and makes later expansion into covered foods much easier.

## What others are doing

| Pattern | Example | Useful lesson for CocoaTrace | Gap CocoaTrace can exploit |
|---|---|---|---|
| Validated product claims and retailer distribution | [Provenance](https://www.provenance.org/) | Structure claims, connect each claim to evidence and use recognisable proof points | CocoaTrace can connect claims to actual lot events and recall state, not only a catalogue-level claim |
| Origin-to-consumer QR story | [OpenSC / WWF](https://wwf.org.au/get-involved/panda-labs/wwf-australia-and-opensc/) | A scan should make origin and journey understandable to a non-specialist | Safety and operational recall scope must be as prominent as sustainability storytelling |
| Web-enabled standard barcode | [GS1 Digital Link](https://www.gs1us.org/industries-and-insights/gs1-digital-link/for-brands) | One carrier can serve consumers, retailers and recall workflows | Start with a simple resolver, then support GTIN + lot identifiers rather than a proprietary dead-end |
| Enterprise traceability suites | OPTEL, Kezzler, Scantrust and similar vendors | Enterprise buyers expect serialisation, integrations, label management, analytics and access control | CocoaTrace can start narrower: affordable exporter/processor readiness for African commodity corridors |

The market is not missing QR generators. It is missing affordable, trustworthy onboarding and lot genealogy across fragmented suppliers.

## Audit of the original CocoaTrace MVP

### Strong foundation already present

- farms and plots, including geolocation and EUDR-oriented fields;
- organic certificates and attestation policy checks;
- harvest batches, holdings, custody transfers and splits;
- listings, contracts, shipments and milestones;
- evidence hashes and audit events;
- exporter/importer/regulator roles;
- a coherent Ghana-to-Netherlands demonstration corridor.

### Material gaps found

1. **No public product identity or stable QR destination.** The app was entirely authenticated.
2. **No recall domain.** There was no recall notice, affected-lot relation, status, instructions or consumer warning.
3. **Public profiles are still batch-bound.** Finished chocolate, powder or butter lots now have internal identities, but the public profile must move from harvest batch to any material lot.
4. **Operator capture is missing.** The model now represents transformation/commingling, but production allocations still need mobile/API capture and reconciliation workflows.
5. **No standard product identifiers.** GTIN, GLN, SSCC and GS1 Digital Link syntax are absent.
6. **Events are spread across domain tables.** That is workable internally, but an interoperable event projection/export is needed.
7. **Notifications are not automated.** Recall propagation now computes descendants and recipients, but recipient export, acknowledgement and email/SMS/webhook delivery are still missing.
8. **Public/private data policy was undefined.** Exact plot coordinates and commercial data must not leak into consumer pages.
9. **Audit writes are best-effort.** The audit service catches failures. Safety-critical state changes should use a transactional outbox or fail closed for required records.
10. **Seed evidence and certificates are historical demo data.** They must remain clearly labelled and must not be presented as live certification.

## MVP implemented in this iteration

- stable public product profiles for harvest lots;
- public, mobile-first “product social profile” at `/p/:slug`;
- chronological farm-to-fork feed assembled from harvest, attestation, custody, shipment and recall events;
- server-generated QR SVG pointing to the stable profile URL;
- prominent live safety status with pinned recall instructions;
- public proof view with origin, certificate and approved evidence hashes;
- deliberately coarse public origin (no exact GPS coordinates);
- authenticated creation and publishing of profiles from a batch;
- quantity-aware source, production and packaging lots linked by transformation allocations;
- trace-back from an output quantity to every required source lot;
- trace-forward from suspect material to every descendant, distribution and recipient;
- recall impact preview that distinguishes suspect-equivalent mass from the full commingled quantity to control;
- transactional recall activation that persists the calculated lot scope, with activate and resolve APIs;
- privacy-minimal scan counts with no IP address or device fingerprint;
- two seeded demonstrations: one clear product and one explicitly labelled demo safety hold.

This is a genuine vertical slice with packaged-lot genealogy and recall calculations. The public profile remains harvest-batch-bound, so it is not yet a complete packaged-product passport.

### Recall calculation semantics

For an edge from source lot `S` to destination lot `D`:

- `A` = recorded kg of `S` allocated to `D`;
- `Qₛ` = recorded quantity of `S`;
- `Iᴅ` = sum of all input allocations to `D`;
- `Qᴅ` = recorded output quantity of `D`.

For trace-forward, if `xₛ` kg of `S` is suspect, the suspect-equivalent output is:

`xᴅ = Qᴅ × ((A × xₛ / Qₛ) / Iᴅ)`

Contributions from independent suspect inputs are summed and capped at the destination quantity. Any non-zero contribution places the **whole destination lot** in recall scope because commingled material cannot be separated. Terminal-lot recall totals are used so intermediate and finished material are not double-counted.

For trace-back, requesting `yᴅ` kg of destination output requires this source input:

`yₛ = A × (yᴅ / Qᴅ)`

The calculation recurses to origin. Full-lot queries over declared allocations are labelled `declared`; partial-lot queries and explicitly proportional allocations are labelled `estimated`, even though the arithmetic result is deterministic. This prevents a mathematically precise estimate from being presented as physically proven identity.

## Recommended product architecture

The next data model should separate these concepts:

| Entity | Purpose |
|---|---|
| Trade item | Product class/SKU, normally identified by GTIN |
| Source lot | Farm or supplier material lot |
| Production lot | Output of a processing/transformation run |
| Logistic unit | Pallet/container/case, normally identified by SSCC |
| Trace event | Harvest, pack, ship, receive, transform, inspect or dispose event |
| Transformation edge | Quantity of an input lot consumed into an output lot |
| Product profile | Public projection for a lot or serialised item |
| Recall notice | Hazard, status, instructions and authority |
| Recall scope | Directly selected lots plus computed ancestors, descendants and recipients |

The recall engine must support both directions:

- **trace back:** finished package → production lot → every source lot/farm;
- **trace forward:** suspect source lot → every transformed lot → shipment → customer/market.

## Roadmap

### Pilot-ready MVP

1. Add `trade_items` and operator capture for the implemented material lots, transformation events and quantity-preserving edges.
2. Add GS1 identifiers and a Digital Link-compatible resolver such as `/01/{gtin}/10/{lot}` while keeping friendly profile slugs.
3. Create mobile operator workflows for receive, transform, pack and ship; support offline queueing for weak connectivity.
4. Add scenario comparison, disposition tracking and regulator-ready recall reports to the implemented impact preview.
5. Add affected-recipient export, email/SMS/webhook notifications and acknowledgement tracking.
6. Add EPCIS 2.0 JSON-LD import/export and CSV onboarding for partners that still use spreadsheets.
7. Make audit and event publication transactional; add signed organisation identities and evidence review states.
8. Add a public/private field policy, consent, data retention and tamper/QR-copy threat model.

### Commercial pilot

Use one real Ghana-to-EU shipment and one downstream finished product. Recruit one farmer/cooperative, exporter, processor/brand and importer. Run two timed exercises:

- scan a real package and verify every displayed claim;
- simulate a suspect source lot and measure the time and precision of trace-forward.

### Success measures

- percentage of physical volume represented by complete digital lineage;
- time to identify all affected finished lots and recipients;
- recall precision (affected units versus unnecessarily recalled units);
- event/evidence completeness by partner;
- percentage of scans that receive an exact lot match;
- operator time per recorded event;
- unresolved data-quality exceptions.

## Positioning and business model

Lead with **recall readiness, buyer confidence and EU export evidence**, not with blockchain and not with QR codes.

The likely first payer is an exporter, processor or brand that needs buyer-ready provenance and faster investigations. Farmers should receive a free or subsidised capture workflow because their participation creates the network data. A credible offer is:

> CocoaTrace gives every lot a live product passport and gives operators a fast, precise way to prove origin and contain recalls.

The public profile helps brands tell the story and gives consumers a safety surface. The commercial core is the controlled provenance graph, compliance export and recall workflow.

## Key product decisions

- Keep the Web2 architecture for the pilot. Add cryptographic signing or an external ledger only when a specific multi-party trust problem justifies the operational cost.
- Use lot-level QR codes for recall precision. A SKU-only QR is insufficient.
- Make “safe / affected / unknown” the first scan result; provenance storytelling comes second.
- Treat unknown lineage as a visible risk state, never as safe by default.
- Do not publish exact smallholder coordinates on the consumer page.
- Design for interoperability and data export so customers are not trapped in CocoaTrace.
