# Business action review and status presentation

Candidate2026-10-19. UX-006/007 remain partial until broader inventory and integrated acceptance. UX-011 was accepted separately per founder release/merge report.

## Reviewed actions in this slice

| Action | Review consequence | Write boundary |
| --- | --- | --- |
| Invitation resend | Named address; previous link stops working | Send replacement, never opening/Cancel/Escape |
| Invitation revoke | Named address; invitation invalidated, existing membership separate | Revoke invitation |
| Certificate suspend/revoke/reinstate | Exact certificate ID and requested state; revocation limitation explicit | Confirm named action |
| Transfer acceptance | Exact transfer, parties, material and quantity; physical custody/inventory consequence | Confirm custody acceptance |
| Existing offer withdrawal | Existing business copy; native keyboard modal, Cancel focused first | Existing Withdraw button |

Shared confirmation uses native modal focus containment and background inertness. Escape cancels unless a request is processing. Processing disables repeated submission and cancellation; errors retain the review. Server authorization, freshness, recall and state checks remain authoritative. Confirmation is a review, not a reservation or successful-write receipt.

Existing dedicated review flows cover team/access decisions, listing renewal, offer rejection/withdrawal, sourcing closeout, agreement/dispatch, financial actions and delivery acceptance. Immediate offer acceptance and recall activation/recovery need further review before universal UX-006 closure. This slice does not claim a universal accessibility audit.

## Scoped status semantics

Contract/deal, goods payment, payment terms and physical shipment badges now select their own semantic domain. Trade accepted/delivered remain amber until settled; shipment delivered and payment paid describe their respective records only. Missing status is Unknown; unrecognized values retain a neutral readable label. Existing organic/evidence/holding domains keep their general mapping. Platform fee collection remains a separate state.

Status regression tests run in the existing frontend boundary release gate. Dashboard action cards and every legacy/custom badge still need a full cross-view inventory before UX-007 closes. No database state, money or workflow transition is changed by presentation.

## Validation

Author checks cover types, quality, frontend boundary tests and production build/budget. Mocked certificate/transfer/invitation/withdrawal regressions are supplied. Browser runtime and full release must run on the founder machine before acceptance; no hosted verification is implied.
