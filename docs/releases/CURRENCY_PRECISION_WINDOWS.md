# Currency precision snapshots: full Windows handoff

Save cocoatrace-currency-precision-v1.bundle in Downloads. Start after the trade currency wave has been merged and pulled. Keep Docker Desktop running. Preserve tracked changes; your untracked local Compose overrides may remain. Do not pop older formatting stashes, reset storage or stage unrelated files.

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
git fetch "$env:USERPROFILE\Downloads\cocoatrace-currency-precision-v1.bundle" "HEAD:refs/remotes/bundle/currency-precision-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/currency-precision-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop here." }
git cherry-pick bundle/currency-precision-v1
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop here and send the conflict output." }
```

## 3. Run the automated release gate

Dependencies are unchanged; npm ci is unnecessary when the previous merged version was installed.

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

This runs the whole-yen API regressions and real GHS/JPY browser journeys alongside existing identity, payment, delivery and cancellation coverage. No long manual trade checklist is required. Native Docker/browser/image/recovery tests were not available to the author and remain mandatory before merge. If a check fails, send its actual terminal error and:

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

Startup applies additive migration 030, preserving all existing amounts with two-decimal snapshots. Briefly verify the app opens and your account signs in. Supply publication now offers JPY as well as EUR, USD, GHS and GBP. Automated checks cover the JPY payment/fee flow; no long manual checklist is needed. Keep all database/evidence volumes.

## 5. Push and create the PR

```powershell
git status
git push -u origin feat/currency-precision-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/currency-precision-v1?expand=1"
```

PR title: **Add snapshotted currency precision and whole-yen JPY trades**. Replace the default description with CURRENCY_PRECISION_PR.md. After native release checks pass, mark database/API and E2E verification checked; leave staging unchecked unless independently tested. Wait for every required GitHub check to pass before merging into main.

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

Preserve financial/audit history. Zero-decimal JPY is now supported for new trades. Existing records retain two-decimal meaning. Three-decimal currencies, FX, refunds and language support remain open; use forward corrections rather than dropping financial snapshots.
