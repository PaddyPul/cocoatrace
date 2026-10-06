# Privileged passkeys — apply, test, push, merge and pull

Download `bettertrade-privileged-passkeys-v1.bundle` into Downloads. Begin from main after the public-abuse PR is merged. Apply only its tip commit, because the author and founder histories differ. Leave local untracked Compose files and stashes untouched. No database reset/volume deletion is needed. Migration 033 runs on API startup. Use Node 24 and running Docker Desktop.

## 1. Apply to a fresh feature branch

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Cannot inspect working tree." }
if ($trackedChanges) { throw "Preserve/review tracked changes before continuing." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to main." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git switch -c feat/privileged-passkeys-v1
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop; do not recreate an existing branch." }
$passkeyBundle = "$env:USERPROFILE\Downloads\bettertrade-privileged-passkeys-v1.bundle"
if (-not (Test-Path $passkeyBundle)) { throw "Bundle missing from Downloads." }
git bundle verify $passkeyBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $passkeyBundle "HEAD:refs/remotes/bundle/privileged-passkeys-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
$passkeyTip = git rev-parse bundle/privileged-passkeys-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve bundle tip." }
git show --stat --oneline $passkeyTip
git cherry-pick $passkeyTip
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop and send git status; do not select all ours/theirs." }
git log -3 --oneline
git status
```

## 2. Install and run all automated checks

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog checks failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
```

This automatically runs API cryptography, policy and middleware checks, native PostgreSQL adversarial MFA cases, the Chromium virtual-authenticator customer journey, the existing trade/security suite, migrations, containers and restore. You do not need to manually repeat the long trade tests. The disposable browser app now uses `localhost` for WebAuthn; inbox and database remain separate loopback services. Never use `npm audit fix --force` to bypass a failed advisory gate.

## 3. Start with local privileged enforcement

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml logs api --tail 40
Start-Process "http://localhost:3000"
```

Do not use the IP address or temporary tunnel for this check. The new MFA override is tracked; your existing real-flow overrides are not added to this PR. Without this override, local never-enrolled accounts retain development behavior; staging/production always enforce MFA. Already-enrolled accounts are protected regardless of the local switch.

## 4. One short physical-authenticator check

Use your existing local platform administrator account used for access approvals. Do not create/reset production accounts or use demo passwords on hosted environments.

1. Sign in: enrollment must appear before the workspace. Enter the current password, label the key and select **Enroll passkey**. Complete the browser/OS biometric/PIN or compatible FIDO2 security-key prompt.
2. Account security → **Manage passkeys**: enroll a second key on another device where available. Keep a backup; the last key cannot be removed. Adding a backup asks for an existing-key verification as well as the current password.
3. Sign out, then sign in with the password: **Verify passkey and continue** must appear before workspace access. Complete it and enter the workspace.

Automation covers the adversarial branches. A real physical prompt is the one check a virtual browser cannot replace. If no supported authenticator is available, keep physical/hosted acceptance pending; do not disable production enforcement or claim pilot readiness. Reviewed lost-key recovery is documented in `docs/runbooks/PRIVILEGED_PASSKEYS.md`; do not test recovery on your only administrator account.

## 5. Push and open the PR

Run after the full release passes and review the hardware result:

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Cannot inspect working tree." }
if ($trackedChanges) { throw "Unexpected tracked changes; review before pushing." }
git push -u origin feat/privileged-passkeys-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/privileged-passkeys-v1?expand=1"
Get-Content ".\docs\releases\PRIVILEGED_PASSKEYS_V1_PR.md" -Raw
```

Base `main`, compare `feat/privileged-passkeys-v1`. Title: **Protect privileged accounts with passkeys, fresh action verification and reviewed recovery**.

Replace the default body with the description in `PRIVILEGED_PASSKEYS_V1_PR.md`. After your release is green, tick integration/E2E and record the tested SHA/report and CI URL. Record the hardware result separately; keep staging unchecked until hosted verification happens. Leave broader privileged recovery/notifications/access review items partial.

Wait for required GitHub checks to pass, review, select **Merge pull request**, then **Confirm merge**. Do not merge a failing gate. Do not force-push or manually push directly to main.

## 6. Pull merged main and restart

Only after GitHub confirms merge:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to main." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml ps
Start-Process "http://localhost:3000"
```

Keep enrolled keys and backups: a clean Git tree does not reset authenticator registration. Report the successful release, hardware check and merge acknowledgement so evidence can be updated. Do not drop MFA tables or disable deployment enforcement for rollback; use a forward correction.
