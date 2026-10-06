# PR title

Protect privileged accounts with passkeys, fresh action verification and reviewed recovery

# PR description

## Outcome

A stolen password alone cannot enter an enrolled or deployed privileged workspace. Passkeys require local PIN/biometric verification; privileged writes require fresh verification. Password reset keeps existing keys. Losing every key requires two independently verified platform accounts and a restricted console recovery review.

## Tracking

- Backlog IDs: SAF-004, IDN-012, IDN-018; contributes IDN-014 and CORE-privilege.
- Issue/ADR: docs/runbooks/PRIVILEGED_PASSKEYS.md; docs/pilot-gates.json.
- Target phase/environment: pilot security boundary; local enforcement rehearsal, mandatory staging/production.

## Change summary

- Add account enrollment, backup/removal, restricted sign-in and fresh write verification using pinned SimpleWebAuthn, exact configured origin/RP and required user verification.
- Store session-bound, single-consumption expiring challenges and live session/key assurance; serialize credential changes, counter updates, audits and recovery.
- Preserve keys through password reset, reject last/current-key removal, revoke other sessions on key removal and all sessions/keys on reviewed recovery.
- Add two-reviewer console recovery with a consumed 30-minute replacement enrollment window; no email-only recovery bypass or suspension restoration.
- Recheck live administrative mutation assurance under transaction locks; add automated adversarial PostgreSQL and virtual-authenticator browser tests. Change disposable app origin to localhost for valid WebAuthn; keep inbox/database isolation.

- Correct the supplier browser probe to use holdings, assert MFA_REQUIRED on restricted sessions, and verify organization administration stays forbidden after signed verification. Add a PostgreSQL regression separating MFA assurance from role authorization.

- Wait for successful password-reset HTTP/UI completion before signing in with the changed password; preserve real passkey and role-boundary assertions.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: keys are public keys, not private keys/PINs/biometrics. Session/key revocation and failed ceremonies are checked server-side. Recovery tokens enter console stdin, never command arguments. There is no hardware-attestation claim. First enrollment is a reviewed bootstrap trust decision; restrict bootstrap ingress. Out-of-band notifications and alert operations remain follow-up work.

## Database and deployment

- Migration required: yes — 033_privileged_passkeys.ts, registered with integrity hash; frozen baseline unchanged.
- Backfill/lock implications: no destructive backfill; existing sessions start without assurance. Short organization/user/session/key locks serialize sensitive changes.
- Rollback or compensation: forward correction; do not drop credentials or disable enforcement.
- Configuration/secrets changed: MFA_ENFORCED defaults true and cannot be disabled in staging/production; tracked local MFA override. Exact stable WEB_URL controls origin/RP. No new signing secret. Domain moves require credential migration planning.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author quality checks (10), 381 API unit tests (52 files), workspace/browser types, API/web builds, migration integrity, backlog checks (2) and production/full dependency advisories pass; real Chromium virtual-authenticator registration verified. Native Docker PostgreSQL/customer-browser/container/restore suite requires the attached Windows release instructions. Update these two unchecked native entries only after verify:release is green; add tested SHA/report/CI URL and physical-key result before merging. Hosted staging has not been claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: labeled controls and status/errors added; dedicated accessibility/device matrix and hosted operational verification remain pending.

## Follow-up work

- IDN-018/014: independent owner-verification/recovery rehearsal, factor-change/recovery notifications, security alerts and retention.
- IDN-011: separate privileged suspension/permanent deactivation and emergency bootstrap recovery procedure.
- IDN-019/SAF-004: actual privileged-account review, independent backup reviewers and stable hosted domain/physical-authenticator acceptance.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

Native/hosted acceptance and merge evidence remain pending. This PR does not certify pilot readiness or the valuation target.
