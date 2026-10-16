# Transport timing and exceptional-dispatch awareness

## Authority and meaning

The Incoterm assignment continues to decide the arranging party and who may report each milestone. New controls do not grant transport powers to the other party. Read access requires current shipment parties and shipment.read. Mutations recheck live account, organization, session and grants in a transaction with mutation assurance. An unrelated wildcard administrator does not become a contract party.

Exceptional dispatch retains its existing seller-only payment-risk exception, recorded reason and audit. The buyer can explicitly acknowledge seeing that particular exception. This is awareness, not a waiver, agreement to payment, legal risk transfer, inspection acceptance or permission to settle. The seller cannot acknowledge for the buyer. Historical exceptions are unacknowledged until reviewed. The receipt binds to the current reason/time fingerprint; stale review conflicts. Repeated identical acknowledgements retain the original receipt and audit once. Do not delete or amend acknowledgement history.

## Timing

Estimated arrival is a UTC calendar date, not an independently verified provider prediction. Only the current assigned arranging party can edit it. A reviewed revision and bounded explanation accompany updates. A changed date must never silently overwrite a concurrent change. Existing arrangement API calls may set an initial ETA with an explicit initial-arrangement attribution; subsequent changes require the reason/revision policy and share its immutable history.

The shipment panel loads timing and history on demand. Latest100 revisions are displayed with explicit historyHasMore; the stored history is retained. Missing ETA stays unknown. Overdue means the ETA calendar date ended in UTC and arrival has not yet been reported. Arrival/customs/unloading/delivery or cancelled trade suppresses the pending-arrival notice. No artificial deadlines are inferred for other milestones. Recorded dates and milestones remain party reports, not platform-verified carrier events.

## Notices and failure

The private current inbox combines existing trade actions, overdue arrival and pending exception acknowledgement. Each source SQL uses a1001 sentinel before returning at most1000 current actions. The combined feed refuses scope overflow instead of dropping transport notices. Current actor permissions and contract-party predicates apply to each source; read receipts remain user/workspace private. A read receipt does not acknowledge a dispatch exception. Open the shipment and submit the explicit reviewed acknowledgement.

No email, SMS, polling worker, carrier integration or guaranteed external delivery is introduced. PRD-008 and hosted alert delivery remain separate. Unavailable queries remain errors, never “no delays.” No milestone, payment, recall, delivery acceptance, custody or settlement guard is relaxed.

## Deployment

Forward migrations046/047 add timing history/revisions and dispatch acknowledgement receipts. Preserve frozen migrations and volumes. Normal Node startup applies registered migrations; do not invoke npm/npx inside the hardened runtime. Review compatibility before application rollback and retain history. No secrets, service subscriptions or dependency changes are required.

Native/browser definitions cover current roles/parties, stale revisions, missing reasons, retries, audit rollback, legacy initial ETA compatibility, overdue boundaries and explicit review. Runtime release/CI acceptance is required; author compilation and policy checks alone do not establish hosted pilot readiness.
