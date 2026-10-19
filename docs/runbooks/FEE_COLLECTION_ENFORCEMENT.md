# Platform fee collection enforcement

New trades use seller-predispatch-v3. Old invoices retain seller-completion-v2. Migration049 adds no retrospective enrollment. Goods payment, physical custody settlement and platform fees remain separate records.

1. Agree the goods payment plan. The seller reviews the exact platform fee, payer, version and cancellation/credit policy, then accepts. The server binds the displayed fingerprint and records immutable consent plus critical audit.
2. The fee becomes invoiced and payable immediately on consent. Obtain confirmed platform payment instructions; the payer pays externally and submits a reference. This is not collection verification.
3. Independent platform finance verifies exact currency/amount and bank receipt through the existing ledger UI, using a real passkey verified within5minutes. Receipt must not be reused.
4. Dispatch requires accepted unmodified terms and either verified receipt, active independent credit, audited waiver or zero fee. Seller exceptional goods-payment dispatch cannot bypass this.
5. Credit is reviewed for a single trade, reasoned, revision-bound, maximum30days and revocable. Debt remains payable. Expired credit cannot authorize a new dispatch boundary; arrival/receipt/recall safety records remain available.
6. More than7days overdue positive v3 invoices restrict the payer creating/accepting new offers. A submitted unverified reference does not remove the debt. Listings and existing trade/safety access are retained. Verified receipt, valid credit or audited write-off clears the applicable restriction.
7. Bilateral cancellation can void an unpaid invoiced v3 fee only when no fee submission or other financial/transport activity exists. Submitted fees require finance investigation. Eligible paid fees use the separately reviewed full external-refund workflow (request, independent finance transfer record, payer receipt); no bank transfer is initiated by the platform. See the fee refund implementation and billing recovery handoff. Do not change paid records or goods history by SQL to bypass this.

Fresh assurance failures retain review text; step up with the existing passkey process, refresh terms and review again. Snapshot/revision conflicts require reviewing the current record. Unknown/missing terms never mean free dispatch. Write-off is a debt waiver and must never be described as collected revenue.

Test isolation: existing disposable integration/browser journeys deliberately pin v2 through TEST_LEGACY_FEE_POLICY=true. Configuration rejects this outside test databases/environment. The new native suite explicitly exercises v3 enrollment through actual offer acceptance, gates and finance workflows; mocked browser tests cover user review behavior. Deployment must omit the fixture flag. Full release is required before merge.

This workflow records external attestations. It does not initiate a debit, hold customer money, reconcile a bank API, issue tax invoices or promise refunds. PAY-011/PAY-012 remain partial until channel, tax, outbound billing and compensation operations are approved and verified.

Policy text is part of the accepted fingerprint. Do not edit the meaning or wording of v3 terms after use; introduce a new version and preserve the prior version text for existing contracts.
