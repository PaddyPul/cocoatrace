# ADR 003 — Zero-budget hosting and synthetic preview boundary

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review of this decision record is pending. This status does not assert hosted deployment or independent security acceptance.

## Context

A persistent pilot needs private database and evidence storage, malware scanning, TLS, secrets, durable jobs and a tested restore. The founder has authorized USD 0/month; free compute alone does not establish these capabilities.

## Decision

Keep the supervised, email-restricted synthetic preview as the available demonstration path. Do not expose real customer data or treat it as persistent staging. Persistent staging requires verified free capacity, isolated identities/database/buckets, private encrypted evidence, transactional email and hosted security/restore evidence before admission. No paid plan, metered overage or trial dependency is authorized. The previously proposed provider investigation remains conditional; this record chooses the admission rule, not a provisioned provider.

## Alternatives and rationale

A temporary local tunnel is inexpensive but has changing URLs and depends on the founder's machine. A free VM may support the full stack but eligibility, capacity and provider behavior need account evidence. Combining sleeping free services without the scanner or durable storage fails the security requirements; paid managed infrastructure exceeds the present budget.

## Consequences, validation and change control

Synthetic demonstrations can continue while persistent hosting is blocked. No uptime or production readiness claim follows. Provider terms must be rechecked at provisioning; links in the older plan are historical research, not a current availability guarantee. A future budget/provider decision supersedes this record explicitly.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [docs/runbooks/FREE_STAGING_PLAN.md](../../docs/runbooks/FREE_STAGING_PLAN.md)
- [docs/runbooks/ZERO_COST_DEMO_PREVIEW.md](../../docs/runbooks/ZERO_COST_DEMO_PREVIEW.md)
