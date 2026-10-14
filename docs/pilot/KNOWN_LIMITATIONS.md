# Customer-facing pilot limitations

Version: **2026-10-14.1** · Updated: **2026-10-14**

The signed-in `/pilot/limitations` page is available through “Known pilot limitations” in every workspace sidebar. The authoritative customer copy is versioned in `web/src/content/pilotLimitations.ts`; deploy it with the application, not as a separate untracked operator note.

## Current limits

- Negotiation and counteroffers occur outside BetterTrade. Verified direct contact is required. External messages do not amend recorded offers or accepted trades. Before acceptance, the buyer can withdraw or the seller can reject unsuitable terms, and the buyer can create a new offer; accepted trade changes must use supported controls or operator escalation.
- Payment submissions and counterparty confirmations are records, not escrow, bank verification, fund custody or payment guarantees.
- Declarations, source records and reviewed evidence remain separate. Traceability/recall completeness depends on recorded data. Missing, expired or revoked evidence cannot establish compliance.
- Transport milestones are authorized party records, not independent tracking. This pilot has no registered/verified logistics-provider selection marketplace.
- Currency amounts do not execute FX. Language coverage is partial and original evidence text is not translated automatically.
- Pilot availability has no committed service level. Access controls and scanning do not guarantee safe files or true claims. Synthetic demos must not contain real commercial data and may suppress app email.

## Required release maintenance

For **every pilot release**, the author/reviewer must inspect this page against the release scope. Update the content version/date and changed limitations in the same PR, or record that this exact version remains accurate in that release’s PR description. The deployed page reports its version so participants can identify the applicable copy. Keep prior versions in Git history. Do not claim unsupported guarantees or mark planned services as available.

The browser regression covers discovery from workspace navigation, version rendering, negotiation instructions and payment/provider limits. It does not prove legal compliance, external contact verification, or operating availability.
