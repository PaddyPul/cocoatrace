# Trade currency foundation: full Windows handoff

Save cocoatrace-trade-currency-v1.bundle in Downloads. Start after the platform fee ledger wave has been merged and pulled. Keep Docker Desktop running. Preserve tracked changes; your untracked local Compose overrides may remain. Do not pop older formatting stashes, reset storage or stage unrelated files.

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
git fetch "$env:USERPROFILE\Downloads\cocoatrace-trade-currency-v1.bundle" "HEAD:refs/remotes/bundle/trade-currency-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/trade-currency-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop here." }
git cherry-pick bundle/trade-currency-v1
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop here and send the conflict output." }
```

## 3. Run the automated release gate

Dependencies are unchanged; npm ci is unnecessary when the previous merged version was installed.

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

This runs the currency API regressions and real GHS browser journeys alongside existing identity, payment, delivery and cancellation coverage. No long manual trade checklist is required. Native Docker/browser/image/recovery tests were not available to the author and remain mandatory before merge. If a check fails, send its actual terminal error and:

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

No new migration is needed. Briefly verify the app opens and your account signs in. Supply publication now offers EUR, USD, GHS and GBP; buyers submit offers in the listing currency. Automated tests cover the trade regression. Keep all database/evidence volumes.

## 5. Push and create the PR

```powershell
git status
git push -u origin feat/trade-currency-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/trade-currency-v1?expand=1"
```

PR title: **Preserve trade currency and calculate contract payments exactly**. Replace the default description with TRADE_CURRENCY_PR.md. After native release checks pass, mark database/API and E2E verification checked; leave staging unchecked unless independently tested. Wait for every required GitHub check to pass before merging into main.

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

Preserve financial/audit history. Zero/three-decimal currencies, FX, refunds and language support remain open. This bundle deliberately enables only four two-decimal currencies.
