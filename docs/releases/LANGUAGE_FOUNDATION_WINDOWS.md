# Language foundation: full Windows handoff

Save cocoatrace-language-foundation-v1.bundle in Downloads. Start after the currency precision wave has been merged and pulled. Keep Docker Desktop running. Preserve tracked changes; your untracked local Compose overrides may remain. Do not pop older formatting stashes, reset storage or stage unrelated files.

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
git fetch "$env:USERPROFILE\Downloads\cocoatrace-language-foundation-v1.bundle" "HEAD:refs/remotes/bundle/language-foundation-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/language-foundation-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop here." }
git cherry-pick bundle/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop here and send the conflict output." }
```

## 3. Run the automated release gate

Dependencies are unchanged; npm ci is unnecessary when the previous merged version was installed.

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

This runs the six new language unit tests and three real-identity language browser regressions alongside all existing trade, identity, payment, delivery and cancellation coverage. No long manual trade checklist is required. Native Docker/browser/image/recovery tests were not available to the author and remain mandatory before merge. If a check fails, send its actual terminal error and:

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

No database migration is introduced. Sign in and briefly check the header Language selector is visible. French currently covers navigation and search; trade forms remain English. Automated checks cover preference persistence/account separation. Keep all database/evidence volumes.

## 5. Push and create the PR

```powershell
git status
git push -u origin feat/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/language-foundation-v1?expand=1"
```

PR title: **Add English/French workspace navigation and account-separated language preferences**. Replace the default description with LANGUAGE_FOUNDATION_PR.md. After native release checks pass, mark database/API and E2E verification checked; leave staging unchecked unless independently tested. Wait for every required GitHub check to pass before merging into main.

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

Keep local Compose overrides, formatting stashes and database/evidence volumes. Full trade translations, cross-device language preferences and localized recipient emails remain open in the backlog.
