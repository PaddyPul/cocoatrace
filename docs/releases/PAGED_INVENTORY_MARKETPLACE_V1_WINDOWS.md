# Paged inventory and marketplace v1 — full Windows instructions

This wave adds inventory/marketplace cursor pages, server filtering, full supply aggregates and off-page supply/stock selection. Native regressions and browser journeys automate acceptance. No migration, dependency, configuration change or data reset is needed. The prior trace-selector release/merge acknowledgement is recorded.

Run each block in PowerShell, in order. Do not continue after a failed command. Your local untracked Compose overrides, logs and saved stashes stay untouched.

## 1. Download and update main

Download `bettertrade-paged-inventory-marketplace-v1.bundle` into Downloads.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before switching branches." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main pull failed." }
git switch -c feat/paged-inventory-marketplace-v1
if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Do not overwrite an existing branch." }
```

## 2. Apply the new feature commit

```powershell
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-paged-inventory-marketplace-v1.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-paged-inventory-marketplace-v1.bundle" "HEAD:refs/remotes/bundle/paged-inventory-marketplace-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/paged-inventory-marketplace-v1
if ($LASTEXITCODE -ne 0) { throw "Bundle application failed. Stop and send the conflict/output." }
git log -2 --oneline
git status
```

The newest message should be `feat: page inventory and marketplace with truthful supply totals`. Cherry-pick only the tip; do not merge the bundle's author history or reapply earlier security work. Your GitHub merge history can differ from the bundle history.

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

The full release runs existing gates plus `catalogPagination.integration.test.ts`, seven organic-predicate cases in `trustAccuracy.integration.test.ts`, and `catalogPages.spec.ts`. Updated visibility/trust fixtures and existing real supplier/buyer/source journeys run automatically. No long manual checklist is required.

Author-side Docker is unavailable. Author unit/build/type/quality checks do not substitute for your native release gate. A green report must match the exact candidate commit. If npm changes tracked files, inspect those changes before committing; never add local Compose overrides or reports containing credentials.

## 4. Start the application

Only after release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Optional visual check only: open Inventory or Marketplace, search a known material and use Previous/Next controls. Create conventional inventory if desired: the publish screen selects its exact holding. Marketplace price order requires one currency. Counts are totals, page counts are labeled as page counts, and failed summaries must not instruct you to create supposedly missing inventory. Automated fixtures run only in the disposable test database. Do not reseed/delete your application data.

## 5. Push and create the PR

```powershell
git push -u origin feat/paged-inventory-marketplace-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/paged-inventory-marketplace-v1?expand=1"
```

Base: `main`. Compare: `feat/paged-inventory-marketplace-v1`.

Use the title and complete description from `docs/releases/PAGED_INVENTORY_MARKETPLACE_V1_PR.md`, replacing the default template. After your release run passes, check the database/API and browser verification boxes and attach the tested SHA/report or CI URL. Do not claim hosted staging verification unless it occurred.

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

Tell me release checks passed and merge/pull completed. That acknowledgement records acceptance of this inventory/marketplace slice; PER-001 / ARC-024 stay open for the remaining resources. Request-specific evidence guidance and saved-brief editing still require follow-up. Hosted operations, performance acceptance and the logistics-provider marketplace remain separate. No volume deletion, stash restoration or cleanup of local override files is needed.
