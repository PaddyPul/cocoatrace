# ADR 008 — Verified-email applications and reviewed invitation onboarding

Date: 2026-10-15. Backlog: GOV-004.

Status: records the accepted current engineering direction and existing implementation boundaries; publication/founder review of this decision record is pending. This status does not assert hosted deployment or independent security acceptance.

## Context

Self-service signup must not grant an organization or privileged membership merely because an applicant supplies an email address or opens a demonstration link.

## Decision

Separate access application, email verification, platform review and invitation acceptance. Platform review authorizes approval/rejection; approved first-admin invitations create the intended membership through the existing transactional issuance boundary. Invitation links are bounded credentials with rotation/revocation and single-use controls. Demo verification/acceptance links remain explicitly demo behavior; real transactional email requires configured delivery. Organization identity/eligibility approval is distinct from certification of its goods.

## Alternatives and rationale

Immediate unrestricted signup is simpler but bypasses the curated pilot admission model. Making every supplier obtain a platform-issued product certificate before onboarding would prevent conventional trade and conflate account eligibility with evidence review. Manual database account creation would bypass audit and token lifecycle controls.

## Consequences, validation and change control

Email verification proves control of an address, not legal identity or goods authenticity. Approval/retry concurrency must not duplicate organizations or revive revoked invitations. Configured SMTP and real inbox delivery need environment evidence; tests using captured email do not establish production delivery. A future open-registration policy requires explicit risk review and updated membership controls.

Implementation and regression references below identify evidence locations; they do not certify that a new full release or hosted rehearsal has run for this document change. Supersede this ADR with an explicit migration/recovery plan when its boundary changes.

## Source and evidence

- [api/src/modules/organizationAccess/service.ts](../../api/src/modules/organizationAccess/service.ts)
- [api/src/services/invitationIssuance.ts](../../api/src/services/invitationIssuance.ts)
- [api/src/services/invitationDelivery.ts](../../api/src/services/invitationDelivery.ts)
- [docs/runbooks/IDENTITY_EMAIL_DELIVERY.md](../../docs/runbooks/IDENTITY_EMAIL_DELIVERY.md)
- [api/test/integration/multiTenantApi.integration.test.ts](../../api/test/integration/multiTenantApi.integration.test.ts)
- [e2e/identity.spec.ts](../../e2e/identity.spec.ts)
