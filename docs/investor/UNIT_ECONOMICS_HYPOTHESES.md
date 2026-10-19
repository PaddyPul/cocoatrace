# Unit economics hypotheses

Reviewed 2026-10-19 · INV-012 · Owner: founder/commercial lead

This is a planning model to test, not observed customer economics, revenue guidance, an approved price list or a valuation. There are no customer acquisition, conversion, repeat-trade or retention measurements asserted here. Before external use, the owner must replace assumptions with dated, permissioned pilot observations. Keep currencies separate; the examples use an arbitrary single currency unit (CU), not a proposed settlement currency or an FX conversion.

## Implemented fee basis and collection boundary

The recorded goods value is contract quantity in kg multiplied by contract price per kg. The invoice reconciles its immutable rate snapshot against that value, rounded to the recorded currency minor units. See [fee ledger](../../api/src/modules/fees/ledger.ts), [money arithmetic](../../api/src/services/tradeMoney.ts) and [environment configuration](../../api/src/config/env.ts). Configuration defaults to 100 basis points (1%) and accepts 0–1,000 basis points; these technical limits are not commercial approval of any rate, tax treatment or payer agreement. Hypothetical sensitivities below deliberately vary the rate.

For newly enrolled seller-predispatch-v3 trades, the seller accepts the exact fee snapshot and invoice becomes payable before dispatch. Independent finance verifies externally received money; a submitted reference is not cash collection. Active credit permits a bounded exception and leaves debt payable; a write-off is not collected revenue. Older policy versions retain their historical rules. See [enforcement service](../../api/src/modules/feeEnforcement/service.ts) and [fee policy runbook](../runbooks/FEE_COLLECTION_ENFORCEMENT.md).

A contract, accepted offer, issued statement and verified receipt are different events. Use verified receipt amounts minus confirmed external refunds when measuring realized fee cash. Separately report outstanding credit, waivers, unreconciled records and timing. The platform neither moves funds nor provides escrow. [Refund service](../../api/src/modules/feeRefunds/service.ts) and [reconciliation](../../api/src/modules/fees/reconciliation.ts) define the recorded boundary; independent bank and accounting checks are still needed.

## Model and sensitivity

For an eligible trade, let V be goods value, r the fee fraction, c the eventual collected fraction after waivers, losses and full refunds, and D the variable service cost. Planning contribution is V × r × c − D. This expected-value simplification does not represent an accounting revenue-recognition policy. Actual receipt/refund timing and invoice rounding must be modeled separately. Never add goods payment principal to platform revenue.

| Hypothetical scenario | V (CU) | r | c | Expected fee cash (CU) | D (CU) | Contribution (CU) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small, costly trade | 2,500 | 0.5% | 70% | 8.75 | 45 | −36.25 |
| Working hypothesis | 10,000 | 1% | 90% | 90 | 35 | 55 |
| Larger, lower-touch trade | 25,000 | 1.5% | 98% | 367.50 | 25 | 342.50 |

These are deliberately contrasting examples, not forecast probabilities. Test fee fractions 0.5–1.5%, collection fractions 70–98%, direct service cost 25–45 CU and goods values 2,500–25,000 CU independently; favorable assumptions need not occur together. Dispatch enforcement may improve collection discipline but does not prove willingness to pay, prevent off-platform bypass or eliminate losses.

D must include actual staff time for onboarding allocation, document questions, finance review, disputes and recall support, plus storage, scanning, email and infrastructure allocated per trade. Suggested initial time hypotheses are 1–4 hours per organization onboarding and 0.25–1.5 hours per trade support, at a fully loaded 10–30 CU/hour. These are experimental ranges, not wages or measured costs. Use observed infrastructure bills and allocation rules, including idle capacity; do not equate a free development tier with zero operating cost. Track onboarding once per organization and do not count it again in D if treated as initial investment below.

## Acquisition and payback hypotheses

| Channel hypothesis | Experiment and cost boundary | Evidence needed before scaling |
| --- | --- | --- |
| Founder-led buyer outreach | Record research, outreach, demos and follow-up hours, including failed prospects | Permissioned contacts, qualified conversations, organization activation and first verified fee receipt |
| Supplier/cooperative referrals | Pilot a small referred cohort; record staff time, travel and any agreed referral expense | Referred versus direct activation, payer consent and repeated eligible trade |
| Trade association or corridor partner | Test a scoped introduction/demo without claiming partnership endorsement | Written scope, full event/partner costs, attributable activation and actual support burden |

No channel is validated or represented as an existing agreement. CAC is total cohort acquisition expenditure divided by newly activated paying organizations under a declared definition and attribution window; report the denominator and unsuccessful acquisition effort. A signup or invitation alone is not a paying organization. Track buyer and seller acquisition separately and declare allocation to trades so two-sided acquisition is not omitted or double counted.

For illustration only, 300 CU acquisition plus 120 CU one-time onboarding requires ceil(420 / 55) = 8 working-hypothesis trades to repay that initial cost, before fixed overhead. At two such trades per month that is four months after activation; at half a trade per month it is sixteen months, assuming continued use and collection. Churn before payback prevents recovery. Negative contribution never reaches break-even by increasing trade volume.

With 2,500 CU monthly fixed overhead and 55 CU contribution per trade, operating break-even before new acquisition/onboarding is ceil(2,500 / 55) = 46 trades/month. If ten new organizations each incur 420 CU that month, the same simplified cash model needs ceil((2,500 + 4,200) / 55) = 122 trades. These exclude taxes, financing costs and unusual liability; add actual applicable costs before decisions. Do not infer TAM, valuation or annual recurring revenue from these calculations.

## Pilot validation and maintenance

Before pilot pricing, the founder must approve payer/rate and payment channel with qualified tax/legal review. Do not change used versioned terms retrospectively. For each permissioned cohort, retain dated acquisition cost and attribution, activation definition, onboarding hours, support category/time, eligible goods value/currency, fee version/rate, invoice and independently checked receipts/refunds, credit days, repeat trades and abandonment reasons. Use scoped aggregate reporting and access controls; never copy bank references, personal documents or evidence bytes into investor material.

Review after the first completed cohort and monthly thereafter. Compare actual versus assumed ranges, expose missing observations, and revise assumptions explicitly rather than relabeling them as results. Low receipt conversion, negative contribution or unacceptable safety/support cost triggers pricing/process investigation before scaling; no arbitrary sample is claimed statistically representative. Owner sign-off and dated cohort evidence remain open. INV-012 closes only the documented-hypotheses deliverable; commercial validation and approved pricing remain separate backlog work.
