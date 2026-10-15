# Architecture decision register

GOV-004 decision set, published candidate 2026-10-15. These records describe why the current engineering boundaries were selected; they are not a deployment approval or a claim that every related backlog item is complete.

| Record | Scope | Status |
| --- | --- | --- |
| [001](001-frozen-schema-bootstrap.md) | Immutable schema bootstrap and upgrade | Existing accepted-for-implementation record; its original validation qualification is retained |
| [002](002-bettertrade-platform-boundaries.md) | BetterTrade modular platform and optional service orders | Proposed; provider/commercial implementation is not accepted by this index |
| [003](003-zero-budget-hosting-boundary.md) | Zero-budget hosting and synthetic preview | Current engineering boundary documented; record publication/founder review accepted 2026-10-15; persistent provider unprovisioned |
| [004](004-authoritative-sessions.md) | Authoritative sessions and privileged assurance | Current implementation/direction documented; record publication/founder review accepted 2026-10-15 |
| [005](005-tenant-and-resource-isolation.md) | Tenant and resource authorization | Current implementation/direction documented; record publication/founder review accepted 2026-10-15 |
| [006](006-private-evidence-storage.md) | Private evidence storage and release | Current implementation/direction documented; record publication/founder review accepted 2026-10-15 |
| [007](007-durable-operational-jobs.md) | Durable jobs, outboxes and recovery | Current implementation/direction documented; record publication/founder review accepted 2026-10-15 |
| [008](008-reviewed-organization-onboarding.md) | Reviewed organization onboarding | Current implementation/direction documented; record publication/founder review accepted 2026-10-15 |
| [009](009-goods-payment-and-fulfillment-boundaries.md) | Goods payments and fulfillment authority | Current implementation/direction documented; record publication/founder review accepted 2026-10-15 |

## Ownership and acceptance

The founder owns product, budget and commercial approval. Engineering owns consistency with the implementation and its tests. Security/operations reviewers own independent and deployed acceptance where required. A record can describe a previously approved engineering choice while its newly published text awaits founder review; that does not retrospectively approve proposed logistics behavior or hosted infrastructure.

The seven GOV-004 topics now have an explicit decision, rationale, alternatives, consequences and source/evidence pointers. Closing the documentation item after founder acceptance does not close provider provisioning, RLS, every resource-convention review, external email receipt, physical MFA recovery, payment-provider regulation, tax decisions or hosted restore/incident gates.

## Change procedure

Start with [the template](000-template.md). Record scope, alternatives, actual evidence and unresolved dependencies. Preserve historical records; use a new superseding ADR for incompatible decisions. Do not relabel proposed decisions as accepted merely because their files exist. Review the relevant ADR when changing its implementation, deployment prerequisites or product claims.
