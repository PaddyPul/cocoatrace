# Platform fee ledger: full Windows handoff

Save cocoatrace-platform-fee-ledger-v1.bundle in Downloads. Start after the cancellation wave has been merged and pulled. Keep Docker Desktop running. Preserve tracked changes; your untracked local Compose overrides may remain. Do not pop older formatting stashes, reset storage or stage unrelated files.

## 1. Synchronize main

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
```

Continue only without tracked modifications.

## 2. Apply only the bundle tip

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-platform-fee-ledger-v1.bundle" "HEAD:refs/remotes/bundle/platform-fee-ledger-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/platform-fee-ledger-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop here." }
git cherry-pick bundle/platform-fee-ledger-v1
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop here and send the conflict output." }
```

## 3. Run the automated release gate

Dependencies are unchanged; npm ci is unnecessary when the previous merged version was installed.

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

This runs the new fee API/concurrency tests and real browser journey alongside existing identity, payment, delivery and cancellation coverage. No long manual trade checklist is required. Native Docker/browser/image/recovery tests were not available to the author and remain mandatory before merge. If a check fails, send its actual terminal error and:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
```

## 4. Start the application

After the release gate passes:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Startup applies migration 029. Briefly verify the app opens and your account signs in. Sellers see fee statements in the deal room and Platform fees; the platform-admin account can review receipts and export reconciliation there. Only completed, nonzero fees can be submitted. No automatic debit, money transfer or invoice email occurs. External payment instructions and tax treatment still need commercial configuration. Keep all database/evidence volumes.

## 5. Push and create the PR

```powershell
git status
git push -u origin feat/platform-fee-ledger-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/platform-fee-ledger-v1?expand=1"
```

PR title: **Add platform fee statements, verified collection and finance reconciliation**. Replace the default description with PLATFORM_FEE_LEDGER_PR.md. After native release checks pass, mark database/API and E2E verification checked; leave staging unchecked unless independently tested. Wait for every required GitHub check to pass before merging into main.

## 6. Pull the merged version and restart

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
git status
```

Preserve financial/audit history and use forward corrections after collecting fees. Keep downloaded finance JSON private and out of git. Official tax invoices/emails, real bank reconciliation and refunds remain open backlog work.
