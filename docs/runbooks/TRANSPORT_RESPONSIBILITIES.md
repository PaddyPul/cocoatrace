# Contract-party transport authority

Policy version: Incoterm responsibilities v1. The API policy lives in `api/src/modules/transport/responsibilities.ts`; shipment reads return `permissions`, which the transport UI consumes. Dashboard action generation uses the same policy. Users need the existing shipment permissions AND membership of the responsible contract party. A wildcard administrator permission does not override contract-party checks. Organization type labels never grant a role in somebody else's contract.

## Responsibility matrix

These are application recording authorities, not a claim that Incoterms govern payment, ownership, inspection acceptance or every carrier event. Provider departure/arrival are attributed party reports, not independent confirmations.

| Term | Main carriage booking/reporting | Cargo ready | Origin loading record | Export clearance | Import clearance | Destination unloading | Destination receipt |
|---|---|---|---|---|---|---|---|
| EXW | Buyer | Seller | Buyer | Buyer | Buyer | Buyer | Buyer |
| FCA | Buyer | Seller | Seller origin loading/handover | Seller | Buyer | Buyer | Buyer |
| FAS | Buyer | Seller | Buyer aboard; seller alongside handover | Seller | Buyer | Buyer | Buyer |
| FOB | Buyer | Seller | Seller aboard | Seller | Buyer | Buyer | Buyer |
| CFR | Seller | Seller | Seller aboard | Seller | Buyer | Buyer | Buyer |
| CIF | Seller | Seller | Seller aboard | Seller | Buyer | Buyer | Buyer |
| CPT | Seller | Seller | Seller origin loading/handover | Seller | Buyer | Buyer | Buyer |
| CIP | Seller | Seller | Seller origin loading/handover | Seller | Buyer | Buyer | Buyer |
| DAP | Seller | Seller | Seller origin loading | Seller | Buyer | Buyer | Buyer |
| DPU | Seller | Seller | Seller origin loading | Seller | Buyer | Seller | Buyer |
| DDP | Seller | Seller | Seller origin loading | Seller | Seller | Buyer | Buyer |

Origin pickup/warehouse/handover/port reports: seller except EXW buyer. Under FAS the seller records alongside handover; the buyer records vessel loading. FCA location affects the physical loading obligation: the seller record is the origin operation/handover at the agreed point, not permission to claim buyer-controlled vessel loading. Exact named-place and handover variant capture remains LOG-002/003, and must be reviewed in the pilot contract. FAS/FOB/CFR/CIF are sea/inland-waterway rules; the UI flags incompatible modes, but strict mode/route commercial validation is still a separate pilot gap.

Sources: ICC Incoterms 2020 official rules, https://library.iccwbo.org/content/tfb/BOOKS/BK_0049/BK_0049_04_RulesAny.htm and https://library.iccwbo.org/content/tfb/BOOKS/BK_0049/BK_0049_05_RulesSea.htm; ICC Academy EXW/FCA and C/D explanatory articles. Application recording choices (including receipt by buyer for every term) are our policy, rather than a quotation from ICC.

## API and safety behavior

- Booking details must match both the persisted coordinator and the Incoterm-derived contract party; drift fails closed.
- Milestones require the assigned party before any mutation. Returns `403 TRANSPORT_ACTION_FORBIDDEN`. Exceptional payment-dispatch input cannot override party authority.
- Forward-only status remains; skipped timeline steps no longer receive invented checkmarks. An absent event means no recorded confirmation.
- Before onward movement/receipt, the API checks persisted seller origin events. EXW requires seller cargo-ready confirmation. FOB/CFR/CIF require seller loading; remaining terms accept origin handover/loading (or port handover). A later status string alone is insufficient.
- DPU additionally requires recorded seller unloading before buyer receipt. DDP additionally requires seller import-clearance confirmation before unloading/receipt; explain non-applicability in notes for routes without such formalities. Returns `409 TRANSPORT_PREREQUISITE`.
- Existing recall/currency/payment/issue gates are retained. Recall and payment rejection keep their existing precedence before progress prerequisites. Dispatched recalled cargo can still be reported by its assigned party for containment.
- Milestone mutation, payment activation, settlement checks and audit remain in one database transaction, under the existing shipment/contract/payment locks. Audit metadata records Incoterm, recording party and external-provider report attribution.
- `delivered` is the buyer's physical destination receipt report. Buyer inspection acceptance/discrepancy remains a separate action; seller funds verification remains separate. This change does not transfer inventory merely because a coordinator reports arrival.
- Unsupported legacy Incoterms remain readable and block writes; accepting an unsupported legacy offer returns a reviewed configuration error. New inputs accept the 11 supported uppercase terms.

## Existing data and operations

No migration/backfill or automatic event rewriting. Existing incorrectly attributed milestones are retained for historical accountability; they do not satisfy a new seller-confirmation check merely because their status is late in the sequence. A historical shipment already beyond origin with missing authorized origin events may be blocked: do not fabricate events, rewind shipment state or run bulk SQL. Review the actual documents and use a separately reviewed audited repair if necessary (LOG-001 follow-up). Already completed deals are not reopened.

Remaining boundaries: no carrier account/delegation, no override of Incoterm by a unilateral edit, no claim of legal risk transfer or bank settlement. EXW payment exceptions cannot be granted by a buyer by masquerading as seller; separate seller-risk authorization is future work. Domestic/customs applicability, typed named places, insurance responsibilities, exact physical handover variants and logistics provider service grants remain pilot/product work. Routine suspension and safe restoration were founder-tested, merged and pulled on 2026-10-06; privileged recovery/permanent deactivation remain open.
