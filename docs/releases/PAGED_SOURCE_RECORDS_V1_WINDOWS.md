# Paged source records v1 — full Windows instructions

This wave adds server-paged farm/batch lists, owner-scoped harvest farm selection, a paged certificate farm selector, scoped farm batch history and full source aggregates. Farm and batch list pages move out of the large DataPages module. No schema, dependency, configuration change or data reset is required. Previous transfer release acceptance is recorded.

Run each block in PowerShell, in order. Do not continue after a failed command. Your local untracked Compose overrides, logs and saved stashes stay untouched.

## 1. Download and update main

Download `bettertrade-paged-source-records-v1.bundle` into Downloads.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before switching branches." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main pull failed." }
git switch -c feat/paged-source-records-v1
if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Do not overwrite an existing branch." }
```

## 2. Apply the new feature commit

```powershell
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-paged-source-records-v1.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-paged-source-records-v1.bundle" "HEAD:refs/remotes/bundle/paged-source-records-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/paged-source-records-v1
if ($LASTEXITCODE -ne 0) { throw "Bundle application failed. Stop and send the conflict/output." }
git log -2 --oneline
git status
```

The newest message should be `feat: page source records and preserve farm selection`. Cherry-pick only the tip; do not merge the bundle's author history or reapply earlier security work. Your GitHub merge history can differ from the bundle history.

## 3. Run automated acceptance

Keep Docker Desktop running. Use the supported Node version (Node 24 for the existing local rehearsal).

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
git status
```

The release runs new source-record units, five native `sourceRecordsPagination.integration.test.ts` cases using 1,005 farms and 1,005 batches, plus `sourceRecordPages.spec.ts` paging/selection/error tests and existing real source-entry journeys. The home fixture now explicitly provides farm totals. No long manual checklist is required.

Author-side Docker is unavailable. Author unit/build/type/quality checks do not substitute for your native release gate. A green report must match the exact candidate commit. If npm changes tracked files, inspect those changes before committing; never add local Compose overrides or reports containing credentials.

## 4. Start the application

Only after release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Optional visual check: open Farms or Batches and use search or Next/Previous. Creating a harvest batch opens the source-farm selector: search for an owned farm or navigate pages, then select it. Selection remains visible when another page is opened. Farm details show full recorded-batch totals separately from page rows; recorded quantity is not free inventory. Automated fixtures run in disposable test databases only. Do not reseed/delete application data.

## 5. Push and create the PR

```powershell
git push -u origin feat/paged-source-records-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/paged-source-records-v1?expand=1"
```

Base: `main`. Compare: `feat/paged-source-records-v1`.

Use the title and complete description from `docs/releases/PAGED_SOURCE_RECORDS_V1_PR.md`, replacing the default template. After your release run passes, check the database/API and browser verification boxes and attach the tested SHA/report or CI URL. Do not claim hosted staging verification unless it occurred.

## 6. Merge on GitHub

Wait for required GitHub checks. Review the diff, confirm the correct base/branch and release report, then select **Merge pull request** and **Confirm merge** (or the repository's configured merge option).

If checks fail or GitHub reports a conflict, stop and send the specific output. Do not force-push or pick entire conflicting files blindly. PER-001 / ARC-024 remain in progress after acceptance of this slice. Hosted measurements and pagination of other resources remain outstanding.

## 7. Pull merged main and restart

Once GitHub confirms the PR is merged:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Merged main pull failed." }
git status
git log -3 --oneline
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Merged application startup failed." }
Start-Process "http://localhost:3000"
```

Tell me release checks passed and merge/pull completed. That acknowledgement records acceptance of this source-record slice; PER-001 / ARC-024 stay open for the remaining resources and hosted load acceptance. Request-specific evidence guidance and saved-brief editing still require follow-up. Hosted operations, performance acceptance and the logistics-provider marketplace remain separate. No volume deletion, stash restoration or cleanup of local override files is needed.
