# Local investor rehearsal and captured email outbox

Deployment is on hold. No Oracle resources, trial credits, paid AI calls, domain purchase or external SMTP provider are used by this mode. This is synthetic demonstration data on the founder's Windows PC.

## Start and stop

After installing this candidate and passing its exact-commit full release, start Docker Desktop and run `npm run demo:rehearsal:start` from the repository root. It uses the existing dedicated cocoatrace-demo-preview project, independent database/evidence volumes and secrets, real ClamAV, plus the local rehearsal overlay. First startup downloads images/signatures and builds the app. It stops any old sharing tunnel and configures the application for the one canonical origin http://localhost:14000. Do not alternate localhost and127.0.0.1 for sessions/passkeys.

- Application: http://localhost:14000
- Captured app outbox: http://127.0.0.1:18026
- Synthetic buyer: newbuyer@cocoatrace.io
- Synthetic supplier: newsupplier@cocoatrace.io
- Seeded demo administrator: admin@cocoatrace.io
- Synthetic demo password: Password123!

Use separate browser profiles for buyer, supplier and administrator so cookies do not replace another persona's session. The outbox is Mailpit's capture viewer, not a real BetterTrade mailbox or proof of external delivery. Opening a message there displays decoded HTML, plain text and headers. Links refer to this PC. An external investor cannot use a localhost link from another computer.

The SMTP listener is available only inside Docker; the capture viewer binds only to127.0.0.1. SMTP goes to the local capture service; no relay or provider credentials are configured. The displayed sender is BetterTrade <demo@bettertrade.test>, a test-only address, not an owned authenticated sender domain. Never expose the outbox through a tunnel: messages contain live local action credentials. Do not upload screenshots or raw messages containing tokens.

The runner generates an independent invitation-delivery encryption key in ignored preview state. Keep .demo-preview/environment.json with its volumes. Start preserves existing records; stop preserves data. Mailpit capture is ephemeral when its container is removed. `npm run demo:preview:stop` stops this project and tunnel. Ordinary demo:preview:start/share retain their original email-disabled configuration; this rehearsal does not authorize sharing.

## 1. Email and identity rehearsal

1. Open the local app and capture viewer. From the app's request-access flow, submit a synthetic new organization and email address such as rehearsal-owner@example.test. It need not be a real mailbox.
2. Open its verification message in Mailpit. Check BetterTrade sender name, subject, organization context, test-environment label, readable mobile/desktop layout, action button and visible localhost:14000 destination. The plain-text tab retains the usable URL.
3. Follow verification in the same canonical app origin. Use the demo administrator to approve the organization through the normal review UI. Open the resulting first-admin invitation in the capture viewer and complete enrollment.
4. Invite a synthetic teammate. Resend, confirm the old link is unavailable, revoke a replacement and confirm revocation still applies. Create a fresh invitation if joining is needed. Do not alter tokens in the database.
5. Request a password reset, open the captured message, set a new password and confirm the consumed link cannot be reused. This acts only on synthetic accounts.
6. Where an account is actually required to use a passkey, enroll/use it through the normal security flow. If enrollment or a fresh privileged action fails, record the browser/origin/action and stop that demonstration step; do not disable enforcement or edit database privileges.

## 2. Main trade story

Prepare a single synthetic commodity, currency and Incoterm arrangement and record them before presenting. Use only disposable clean test PDF/image documents. Do not use genuine personal or commercial documents or actual funds.

| Step | Persona | Evidence to check |
| --- | --- | --- |
| Publish supply | Supplier | Create conventional inventory or a genuine source/farm/plot/harvest chain; saleable quantity is coherent and supply is visible. |
| Source and offer | Buyer | Save requirements, inspect matching supply, send an offer; dashboard shows the next permitted action. |
| Accept and agree | Supplier then buyer | Accept the offer, acknowledge the base agreement and agree a supported payment plan. Inventory reservations and currency remain consistent. |
| Record deposit | Buyer then supplier | Submit synthetic external-payment proof; supplier verifies receipt. Submission alone must not unlock a receipt gate. |
| Required fee action | Appropriate party/admin | Follow the actual fee state and fresh privileged action where required; do not manually override eligibility for the demo. |
| Dispatch and documents | Assigned party | Required terms, payment, fee, clean evidence and arrangement information are satisfied before dispatch/release. |
| Delivery and closeout | Assigned party, buyer, supplier | Progress actual supported milestones, buyer inspection/acceptance, final payment submission/receipt verification and the correct completion/fee state. |

