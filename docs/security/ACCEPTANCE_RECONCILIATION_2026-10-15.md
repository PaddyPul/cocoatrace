# Acceptance reconciliation — 2026-10-15

This review maps named open rows to existing implementation and accepted decision records. The founder reported the pilot-integrity release passed and merged on 2026-10-15. That accepts the newly published engineering ADR set; it does not prove hosted infrastructure, independent security review or commercial/legal decisions. No runtime or destructive reset was executed for this review.

| Row | Evidence | Reconciliation |
| --- | --- | --- |
| DEC-002 — Revocable session architecture | ADR004; `api/src/services/authSessionService.ts`; `api/src/middleware/auth.ts`; native auth-boundary and MFA suites | Close the architecture decision: database-authoritative sessions, live account/permission checks, revocation and privileged assurance are explicitly selected with alternatives and consequences. Physical recovery and deployed TLS/cookie evidence remain separate. |
| DEC-003 — Application policies versus PostgreSQL RLS boundaries | ADR005; authorization matrix/register; `api/src/modules/catalog/privateResources.ts`; native source-resource and authorization-route suites | Close the decision: application policy is authoritative today; RLS is explicitly separate defense-in-depth work under SEC-016. This does not claim RLS exists or every older route already has matching nondisclosure. |
| DEC-004 — Object storage, malware scanner and evidence lifecycle | ADR006; evidence storage/upload/availability services; payment document policy; native availability/transfer-budget suites | Close the architecture decision: private adapter-backed storage, quarantine, malware validation, current authorized retrieval and durable cleanup are chosen. Hosted bucket/provider provisioning, encryption/access settings and restore proof remain open. |
| DEC-006 — Background job/queue implementation | ADR007; operations worker/jobs/recovery; payment reminders; operations jobs runbook and native worker suite | Close the implementation decision: durable database work/outboxes, independent bounded scheduling/ownership and reviewed recovery. Hosted scheduling, actual inbox delivery and independent monitoring remain open. |
| ENV-016 — Safe explicit demo reset | Root `package.json` `demo:reset`; `api/scripts/demo.ts`; `api/scripts/demo-data.ts`; `api/src/services/demoResetGuard.ts`; `api/src/demoDataGuard.test.ts` | Existing reset is explicit and checks its guard before opening its pool. The guard unconditionally refuses both staging and production, including when remote override is supplied. Strengthen regression evidence for staging and override non-bypass, and document the exact maintenance invocation and synthetic-data scope before closure. Do not add a duplicate reset implementation merely because the preview runner has no reset action. |

The ADR records and index still say publication review is pending as of the prior candidate; update that historical status to the founder-reported acceptance when recording these decision closures.

## Rows deliberately left open

- DEC-001 needs a selected hosting/regional provider; a documented zero-budget boundary is not provisioning or provider selection.
- DEC-005 needs the actual email provider and transactional ownership decision, beyond adapter implementation.
- DEC-007 includes a business-verification standard. ADR008 selects reviewed email/invitation onboarding but explicitly distinguishes email control from legal identity or goods authenticity; it does not establish the business-verification standard.
- DEC-008/009 include legal meaning and commercial fee collection policy. ADR009 documents engineering boundaries without resolving legal, invoicing, taxation or regulatory approval.
- GOV-002 needs a named owner for every active P0/P1 row; a founder coordinating the risk register alone is insufficient.
- GOV-006 and SEC-013 include external repository settings. Local CI definitions and passing releases do not prove branch-protection or secret-scanning settings.
- ENV deployment rows, independent review, representative hosted load and incident ownership retain their actual external acceptance requirements.

No additional open row was identified as fully complete from this narrow evidence review. Named-row closure must follow its original scope, rather than counting a documented follow-up as completed implementation.
