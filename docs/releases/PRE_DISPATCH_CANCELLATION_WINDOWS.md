# Unstarted cancellation: full Windows handoff

Download cocoatrace-pre-dispatch-cancellation-v1.bundle to Downloads. Start after the payment-term workflow has been merged/pulled. Keep Docker Desktop running. Preserve tracked changes first; your two untracked local Compose overrides can remain. Do not pop older stashes, reset volumes, seed over existing data or stage unrelated files.

## 1. Synchronize and apply

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed. Stop here." }
git status
```

Proceed only with no tracked modifications. Apply just the bundle tip on your main history:

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-pre-dispatch-cancellation-v1.bundle" "HEAD:refs/remotes/bundle/pre-dispatch-cancellation-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/pre-dispatch-cancellation-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop here." }
git cherry-pick bundle/pre-dispatch-cancellation-v1
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop here and send the conflict output." }
```

## 2. Automated verification

No dependency changes; a new install is unnecessary if the preceding merged version was installed. Run the complete gate, which includes the new PostgreSQL and browser cancellation tests:

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

On failure send the failing check's terminal output and:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
```

Do not push/merge past a failed gate. The native races and browser journey were not run in the author's environment. This automated suite replaces a long manual trade checklist.

## 3. Start the application

After release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Startup applies migration 028. Briefly confirm the app opens and your existing account can sign in. Cancellation is in the guided deal room/contract detail. Only unstarted trades qualify; the other organization must approve. The automated browser test covers the actual workflow. Preserve local data and all evidence.

## 4. Push and create the PR

```powershell
git status
git push -u origin feat/pre-dispatch-cancellation-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/pre-dispatch-cancellation-v1?expand=1"
```

Use title **Add bilateral cancellation for unstarted trades with protected stock release** and replace the template with the description in PRE_DISPATCH_CANCELLATION_PR.md. After verify:release passes, check its database/API and E2E boxes; leave staging unchecked unless independently verified. Wait for every required GitHub check to pass, then merge the PR into main.

## 5. Pull the merged code and restart

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
git status
```

Do not drop cancellation history or roll back to an image lacking closed-trade guards after using this flow. Paid cancellations, refunds, partial settlements and returns remain separate work.
