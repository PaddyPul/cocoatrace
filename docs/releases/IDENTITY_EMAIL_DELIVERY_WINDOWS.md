# Identity email delivery — Windows handoff

Branch: `feat/identity-email-delivery`
Bundle: `cocoatrace-identity-email-delivery.bundle`

## Validation and scope

API and web builds, 136 API unit tests (including an actual local SMTP socket
exchange), migration checksum verification and patch whitespace checks passed
in the authoring environment. Three PostgreSQL regressions have been added (30
total integration tests); they have NOT been executed in that environment,
which has neither Docker nor PostgreSQL. Run the Docker suite below before push.
Mailpit containers and browser journeys also require local verification.

This implements submission and manual recovery, not guaranteed inbox arrival.
Staging SMTP/domain setup and real inbox testing remain IDN-021 release gates.
No existing migration or baseline schema was changed. Migration 019 only adds
invitation submission status and attempt time; existing rows are `unknown`.

## 1. Apply without reintroducing old branch history

Open PowerShell in the repository. Run each command separately.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
```

Stop if tracked files are modified or a merge is pending. Your existing untracked
`docker-compose.real-flow.yml` files can remain; never use `git add .` here.

```powershell
git switch main
git pull --ff-only origin main
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-identity-email-delivery.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-identity-email-delivery.bundle" "HEAD:refs/remotes/bundle/identity-email-delivery"
git switch -c feat/identity-email-delivery
git cherry-pick 41b8fe0 bundle/identity-email-delivery
git status
git log -3 --oneline
```

The cherry-pick applies the backlog tracking commit and new implementation onto
your updated main, avoiding the divergent historical branch that caused the
last conflicts. If Git reports a conflict or the branch already exists, stop and
share the output. Do not overwrite either side or force reset.

## 2. Automated checks

```powershell
npm ci
npm run migrations:verify --workspace=api
npm run build --workspace=api
npm run build --workspace=web
npm run test --workspace=api
npm run test:integration:docker
```

Run one at a time. Expected: 136 API unit tests and 30 integration tests pass.
Stop on a failure. Do not seed/reset your application database to fix tests;
the Docker suite uses its own disposable database.

## 3. Start the app and local email inbox

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
Start-Process "http://localhost:8025"
```

Mailpit captures email locally. Nothing goes to a real mailbox. SMTP is internal
to Compose; the inbox is exposed only on localhost. Do not use this override in
staging/production. No `down -v`, database reset or fresh seed is needed.

If startup fails:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api mailpit --tail 80
```

Do not publish screenshots or logs containing security links.

## 4. Request access, verify, approve and create the admin

1. Sign out. Open `http://localhost:3000/request-access`.
2. Use an unused organization, e.g. `Email Pilot 20261001 A`, and unused address,
   e.g. `email-pilot-a@cocoatrace.test`. Choose supplier or buyer.
3. Submit. The UI should say submission to the provider, not guarantee delivery.
4. Open `http://localhost:8025`. Locate the verification message for that address.
   Follow its link. Prefer the email link over the demo shortcut for this test.
5. Reopen the same link: it must fail because it has been consumed.
6. Sign in as the LOCAL seeded platform admin: `admin@cocoatrace.io`,
   password `Password123!`. These are demo credentials only.
7. Open `http://localhost:3000/access-applications`, review the verified request,
   and approve it. A new invitation email must appear in Mailpit.
8. Sign out, follow that email link, enter your name and a strong password,
   create the account, and sign in. Complete onboarding.
9. Try the accepted link again: account creation must be rejected.

## 5. Team create, resend, expire, revoke and accept

1. As the new organization admin, open `http://localhost:3000/pilot`.
2. Invite a second unused address. Confirm an invitation email appears in Mailpit
   and the list shows `Email submission: sent` (SMTP acceptance).
3. Copy the link from that first email (A). Click Resend. Copy the newer link (B).
4. A must fail; B must open the acceptance page.
5. Revoke the invitation. B must now fail on acceptance. Resend must not be
   available on the revoked invitation and cannot reactivate it through the API.
6. Create an invitation for a third unused address; accept from its email. Sign
   in as that person and confirm the correct organization workspace.
7. If you encounter an already-expired invitation, Resend should renew it with
   a fresh link; the older link stays invalid. Automated tests cover token rotation.

## 6. Password reset and session revocation

1. Sign out and open `http://localhost:3000/forgot-password`.
2. Enter the email of the newly created active account.
3. Find the password-reset email in Mailpit. Follow its link and choose a new
   strong password. The old password must fail; the new one must sign in.
4. Reuse the reset link: it must fail. Request two resets; only the latest works.
5. Submit an unknown address. The UI/API response must be the same; no message
   should appear for that address. Raw reset links must not appear in API results.
6. Sign in to the same account in two DIFFERENT browsers (e.g. Chrome and Edge).
   Change the password at `/account/security` in Chrome. Chrome stays signed in;
   refreshing a protected page in Edge must require sign-in again.
7. Sign out and confirm protected pages require sign-in.

## 7. Failed email submission and safe recovery

Use the platform admin or organization admin session as appropriate. Save any
links needed for earlier tests before stopping the inbox.

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml stop mailpit
```

- Invite a fresh address from Pilot Team. The invitation should be saved with
  failed submission status; it must not claim that an email was delivered.
  Do not create the same invitation again: use Resend after recovery.
- Submit a fresh access request. Its application should remain pending and the
  UI should offer retry with the same details.
- If you approve a verified request during the outage, approval should remain
  saved. Use the Approved filter and Resend admin invitation after recovery.

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml start mailpit
```

Resend the failed invitation. Retry verification with identical application
details. Messages must appear; the invitation/application IDs must stay the same
and no extra organization/account should be created. A verification retry rotates
its link, so use the newest email. Resets use the generic response even during
failure; request a fresh reset after recovery.

## 8. Push only after the automated and manual checks pass

```powershell
git status
git -c http.version=HTTP/1.1 push --verbose --progress -u origin feat/identity-email-delivery
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/identity-email-delivery?expand=1"
```

Create the PR with base `main`. Suggested title: `Complete identity email
submission and invitation recovery`. State your automated/manual test results.
Wait for required GitHub checks to pass, then Merge pull request and confirm.
If GitHub reports conflicts, stop and share the output; do not force push.

## 9. Pull merged main and rebuild

Only after GitHub confirms the PR was merged:

```powershell
git switch main
git pull --ff-only origin main
git fetch --prune origin
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
```

Tracked files should be clean; your local override files may still be untracked.
Recheck sign-in and Pilot Team. To return to your previous local setup, recreate
using the base plus your `docker-compose.real-flow.yml` override. Do not delete
application data volumes.

## 10. Real inbox / staging release gate

Choose the email provider and sender domain before deployment. Configure
`IDENTITY_EMAIL_ENABLED=true`, `EMAIL_DRIVER=smtp`, `EMAIL_FROM`, `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, verified TLS and the staging HTTPS
`PUBLIC_WEB_URL`. Do not commit secrets or send them in chat. Base local Compose
hardcodes demo settings; a production/staging deployment must use its own config.

Verify sender DNS (SPF/DKIM/DMARC), then repeat the identity flows with owned real
inboxes and record receipt and failure/retry evidence. SMTP acceptance alone does
not close IDN-021. Durable outbox/retries, provider bounce monitoring, shared
rate limiting, policy acceptance and the remaining staging infrastructure are
still tracked release work.
