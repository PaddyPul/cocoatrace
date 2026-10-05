# Recall response and controlled closure

Backlog: RCL-003–RCL-007, QLT-021. Migration 023 is forward-only and preserves existing notices.

Affected organizations are derived from actual lot owners, batch holders, contract buyers/sellers and distribution recipients. The issuing organization is automatically acknowledged; each other organization acknowledges through its own signed-in user. A manager can record contacted, unreachable or escalated, but cannot acknowledge for another organization.

Each current holder records a replaceable snapshot of quarantined, returned, destroyed, corrected and released kilograms. Up to three decimal places are supported. The sum cannot exceed the holding. Historic transferred holdings are excluded from physical accounting. Required audit events commit in the same transaction as responses; an audit failure rolls the response back. Neither inventory quantities nor custody ownership are edited by this workflow.

Closure requires the initiating manager (or an explicit network recall manager), a substantive reason, clean validated private evidence attached to this exact recall, every participant acknowledgement, and complete current-inventory accounting with no quarantine remaining. Clean malware status validates file handling; it does not certify the underlying claim. Evidence review status is not automatically approved.

Released/corrected stock can be reviewed and explicitly republished after closure. Returned/destroyed stock retains a safety hold even when the notice is resolved. If any holding retains a hold, its entire affected batch stays blocked. Physical segregation, stock write-offs and returned-material custody adjustments need a separate audited workflow; this release deliberately does not invent them. Closed notices and responses are read-only; published product pages retain notice history and show continuing safety holds.

## Notifications

The API runs a durable outbox worker every 15 seconds. Activation and closure enqueue one notification per active affected user and event. Workers claim rows using transactional leases and `SKIP LOCKED`; retry delays grow from 60 seconds to a maximum hour, with eight attempts. Expired leases can be reclaimed; an expired eighth lease becomes a visible terminal failure. The delivery CLI reports terminal failures and exits unsuccessfully until an operator addresses them. SMTP acceptance is displayed separately from recipient acknowledgement and is not proof of inbox delivery. A process failure after SMTP acceptance can produce a duplicate email on retry (at-least-once delivery).

Recall messages reuse the configured SMTP sender and WEB_URL. In local development with email disabled, delivery is recorded as suppressed. Suppressed messages are not automatically re-sent when configuration changes. Configure SMTP before the test; use the captured Mailpit inbox in `docker-compose.email-test.yml`. Real-provider delivery and bounce/complaint handling remain deployment gates.

For one manual worker pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api node --import tsx api/scripts/deliver-recall-notifications.ts
```

For safety reconciliation:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api node --import tsx api/scripts/reconcile-recall-safety.ts
```

The report includes retained holds and flags published supply under them. It never releases inventory or alters quantities. Check failed/terminal email statuses in the manager response panel and record contact/escalation if needed. A manager must not treat email status as acknowledgement. An organization with no active contact is visibly escalated and cannot be acknowledged until a real user is enrolled; activation and stock blocking still succeed. There is no manager bypass of acknowledgement.

## Remaining scope

External recipients without a platform account, operator requeue of exhausted/suppressed messages, delivery webhooks, per-lot physical segregation, mixed-material recovery and automatically assigned escalation deadlines remain backlog items. This is an in-platform buyer/supplier response workflow; those capabilities are not claimed as complete.
