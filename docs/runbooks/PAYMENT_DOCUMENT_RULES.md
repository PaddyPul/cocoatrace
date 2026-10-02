# Payment and document rules

CocoaTrace records commercial conditions, external payment references, seller checks, dispatch events and access to uploaded files. It does not receive customer funds, provide escrow, authenticate a bank instrument or control legal title/original documents held outside the platform. Sellers must verify cash receipts and bank security with their receiving bank/provider outside the app. A proof attachment alone never marks funds received.

| Agreed plan | Physical pickup/handover/dispatch condition | Installment becomes payable | Buyer access to seller-controlled uploaded transport documents |
| --- | --- | --- | --- |
| Full payment before dispatch | Seller confirms the full payment | Buyer confirms terms | After seller confirms full receipt |
| Deposit and balance | Seller confirms the deposit | Deposit on terms confirmation; balance on document presentation | After seller confirms both installments |
| Bank security | Seller accepts the externally checked bank instrument | Complete trade document set is presented | After seller accepts the instrument; acceptance is distinct from cash settlement |
| Documents against payment | Buyer confirms the agreed commercial plan; shipment may precede cash | Complete trade document set is presented | After seller confirms full receipt |
| Credit after delivery | Buyer confirms the agreed credit plan; shipment may precede cash | Delivery activates the installment with its agreed credit-date | After buyer confirms the credit terms |

An explicitly recorded seller exceptional dispatch remains available when accepting payment risk. Recall safety holds cannot be overridden. Incoming arrival/customs/delivery records remain available after dispatch for containment and recovery. This software gate cannot prevent physical transport outside the app.

## Proof and documents

The seller may require payment proof for **each installment** while proposing terms. The buyer sees and confirms that requirement. Existing agreements default to optional proof; agreed terms cannot be silently changed. Required proof is a PDF/JPEG/PNG uploaded by the buyer to this contract using the private validation/scanning pipeline. The server requires validated, scan-clean, non-rejected evidence with stored bytes. A proof cannot be reused for another installment. Receipt verification rechecks its safety and availability.

Document presentation requires the seller's validated, scan-clean, non-rejected, stored commercial invoice, packing list and transport document; CIF/CIP also require insurance evidence. Presentation needs a transport document reference and physical handover/loading recorded. Presentation makes documents-triggered installments payable; it does not itself release controlled files. Bank-security plans also require seller acceptance of the security. Invoice/packing-list copies can be shared before payment; protected transport documents, bills of lading and warehouse releases follow the table above. The release check also applies to shipment-linked files.

## Mutation and retry guarantees

Payment submission, receipt confirmation/rejection, security submission/acceptance and document presentation lock the contract then its payment request. Mutation and audit commit together or roll back together. Receipt confirmation sums PostgreSQL NUMERIC values, transfers custody only after delivery and full verified settlement, and preserves exactly-once custody/fee effects.

Identical retries return the recorded state. Conflicting references/security overwrites return a conflict. Rejection and resubmission preserve prior references/proof IDs in distinct audit events. Each installment needs a distinct transaction reference. The compatibility payment-request endpoint also reuses matching references across confirmation retries. This is state-based idempotency for these endpoints; it does not introduce a general HTTP idempotency-key service.

## Automated coverage

`npm run verify:release` includes all migration, API integration and browser checks. `paymentWorkflow.integration.test.ts` exercises all five plans, dispatch gates, role/tenant boundaries, protected downloads, proof validation, legacy retries, duplicate events and injected audit rollback. Its simultaneous mutation case requires native PostgreSQL and runs in the normal Docker/CI suite. Authoring WASM PostgreSQL cannot prove concurrent sessions.

`paymentPlans.spec.ts` adds four real UI journeys to the existing full-prepayment journey. Fixtures create real accounts, inventory and deals. Payment actions, proof uploads, documents, security acceptance and transport progress use actual UI/API, with no mocked routes or database mutation shortcuts for the workflow. Assertions check exact custody, quantities, settlement and fee counts. No new long manual test is required for this wave.

Still separate backlog work: overdue reminders, disputes/reversals, fee tax/invoice collection and regulated-provider verification. This release does not assert those capabilities are complete.
