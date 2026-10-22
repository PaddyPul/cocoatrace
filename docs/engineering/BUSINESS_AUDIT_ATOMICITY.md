# Business audit atomicity

Founder reports full release passed and merged on 2026-10-21 (main PR #138). Accepted batch: existing critical business events now share the mutation's PostgreSQL transaction. Audit insertion failure rejects the operation and rolls the business change back. The removed best-effort audit API cannot silently swallow these failures.

| Flow | Transaction boundary |
| --- | --- |
| Harvest and direct inventory | Batch, initial holding and audit |
| Sourcing and organization creation | New record and audit |
| Onboarding completion | Workspace state and completion audit |
| Compliance/EUDR references | Authorized reference change and audit |
| Public product upsert/publication | Batch ownership lock, profile change and audit |
| Invitation issuance/acceptance/revoke/resend | Token or account/role transition and audit |
| Evidence intent, scan outcome and completion | Database transition, ownership/retention and audit |

The durable-invitation candidate now queues delivery intent with invitation creation, resend and first-admin organization approval, including its audit. Immediate email submission happens only after commit, and the existing tracked worker recovers outstanding generations. AES-GCM credentials, current issuer/recipient checks, bounded claims and audited operator recovery are documented in [INVITATION_DELIVERY.md](../runbooks/INVITATION_DELIVERY.md). Founder reports full release passed and merged; main PR #140 contains the invitation delivery slice.

Evidence storage/scanning remain outside database transactions; failed completion queues held quarantine/final objects for cleanup. Completion preserves the full content SHA256. These guarantees do not claim distributed provider atomicity or universal event coverage. ARC-013 still requires the complete write/event inventory; IDN-021 still requires real staging inbox evidence.

Nine new native PostgreSQL cases inject audit failure for organization, sourcing, onboarding, harvest/direct inventory, two compliance references and public profile save/publication. Unit tests cover invitation send ordering, acceptance and rollback, evidence cleanup and hash preservation. Native scanner/storage, concurrency and browser acceptance must come from the full release. No migration, dependency, fee policy or timeout changes.

The 2026-10-22 evidence audit candidate adds [the lifecycle event matrix](EVIDENCE_LIFECYCLE_AUDIT.md) and a mandatory [HTTP mutation review inventory](mutation-audit-coverage.json). The gate detects route/handler drift and missing evidence, not transitive transactional correctness. Explicit review-required entries and the curated background-job limitations keep ARC-013 open.
