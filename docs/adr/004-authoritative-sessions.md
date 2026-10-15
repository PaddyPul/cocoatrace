# ADR 004 — Database-authoritative sessions and privileged assurance

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review of this decision record is pending. This status does not assert hosted deployment or independent security acceptance.

## Context

JWT signature validity alone cannot reflect immediate suspension, role changes or logout. Privileged users require stronger assurance without giving password sessions unrestricted administrator access.

## Decision

Use the signed token together with a stored session identity, token hash, expiry and revocation state. Resolve live account/organization and permissions server-side; preserve authoritative session revocation after password/security changes. Privileged passkey enrollment and verified-session assurance gate access; fresh assurance is separately required for sensitive writes. Cookie-authenticated mutations enforce the origin boundary. Authenticated HTTP responses use no-store. Browser state is transport/UI state, not authorization authority.

## Alternatives and rationale

Stateless JWT-only access simplifies database use but cannot immediately revoke existing grants. Third-party identity delegation would introduce another operational dependency and would still require application resource policies. The current database session model makes revocation explicit at the cost of database availability and reads.

## Consequences, validation and change control

Fail closed when authentication cannot be established. Never restore revoked sessions during account restoration. Reviewed recovery does not silently bypass passkeys; replacement enrollment consumes its bounded approval. Hosted cookie/TLS settings and physical reviewer independence still need deployment evidence. Replace this model only through a token/session compatibility and revocation migration.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [api/src/services/authSessionService.ts](../../api/src/services/authSessionService.ts)
- [api/src/middleware/auth.ts](../../api/src/middleware/auth.ts)
- [api/test/integration/authBoundary.integration.test.ts](../../api/test/integration/authBoundary.integration.test.ts)
- [api/test/integration/mfa.integration.test.ts](../../api/test/integration/mfa.integration.test.ts)
