# PR title

Add audited buyer/supplier access suspension and safe restoration

# PR description

## Outcome

Platform administrators can suspend a buyer/supplier member or organization from Account access controls. Suspension blocks new authentication and revokes current sessions; organization suspension also revokes pending invitations. Restoration requires a fresh sign-in and never revives old sessions or invitations. Access status stays separate from organization verification and inventory/payment states.

## Tracking

- Backlog ID(s): IDN-011; related IDN-003, IDN-014 and SEC-007.
- Issue/ADR: docs/runbooks/ACCESS_SUSPENSION.md; docs/security/AUTHORIZATION_MATRIX.md.
- Target phase/environment: core invited-pilot security foundation; disposable local testing before hosted staging.

## Change summary

- Extract transaction/audit infrastructure into shared services while preserving existing trading compatibility exports.
- Add a dedicated access-controls module with policy, validated input, password reauthentication, bounded listing and transactional persistence.
- Require live platform permission, current administrator password and a substantive decision reason; protect platform administration organizations from routine lockout.
- Commit access flags, session/invitation revocation and audit/security events atomically; serialize identical decisions and new session issuance.
- Keep restored sessions/invitations revoked; preserve separately suspended users and inactive/deactivated state.
- Pin development runner shell-quote to 1.11.0 to repair GHSA-pqg4-j6r4-53mv; add two non-executing quoting regressions to the release gate. Keep advisory enforcement and existing exception policy unchanged.
- Add administrator navigation and review forms, shell English/French labels, password redaction and automated unit/PostgreSQL/browser coverage.
- Reconcile merged authentication work: SAF-001/IDN-013 closed on founder-reported release/merge confirmation. Broader abuse/ingress and privileged MFA/recovery remain open.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Tenant administrators cannot call global access controls. Platform actors deliberately have cross-organization review access. Explicit target enum/UUID schemas, 50-row cursor pages, current password confirmation, shared mutation throttling and live transactional actor/session/password rechecks protect decisions. No passwords enter audit metadata. No outgoing suspension email/outbox is introduced. In-flight requests already authorized may complete; suspension is a new-request boundary. Public listings are not automatically withdrawn by this slice. Privileged suspension/recovery and MFA remain explicit pilot blockers.

## Database and deployment

- Migration required: yes — 032_access_suspension.ts adds nullable access_suspended_at columns to users/organizations; integrity manifest updated.
- Backfill/lock implications: no customer-row backfill. ALTER TABLE takes brief metadata locks; schedule reviewed deployment. Access decisions lock target organization and selected user; session issuance uses organization-then-user order; invitation acceptance uses organization-then-invitation order.
- Rollback or compensation: forward correction preferred. Restoring access is audited and does not revive credentials. An old API ignores access flags; restrict/stop exposure before any old-API rollback. Preserve security columns and application volumes.
- Configuration/secrets changed: none; administrator password confirmation uses the existing password hash. No new provider or email credentials. Root development dependency override/lockfile pins shell-quote 1.11.0; production dependencies unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 325 API unit tests/47 files pass; quality/policy/script checks, workspace/browser types, API/web builds, migration integrity, six locale tests and two backlog tests pass. Seven real PostgreSQL tests and one real-account browser regression added. Dependency correction: clean installed shell-quote 1.11.0, both quoting regressions and production/complete advisory checks pass; the prior founder release stopped at advisories before application/infrastructure tests ran. Native Docker integration/browser/migration/recovery execution is unavailable in the authoring environment. Run npm run verify:release and add actual successful candidate commit/results and CI link before merging; tick integration/E2E only after success. Existing frontend bundle-size warning remains tracked under PER-005.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Explicit suspension/restoration confirmation, protected administrator states, password input cleared after attempts and a fresh-login explanation. Shell navigation labels cover English/French; detailed workflow localization and measured accessibility remain follow-ups. Logs retain existing correlation/redaction and security events; no claim of new production alerting or MFA.

## Follow-up work

IDN-011: privileged suspension/recovery, re-enrollment of organizations without an enrolled admin and permanent deactivation. IDN-012/018 and SAF-004: phishing-resistant privileged MFA and reviewed recovery. IDN-014 and OPS-006/010: operational notifications/alerts/retention. IDN-017: organization-admin member management. SEC-011: broader public endpoint abuse controls. PRD/OPS: explicit suspended-supplier listing moderation and affected-trade handling policy. PER-005/LNG-002: route performance and complete workflow accessibility/localization. Hosted staging/security review remains required before customer access.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: IDN-011 remains in progress pending native evidence and privileged/permanent lifecycle scope. SAF-001/IDN-013 reconciliation uses founder-reported merge confirmation; independent CI URL archival is not inferred. Full roadmap 71/342 complete (20.8%); core pilot 8/28 closed (28.6%), no partial credit or valuation inference.
