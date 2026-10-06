# PR title

Add reviewed privileged suspension, restoration and user deactivation

# PR description

## Outcome

An operator can contain a compromised privileged user or organization without bypassing passkeys or wiping trade records. Two distinct freshly passkey-verified platform administrators must approve the console decision. Disabling access revokes sessions and pending recovery/invitation paths; restoration never revives old sessions. User deactivation also revokes keys and cannot be reversed by suspension restoration or password/passkey recovery.

## Tracking

- Backlog ID(s): IDN-011; contributes SAF-004, IDN-018 and CORE-privilege.
- Issue/ADR: docs/runbooks/PRIVILEGED_ACCESS_LIFECYCLE.md; docs/pilot-gates.json.
- Target phase/environment: pre-pilot security boundary, local automated rehearsal; hosted operator acceptance pending.

## Change summary

- Add strict console-only user/organization suspension/restoration and user deactivation; no new public mutation route.
- Reuse independent reviewer validation across lifecycle and passkey recovery, rechecking live identity, permission, session and key assurance inside the transaction.
- Serialize access/recovery decisions before identity locks, preserve two usable administrators, prohibit affected reviewers and commit mutations/revocations/audit/security events together.
- Preserve keys for suspension, revoke them for deactivation, invalidate pending reset links/ceremonies/recovery windows and applicable invitations, and reject recovery approval for deactivated users.
- Keep normal HTTP protected-account denial; explain the operator procedure in the UI. Add unit and real-PostgreSQL adversarial/concurrency regressions and record the founder's preceding passkey merge acknowledgement.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: console secrets use bounded stdin and generic errors, never command arguments or audit metadata. Success records both reviewer identities and ticket. Normal HTTP users cannot waive the independent review. Two enrolled accounts are not proof of two independent humans/devices; operational onboarding must establish that. Notifications/alerts remain follow-up work; no outbox delivery is claimed.

## Database and deployment

- Migration required: no; uses existing identity/session/passkey/audit tables and preserves frozen migration integrity.
- Backfill/lock implications: no backfill. One transaction-scoped advisory lock serializes low-volume access/recovery decisions, followed by ordered organization/user locks and reviewer session/key locks. This does not serialize ordinary trades.
- Rollback or compensation: failed decisions roll back atomically. Temporary holds can be restored through the same review without reviving sessions. Deactivation has no automated reactivation; handle mistakes through an independently reviewed forward correction, never deletion of commercial history.
- Configuration/secrets changed: none. Operator console authorization and independent fresh reviewer sessions are required; mandatory deployed MFA is unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 396 API unit tests, workspace/browser types, quality/script checks, migration integrity and backlog checks pass. Twelve new PostgreSQL cases cover signed enrollment, stale/revoked/future assurance, reviewer separation, suspension/restoration, deactivation, crossing concurrent approvals, retries, session issuance, audit rollback, recovery refusal and HTTP bypass protection. Native Docker/browser/restore acceptance requires npm run verify:release on the founder PC and CI. Update the unchecked native verification entries only after passing, and append the tested SHA/report/CI URL. Existing web bundle-size warning remains performance debt.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: operations stay console-only; ordinary access UI gets an explanatory paragraph. Hosted console access, independent operator identities, notifications and an actual incident/recovery drill remain unverified.

## Follow-up work

- IDN-018/SAF-004: emergency bootstrap when independent reviewers are unavailable; physical/hosted factor and owner-verification rehearsal.
- IDN-014: real factor/access-change alerts, notifications and retention policy.
- IDN-019/GOV-002/OPS-007: actual privileged-account review, named operators, least-privilege console access and incident drill.
- PRD-006/PRD-011: shared next-action decision engine after this security slice.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Implementation is tracked without claiming native/hosted acceptance or pilot readiness. Founder passkey merge acknowledgement is recorded separately from independently archived release evidence.
