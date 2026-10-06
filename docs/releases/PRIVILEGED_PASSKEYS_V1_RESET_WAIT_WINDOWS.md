# Passkey password-reset completion correction — Windows

Apply this after the supplier permission-probe correction. The browser journey now waits for sign-out completion, the reset email screen, HTTP 204 from password reset, and the Password updated screen before navigating to login. No runtime authorization, password policy, dependency or migration changes.

## 1. Apply to the existing, unmerged feature branch

Download bettertrade-privileged-passkeys-v1-reset-wait.bundle to Downloads. Run each block in PowerShell; stop on any error. Preserve local Compose overrides and stashes.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch feat/privileged-passkeys-v1
if ($LASTEXITCODE -ne 0) { throw "Branch switch failed." }
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before applying." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-privileged-passkeys-v1-reset-wait.bundle" "HEAD:refs/remotes/bundle/privileged-passkeys-reset-wait"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/privileged-passkeys-reset-wait
if ($LASTEXITCODE -ne 0) { throw "Correction did not apply cleanly. Stop and send the output." }
git log -2 --oneline
git status
```

If the original passkey PR has already been merged, start from updated main and create a fresh correction branch instead; do not reuse this unmerged-branch block blindly.

## 2. Automated verification

```powershell
npm run test:browser:docker
if ($LASTEXITCODE -ne 0) { throw "Browser tests failed. Stop and send the failing test." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first failing gate." }
git status
```

The full release run covers the new database regression as well as browser journeys. This correction needs no dependency installation or database reset. Author browser/API type checks and quality checks passed; Docker-backed tests must pass on your PC. Never replace a failed gate with a skipped check.

## 3. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Use localhost consistently for passkeys. The virtual browser tests are automated; physical device acceptance remains the short check in PRIVILEGED_PASSKEYS_V1_WINDOWS.md. Do not reset volumes or reseed customer data.

## 4. Push and update the existing PR

```powershell
git push -u origin feat/privileged-passkeys-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/privileged-passkeys-v1?expand=1"
```

Use the title and complete description in PRIVILEGED_PASSKEYS_V1_PR.md. Update the existing PR if one exists. Tick database/browser verification only after the release run passes and record its commit SHA. Wait for all required GitHub checks, then merge the PR. Do not force-push.

## 5. Pull merged main and restart

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main pull failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Merged application startup failed." }
Start-Process "http://localhost:3000"
```