Explain that BetterTrade records and controls workflow; it does not transfer funds, provide escrow or independently verify bank execution. Review payment/fee messages if queued; not every trade event currently sends an email (PRD-008). Reading a notice does not acknowledge a recall or verify payment.

## 3. Separate recall story and failures

Prepare a separate affected synthetic batch with held/traceable stock and relevant parties. Investigate trace, activate a recall with its acknowledgement deadline, confirm affected stock cannot be offered or dispatched, review participant notices and record acknowledgement/recovery through the actual UI. Capture unresolved quantities honestly. Do not force resolution without the required clean evidence and response accounting; a closed recall does not automatically republish retained stock.

Exercise one validation failure, a retryable service failure where the existing test harness supports it, and an unrelated-party denial. Confirm entered data is retained and failed reads are not presented as successful empty records. Do not sabotage a real running database to simulate a failure.

## 4. Founder rehearsal record

Run the story with a second distinct set of synthetic records to check repeatability; this is not proof of a fresh-reset replay. Record candidate SHA, browser, widths, actors/roles (no passwords), steps passed, exact blockers and backlog IDs. No successful manual rehearsal is claimed by this document. INV-002/003 stay in progress until actual founder execution; universal accessibility and clean-reset acceptance remain open. Use a short five-minute prepared walkthrough for investors after the complete rehearsal works, with a separate recall scenario and an honest recorded fallback.

## Future real sending

Sending and receiving are separate services. An SMTP relay submits outgoing email; a hosted mailbox receives replies. Neither is needed for local capture. For actual branded investor emails, select an owned sender domain, provider-approved From address and real support/reply address, authenticate using the provider's exact DNS records, and verify received headers/inbox rendering. Do not pretend to send from an unowned BetterTrade domain. Gmail/free-mail domains cannot be authenticated as your own domain through a third-party sender. Provider-shared test senders are testing identities, not BetterTrade domain ownership. Public clickable app links also require a reachable approved HTTPS deployment, which remains on hold.

## Corrected local origin and explicit fresh start (2026-10-23)

Use http://localhost:14000 for every persona and new email action. The app still binds only to127.0.0.1 at Docker level; that is network isolation, not the browser passkey domain. Restart with demo:rehearsal:start to update the saved legacy origin without deleting records. Sign in again at localhost. Old127.0.0.1 links/sessions belong to the former origin; generate fresh invitations/reset messages rather than follow old captured messages. Never disable MFA, loosen expected-origin checks or use browser security bypass flags.

Shared demo login buttons reuse the same accounts. Restarting setup changes onboarding only; previous trades are deliberately retained. To deliberately return the dedicated local rehearsal to first-use state, run:

```powershell
npm run demo:rehearsal:reset -- DELETE_SYNTHETIC_PREVIEW
```

This deletes the dedicated preview's synthetic database, private evidence, captured email container and scanner volumes, including users, custom records, trades and passkeys. It recreates the original seed plus fresh operational prune, so default synthetic identities return without inherited trades. Enroll the administrator's passkey again after reset. It never targets the ordinary application/test Compose projects. Do not use reset if you want to keep any current rehearsal records; use start instead.

Deletion requires the exact confirmation, the fixed preview project/Compose files and a read-only database check proving the dedicated marked synthetic target. A failed preflight does not remove volumes. The runner retains its generated connection secrets for the newly initialized volumes. No reset occurs on login, normal start or pull. CI runs the confirmed reset before checking empty buyer/supplier trade actions and real virtual-authenticator administrator enrollment/re-login/fresh assurance on localhost. Physical Windows Hello/security-key acceptance and an actual fee receipt remain founder rehearsal evidence.
