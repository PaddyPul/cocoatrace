# ADR 005 — Application-owned tenant and resource authorization

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review of this decision record is pending. This status does not assert hosted deployment or independent security acceptance.

## Context

Permissions establish a class of actions but do not establish ownership of a specific farm, holding, trade or evidence object. An ordinary tenant must not acquire network visibility from a guessed identifier.

## Decision

Enforce authentication and declared action permission before payload processing, then current tenant/relationship policy on each resource request. Explicit network/read-all grants are deliberate exceptions, not implicit administrator UI behavior. Bound paged reads and cursor scope to actor/filter context. Keep private resource ownership/relationship authorization and hydration in a bounded database snapshot where implemented. Foreign and absent private source/trade resources use matching nondisclosure responses; this does not claim every older route already has the same convention. Preserve public-profile metadata projections as a separately authorized publication boundary.

## Alternatives and rationale

PostgreSQL RLS can provide defense in depth but is not yet the universal policy layer. Client-side filtering cannot protect records already delivered. A database per tenant would increase provisioning, migrations and cross-party trade complexity before the pilot establishes need.

## Consequences, validation and change control

Every new route needs an inventory entry plus positive and negative resource tests; route-level permission coverage is not proof of resource isolation. RLS remains separate backlog work. Changes to ownership must affect later cursor requests; never trust the original page's authorization. Policy changes must retain legitimate multi-party trade relationships and explicit network controls.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [docs/security/AUTHORIZATION_MATRIX.md](../../docs/security/AUTHORIZATION_MATRIX.md)
- [docs/security/route-authorization.json](../../docs/security/route-authorization.json)
- [api/src/modules/catalog/privateResources.ts](../../api/src/modules/catalog/privateResources.ts)
- [api/test/integration/sourceResourceBoundary.integration.test.ts](../../api/test/integration/sourceResourceBoundary.integration.test.ts)
- [api/test/integration/authorizationRoutes.integration.test.ts](../../api/test/integration/authorizationRoutes.integration.test.ts)
