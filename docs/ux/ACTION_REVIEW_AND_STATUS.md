# Business action review and status presentation

First slice founder release/merge accepted2026-10-19. Next closure candidate in progress. UX-006/007 remain partial until broader inventory and integrated acceptance. UX-011 was accepted separately per founder release/merge report.

## Reviewed actions in this slice

| Action | Review consequence | Write boundary |
| --- | --- | --- |
| Invitation resend | Named address; previous link stops working | Send replacement, never opening/Cancel/Escape |
| Invitation revoke | Named address; invitation invalidated, existing membership separate | Revoke invitation |
| Certificate suspend/revoke/reinstate | Exact certificate ID and requested state; revocation limitation explicit | Confirm named action |
| Transfer acceptance | Exact transfer, parties, material and quantity; physical custody/inventory consequence | Confirm custody acceptance |
| Existing offer withdrawal | Existing business copy; native keyboard modal, Cancel focused first | Existing Withdraw button |

Shared confirmation uses native modal focus containment and background inertness. Escape cancels unless a request is processing. Processing disables repeated submission and cancellation; errors retain the review. Server authorization, freshness, recall and state checks remain authoritative. Confirmation is a review, not a reservation or successful-write receipt.

Existing dedicated review flows cover team/access decisions, listing renewal, offer rejection/withdrawal, sourcing closeout, agreement/dispatch, financial actions and delivery acceptance. The next candidate adds contextual offer acceptance and recall activation/recovery/resolution review. Permanent public QR publication and a final mutation inventory remain before universal UX-006 closure. This slice does not claim a universal accessibility audit.

## Scoped status semantics

Contract/deal, goods payment, payment terms and physical shipment badges now select their own semantic domain. Trade accepted/delivered remain amber until settled; shipment delivered and payment paid describe their respective records only. Missing status is Unknown; unrecognized values retain a neutral readable label. Existing organic/evidence/holding domains keep their general mapping. Platform fee collection remains a separate state.

Status regression tests run in the existing frontend boundary release gate. Dashboard action cards and every legacy/custom badge still need a full cross-view inventory before UX-007 closes. No database state, money or workflow transition is changed by presentation.

## Validation

Author checks cover types, quality, frontend boundary tests and production build/budget. Mocked certificate/transfer/invitation/withdrawal regressions are supplied. Browser runtime and full release must run on the founder machine before acceptance; no hosted verification is implied.

## Review closure candidate

Offer acceptance snapshots the selected offer and fee rate; confirmation submits that reviewed rate instead of reading a possibly refreshed row. Review states buyer, quantity, unit price and inventory/contract commitment. Cancel and Escape do not write; server rejection stays inside the dialog.

Recall activation snapshots its exact request; recovery snapshots selected holding, quantities and explanation; resolution snapshots explanation and evidence. Review precedes only valid requests, leaving invalid quantity feedback immediate. Cancel preserves draft. Confirmation keeps the existing API checks and does not release safety holds.

Native modal failures are now rendered inside certificate, custody and invitation reviews rather than hidden behind the dialog. Withdrawal failures use the same in-dialog presentation.

Home and deal next-action badges share one mapping from authoritative action kind and trade status. Connected goods-payment/transport cards use scoped state. Missing transport/security is Unknown. The shipment page describes recorded payment conditions neutrally and directs the actual dispatch decision to the deal room; recorded amounts alone cannot imply fee/security clearance. Specialized financial and safety displays remain separate and require final review before UX-007 closure.
