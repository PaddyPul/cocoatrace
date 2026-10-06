# Privileged passkeys and reviewed recovery

## Boundary

Staging and production enforce MFA for platform administrators, organization/member administrators, certifiers and regulators, including custom roles with equivalent privileged permissions. `MFA_ENFORCED=false` is rejected in those environments. Local development/test enforcement is opt-in; once any account enrolls, its key history protects it in every environment, including after recovery revokes its keys. There is no production/test bypass endpoint.

After password sign-in, a restricted session can read `/me`, manage its own passkey ceremonies, or sign out. It cannot enter the workspace until enrollment or an existing passkey assertion succeeds. `/auth/password/forgot` and `/auth/password/reset` remain public, but reset never clears keys or marks a session MFA-verified. Protected API writes require a verification younger than five minutes. The browser requests a new assertion and retries a rejected write once. Cancellation/denial preserves the action; it is not submitted without assurance.

Registration requires the current password. Adding a key also requires a fresh assertion from an existing key. Removing a key requires verification with a different key, preserves at least one key, revokes all other sessions, and deletes pending ceremonies. Credential keys are public keys; private keys/PINs/biometric templates remain with authenticators. No authenticator attestation or hardware provenance is claimed.

Challenges are random, server-stored, bound to user/session/purpose, rotated per session and expire after five minutes. Consumption commits after cryptographic rejection, preventing replay. Identity/session/key locks serialize ceremonies and recovery. Registration and assertions validate exact configured WEB_URL origin, RP hostname, challenge, signature and user-verification flag through pinned SimpleWebAuthn. Sensitive administrative approval, suspension and invitation creation additionally recheck live assurance under transaction locks. Successful mutations/audits commit together; failed verification creates a security event. No raw challenge/signature/token is included in audit metadata.

## Origins and enrollment

Use a stable HTTPS DNS hostname for staging/production. `WEB_URL` must be the actual browser origin, including port, and agree with ingress/CORS. The RP ID is its hostname; it is never read from Host/forwarded headers. For local checks use `http://localhost:3000`. Chromium rejects an IP-address RP ID, so disposable browser tests now use `localhost`; database and capture-inbox connections stay separately loopback-bound. Changing hostname can make enrolled credentials unusable; review a domain move as a credential migration, not a cosmetic rebrand.

Before exposing real data, review the administrator list, remove/rotate demo/bootstrap credentials, enroll the first administrator behind restricted ingress, and establish two independent platform reviewers with separate backup keys. First enrollment uses the verified account/invitation plus current password; it is a bootstrap trust decision, not proof of hardware identity. Never expose an unclaimed bootstrap admin account publicly. Synthetic temporary tunnel previews are not a stable passkey deployment.

Account security → Manage passkeys shows enrollment, verification, backup and removal. The browser/OS prompts for a local PIN/biometric or compatible security key. Enroll a second authenticator on another device and keep it safe. A synced passkey may survive device loss, but the platform cannot guarantee the provider's recovery or backup policy.

## Lost every key

There is intentionally no email-only or self-service disable-MFA route. Support must independently verify the account owner through previously established organizational contacts, review compromise/suspension, and record a non-personal case ID. Two distinct platform administrators must sign in and freshly verify their own passkeys. Neither may be the target account. The server-side recovery function rechecks live reviewer privileges, active identity, current sessions and keys under locks; two strings naming administrators are insufficient.

A restricted server-console operator runs `api/scripts/approve-mfa-recovery.ts` with JSON on **stdin**, containing `targetUserId`, `ticket`, and `reviewerTokens` (two current session bearer tokens). Obtain those tokens only through the administrators' own authenticated sign-in response in a controlled handoff; the existing HttpOnly browser session has the same token. Never paste tokens into chat, PRs, logs, shell command arguments or committed files. Do not create a public recovery API. Runtime invocation is `node --import tsx api/scripts/approve-mfa-recovery.ts`; secure stdin delivery is an operator responsibility.

Approval atomically revokes all target keys and sessions, consumes existing password-reset links, clears ceremonies, and records both reviewer IDs/case ID. It grants a **30-minute enrollment window**, not workspace access or a new password. Existing access suspension/deactivation is unchanged. The verified owner signs in using their password (or performs a separately verified password reset) and enrolls a replacement key. Successful registration consumes the window; expired approval requires another review. Enroll a backup immediately.

If two valid independent reviewers are unavailable, recovery fails closed. Emergency platform bootstrap recovery and privileged suspension/deactivation need a separately reviewed operational procedure; do not change rows ad hoc to bypass this gate. Out-of-band factor-change/recovery notifications, hosted recovery rehearsal and periodic privileged-access review remain explicit backlog work. The ticket must document owner verification and independent reviewer consent; the application checks accounts, not whether two accounts represent different humans.

## Verification and operations

`npm run verify:release` includes policy/cryptographic/middleware tests, new PostgreSQL adversarial cases and a Chromium virtual-authenticator journey. Tests cover wrong origin/RP/UV, replay/concurrency, expiry, session/account binding, password reset, fresh write gates, suspension, ownership, last-key removal and reviewed recovery. They do not replace a physical-key check or hosted ingress verification.

Migration 033 adds passkeys, per-session challenges, assurance columns and an expiring recovery approval column. It does not erase records, alter quantities or rewrite frozen migrations. Apply before API traffic; existing sessions begin without MFA assurance. Do not roll back by disabling enforcement/dropping credentials; use a reviewed forward correction. Monitor `MFA_REQUIRED`, `MFA_STEP_UP_REQUIRED`, rejected ceremonies and unexpected enrollments/recovery audit events. Automated alerting/retention/notifications remain IDN-014/018 operations acceptance work.

Sources reviewed 2026-10-06: [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server), [user-verification guidance](https://simplewebauthn.dev/docs/advanced/passkeys), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [WebAuthn RP identifier](https://www.w3.org/TR/webauthn/#relying-party-identifier).
