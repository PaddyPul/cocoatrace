# CocoaTrace investor-demo product audit

## Product decision

The investor demo must communicate one promise in under three minutes:

> Scan a product to verify its farm-to-fork history; trace a suspect lot to identify the exact finished lots and recipients that must be recalled.

The platform may continue to support the wider trade workflow, but those records are supporting infrastructure rather than the demo narrative.

## Requirements versus implementation

| Investor-demo requirement | Current capability | Gap before this sprint | Decision |
|---|---|---|---|
| A product opens from a QR without an account | Public `/p/:slug` profiles and stable QR URLs | Hidden behind the operational product story | Put live clear and warning profiles inside the guided demo |
| Provenance is understandable in seconds | Chronological farm, certificate, custody and shipment journey | Evidence was credible but spread across multiple modules | Frame it as Scan → Verify → Respond |
| Safety status updates on the same product identity | Live recall state on public profiles | The link between a recall and the consumer page required explanation | Show clear and demo-warning profiles side by side |
| Trace-back identifies source lots and quantities | Quantity-aware trace-back API | Calculator exposed too many controls before value was visible | Keep the full calculator, but lead with a guided scenario |
| Trace-forward identifies finished lots and recipients | Quantity-aware trace-forward API | Results looked like an operations table rather than an outcome | Summarize suspect input, impacted lots, finished recall and recipients |
| Commingling is handled honestly | Suspect-equivalent mass is separate from full-lot recall mass | The distinction was buried in assumptions | Explain it beside the live result |
| The demo starts without training | Seven demo roles and a dense role workspace | Investor had to choose a role and learn navigation | Add one-click investor demo login |
| Operational breadth remains available | Farms, batches, inventory, trade, logistics and governance | Fifteen primary destinations obscured the wedge | Move supporting modules into “More tools” |
| Claims are credible | Authenticated records, evidence hashes and audit history | No compact statement of what is live | Label demo as live seeded data and safe simulation |

## Implemented demo flow

1. Open `http://localhost:3000`.
2. Select **Launch investor demo**. The seeded admin demo account opens automatically.
3. State the promise shown in the hero: “One scan tells the product story. One trace contains the risk.”
4. Open **Asante Cocoa** to show a clear, public farm-to-fork profile.
5. Return to the demo and open **Mensah Cocoa** to show the same QR experience with an active, explicitly labelled demonstration warning.
6. Select **Run live calculation**. The API traces 500 kg from source lot `GH-2024-0831` through declared transformations.
7. Explain the result using four numbers: suspect input, impacted lots, finished recall quantity, and recipients.
8. If technical diligence is requested, open **Trace & recall** for the full lot-level calculation and assumptions.

## What to say

“CocoaTrace gives a physical product a live profile. The buyer or consumer scans once to see its origin, certification, journey, evidence, and current safety status. If a source lot becomes suspect, the same data graph traces forward through blending and packaging. We preserve the precise suspect-equivalent mass, while conservatively recalling the full commingled finished lots. The result is faster containment with an explainable calculation.”

## What not to demo first

- Creating farms, plots or organizations
- Marketplace negotiation and offer workflows
- Shipment milestone administration
- Payment requests
- Raw audit logs
- Manual recall activation, unless the investor asks for an operational walkthrough

These features remain available under **More tools**. They demonstrate platform depth after the core product value is understood.

## Remaining pilot requirements

The prototype is suitable for an investor demo, but a real pilot still requires:

1. A hosted, stable environment with monitoring, backups and tenant isolation.
2. A repeatable importer/exporter onboarding and data-import path.
3. GS1 Digital Link identifiers and EPCIS-compatible event exchange.
4. Recipient contact and notification workflows for active recalls.
5. Regulatory and customer-approved recall procedures, roles and audit exports.
6. A downloadable buyer/EUDR traceability dossier.
7. Pilot validation with one exporter or cooperative, one EU buyer and one certifier.

## Demo acceptance criteria

- A first-time viewer understands the product promise within 30 seconds.
- The public product profile opens without authentication.
- The guided recall calculation completes with one click and does not mutate data.
- The result distinguishes suspect-equivalent quantity from full commingled recall quantity.
- The full operational platform remains accessible without dominating primary navigation.
- Web build, API build/typecheck and API tests pass.
