# Authentication boundary browser correction — Windows handoff

Use this correction on your existing `feat/browser-auth-boundary-v1` branch. Your native run passed 191 integration tests and every gate before browser journeys. Browser email lookups inherited the app Origin header, which Mailpit rejects on its separate origin. This correction uses a dedicated inbox client with its own Origin and no application cookies/Authorization, preserves the app security policy, and reports inbox HTTP errors immediately. Three transport regressions are now an early release gate. No new database migration or dependency change.

## 1. Apply the correction

Download `bettertrade-auth-boundary-browser-fix.bundle` into Downloads. Run in PowerShell:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Preserve/review tracked changes before continuing." }
git switch feat/browser-auth-boundary-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to the existing security branch. Stop." }
$fixBundle = "$env:USERPROFILE\Downloads\bettertrade-auth-boundary-browser-fix.bundle"
if (-not (Test-Path $fixBundle)) { throw "Correction bundle missing from Downloads." }
git bundle verify $fixBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $fixBundle "HEAD:refs/remotes/bundle/auth-boundary-browser-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
$fixTip = git rev-parse bundle/auth-boundary-browser-fix
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve correction tip." }
git show --stat --oneline $fixTip
git cherry-pick $fixTip
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and send git status." }
git log -3 --oneline
git status
```

Cherry-pick only the bundle tip. Do not merge its full history, replay the original auth bundle, reset the branch or delete volumes. Leave your two untracked local Compose files and any existing stash alone. If this correction is already applied, stop rather than cherry-picking twice.

## 2. Run the fast regression, then the release

Docker Desktop must be running for the full release. No long manual identity/trade checklist is required.

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
node --import tsx --test scripts/inbox-isolation.test.mjs
if ($LASTEXITCODE -ne 0) { throw "Inbox regression failed. Stop." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release failed. Stop before pushing or merging; send the first specific failure." }
Get-Content ".\release-test-results\summary.json" -Raw
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog tests failed." }
git status
```

Expected: three inbox regressions pass, and all release checks pass including browser journeys AND backup/restore. The previous report does not cover the corrected commit. The release already runs the full browser suite; no separate repeated manual test is needed.

If a gate fails, collect these sanitized results:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
if (Test-Path ".\browser-test-results\safe\summary.json") {
  Get-Content ".\browser-test-results\safe\summary.json" -Raw
}
git status
```

Keep the first failing console message. Do not share credentials, invitation links, .env files or private traces. Do not loosen origins, disable rate limits or add Mailpit wildcard CORS to make this pass.

## 3. Start the application

After the release passes:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 40
Start-Process "http://localhost:3000"
```

The original additive migration 031 remains part of this branch; normal API startup applies it. This correction changes only test support and documentation, so no new manual product checks are required.

## 4. Push and create/update the PR

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Unexpected tracked changes; review before pushing." }
git push -u origin feat/browser-auth-boundary-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/browser-auth-boundary-v1?expand=1"
```

If the PR already exists, update that PR. Base: main. Compare: feat/browser-auth-boundary-v1. Exact title and filled description: `docs/releases/AUTH_BOUNDARY_V1_PR.md`. Copy the description beneath its PR description heading; replace the final verification evidence with your corrected commit and actual successful release/CI result, then tick E2E only after it passes. Staging remains unchecked unless actually verified.

Wait for every required GitHub check to pass, resolve review comments, then select **Merge pull request** and confirm. Do not merge a failed release or bypass required checks.

## 5. Pull the merged code and restart

Only after GitHub confirms the PR merged:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch to main failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Merged application startup failed." }
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Backlog register invalid." }
```

Do not use `down -v` on the application project. The automated test runner cleans up only its disposable fixtures. Broader security backlog items remain in progress until their complete acceptance criteria and native evidence are met; this repair does not itself authorize a real-customer pilot.
