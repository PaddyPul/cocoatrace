# Business audit atomicity

Candidate batch: existing critical business events now share the mutation's PostgreSQL transaction. Audit insertion failure rejects the operation and rolls the business change back. The removed best-effort audit API cannot silently swallow these failures.

| Flow | Transaction boundary |
| --- | --- |
| Harvest and direct inventory | Batch, initial holding and audit |
| Sourcing and organization creation | New record and audit |
| Onboarding completion | Workspace state and completion audit |
| Compliance/EUDR references | Authorized reference change and audit |
| Public product upsert/publication | Batch ownership lock, profile change and audit |
| Invitation issuance/acceptance/revoke/resend | Token or account/role transition and audit |
| Evidence intent, scan outcome and completion | Database transition, ownership/retention and audit |

Invitation email delivery runs after commit and release; audit failure prevents sending. Delivery still lacks a durable transactional outbox. Evidence storage/scanning remain outside database transactions; failed completion queues held quarantine/final objects for cleanup. Completion preserves the full content SHA256. These guarantees do not claim distributed provider atomicity or universal event coverage. Invitation resend/revoke live authority revalidation remains separate.

Nine new native PostgreSQL cases inject audit failure for organization, sourcing, onboarding, harvest/direct inventory, two compliance references and public profile save/publication. Unit tests cover invitation send ordering, acceptance and rollback, evidence cleanup and hash preservation. Native scanner/storage, concurrency and browser acceptance must come from the full release. No migration, dependency, fee policy or timeout changes.
