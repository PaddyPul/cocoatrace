# Delivery acceptance and discrepancies

A transport milestone is a report of physical progress. It is not buyer acceptance.
For new/open deals, trade settlement requires all of:

- Latest shipment is delivered.
- Buyer explicitly accepted the exact full contracted quantity and its condition.
- Every payment is seller-verified.
- No active payment issue or delivery discrepancy.
- The contract holding remains seller-owned, committed and exactly the contract quantity.

The buyer may accept before a payment due after delivery is verified. Acceptance records
inspection; custody transfers only when the payment and safety gates clear.
Delivery reporting continues to activate payment installments according to the agreed
payment plan. It does not silently change their due trigger.

Buyer discrepancies require a shortage, damage or rejection explanation, actual received
quantity, and private scan-clean, validated evidence uploaded by that buyer for the same
contract. Missing stored bytes and another organization's evidence are rejected.
The supplier proposes a resolution; only the buyer approves it. Approval does not imply
acceptance. Replacement goods must be inspected and accepted separately.

This release supports resolution to full performance of the original contract. It does
not automate partial settlement, price reductions, cancellation, refunds or return inventory.
Those financial/physical remedies happen externally and remain follow-up backlog work.
No request rewrites the contract quantity, paid ledger, holding quantity or original history.
Repeated acceptance is safe; competing requests serialize on the contract row. Audit events
commit with state changes, and a failed audit rolls back acceptance and settlement.

Historical settled contracts remain closed. They are not retroactively assigned fictitious
acceptance records. Open delivered contracts require the buyer's acceptance after upgrade.
Recall holds are checked on acceptance. Quarantined inventory cannot be released by settlement.

Automated coverage: deliveryAcceptance.integration.test.ts, all five plan journeys in
paymentWorkflow.integration.test.ts, paymentPlans.spec.ts and a real shortage/resolution/
acceptance journey in tradeJourney.spec.ts. Native PostgreSQL concurrency is a release gate.
