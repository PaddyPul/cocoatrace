# Platform fee ledger

PAY-011–PAY-013; QLT-007. This release preserves the existing seller-paid completion fee. It tracks commercial fees and externally verified receipts; it does not debit customers or hold their money.

## Recorded policy

New accepted offers record policy seller-completion-v1, payer organization, configured PLATFORM_FEE_BPS and amount in the contract currency. Default rate remains 100 basis points (1%). Changes affect future acceptances only. New fee amounts use PostgreSQL NUMERIC rounding under the existing two-decimal schema. Offer review displays the estimate; the UI sends its quoted rate so a stale rate is rejected before inventory mutation. Older API clients may omit that optional guard; deployment consumers should adopt it before live commercial charging.

Existing amounts, currencies, statuses and references are preserved. Migration 029 resolves historical payer organizations only from recorded seller/buyer labels and marks historical policy legacy-recorded. Unresolved payers, amount/currency drift and payer mismatch block collection and appear in reconciliation; they are never silently corrected. Historical paid records lacking a verified receipt are flagged for finance review rather than relabeled.

Fees are estimates before completion. Full trade settlement makes them due and records due_at. Buyer goods payment and exact custody settlement do not wait for platform fee collection. Unstarted cancellation voids the estimate. A zero fee requires no payment.

## User and finance workflow

1. The recorded payer opens the fee statement in the deal room or Platform fees. Download produces a JSON commercial statement.
2. After completing the trade and externally paying through a separately agreed platform channel, a member with commercial permission submits the reference. The fee remains due until verified; the dashboard shows waiting.
3. A platform admin opens Platform fees and the selected statement. Verify actual receipt from the platform bank/provider record, entering the full received amount, currency and a unique bank/provider-prefixed receipt identifier. A reference alone is not receipt verification. A mismatch is blocked; investigate partial/overpayments outside this full-receipt workflow.
4. Reject with a reason if the payment cannot be verified. History remains and the payer may submit a corrected reference. Reviewed submissions cannot be revived. Identical successful retries do not repeat audit.
5. Write off only an unpaid, completed fee without a pending submission, using a documented commercial reason. The payer organization cannot verify or write off its own debt even if its member has platform permissions. Write-off does not refund goods payment or alter custody.

The finance.manage permission (or platform wildcard administrator) protects all verification, write-off and global reconciliation actions. Ordinary contract parties can read their statement; only the payer and platform finance see payer payment-reference history. Other tenants receive 404 for individual statements and never receive payer list rows. Platform admins may inspect any fee from the dedicated finance page without widening ordinary contract access.

## Reconciliation/export

Platform fees → Reconcile and export fee ledger takes a read-only repeatable snapshot. It checks missing fee records, exact contract amount/currency, payer, completion/cancellation state, paid receipt history and write-off audit fields. It returns discrepancies, row-level statements and totals by currency and status. There is no mixed-currency total or FX conversion. The report identifies issues; it never repairs them. Treat downloaded finance JSON as private commercial data and do not commit it to git or share publicly. Statement lists show the latest 200; reconciliation checks the full ledger.

## Deployment/rollback

Additive migration 029 adds payer/policy/due/receipt fields, retained submission history, one pending submission per fee and a case-insensitive unique platform receipt index. Backfill preserves money/status. Run fresh/upgrade migrations and the full native release gate. Do not reset app volumes. Down migration deliberately refuses deletion: roll forward after collection activity and keep receipt/audit history. No new secrets or payment-provider account is required.

## Explicit open work

Tax treatment is not configured. Documents explicitly say commercial fee statement, not tax invoice. A real bank/payment channel, tax/entity policy, legal commercial approval, official invoice numbers/emails and actual provider reconciliation are still PAY-011–PAY-013/LEG-010. Partial receipt, refunds, credits and returns remain LOG-006. Currency-specific minor units/rounding and supported currencies remain CUR-001–CUR-003; this wave retains the existing two-decimal schema rather than claiming complete multi-currency support. Do not treat a recorded admin verification as independently reconciled bank data.

## Verification

26 new unit/dashboard cases protect policy, party permissions, amount/currency verification, retries, write-off and critical audit rollback. Fourteen native PostgreSQL API cases cover actual completion, decimal boundary, privacy, zero fees, stale quotes, rejection, write-off, cancellation, drift and concurrency. One browser journey covers the actual payer submission, admin verification and statement download. Fee-due audit failure has a native rollback regression for accrual, acceptance and custody together. Browser fixtures reuse the authenticated reviewer session rather than weakening production login limits. Native Docker/browser/image/recovery gates remain required; supplemental single-connection SQL is not concurrency proof.
