# BetterTrade pilot operating model

Updated 2026-10-06; replaces the cocoa-only/certifier-required pilot assumptions. See [pilot plan](BETTERTRADE_PILOT_PLAN.md) for launch gates and capacity proposals.

## Core invited pilot

Founder selects one narrow commodity/corridor and named buyer/supplier design partners. Each organization is reviewed and its administrators invited; shared demo accounts never enter the real-data environment. Start with a small cohort and an assigned incident/support owner. Participants agree known limitations, privacy/retention, fee/currency policy, fulfillment and payment terms and measures of success.

Conventional supply: create inventory → publish → receive/respond to offers → agree terms → fulfill → buyer accepts → settle recorded trade. Source-traceable supply: register relevant source records, record harvest/production/inventory and appropriate evidence, then follow the same commercial flow. Existing farm/plot vocabulary is material-specific, not universal. Evidence contribution begins from an actual record/request. A platform certifier login is not a prerequisite to trading; declarations and independently reviewed claims remain clearly distinguished.

Customers may arrange transport externally. An external transport form records agreed coordinator, booking/contact/route and relevant identifiers; it is not a carrier booking or guaranteed acceptance. Incoterm, goods payment schedule, service payer and buyer delivery acceptance remain independent concepts. Define which party can record each milestone and required data for the chosen mode before pilot. Paid cancellation/refunds/returns are unavailable unless their policy and implementation are explicitly approved; disclose supported exception routes.

## Provider-enabled pilot

After core gates, invite a small curated provider cohort. Review identity, route/cargo capability, licenses/insurance and validity. A coordinator sees eligible providers, sends minimized RFQs, compares quotes and requests an award. Provider acceptance creates a separate service order. Provider updates never authorize goods payment/custody settlement or substitute for buyer acceptance. No DHL/FedEx/other carrier API account is required. See [service marketplace specification](BETTERTRADE_SERVICE_MARKETPLACE.md).

## Daily operation and evidence

Record actual onboarding completion, time to publish/source, response/acceptance rate, time to fulfilled/accepted trade, recurring usage, exception frequency, support time and reconciled revenue/costs. Schedule payment/fee/inventory reconciliation and monitored notification workers. Assign support escalation, incident response and rollback responsibility; test recovery of database and private objects. Gather participant feedback after each first trade and review weekly.

Only synthetic fixtures are used in demos/tests. Real parties, documents and delivery evidence stay in isolated hosted resources with approved retention/access. Hosted inbox/restore/alert checks cannot be replaced by a demo verification link. USD 0/month does not waive security; missing safe hosting remains a launch blocker.

Previous planning detail is retained in [the historical archive](archive/pre-bettertrade-2026-10-06/PILOT_OPERATING_MODEL.md); its obsolete deployment/product assumptions do not apply.
