# Paged custody transfers v1 — full Windows instructions

This wave adds server-filtered transfer history pages and a focused Inventory transfer panel. Incoming pending requests are the default; outgoing/history views are explicit. Only receiving-party requests expose acceptance. Failed reads show retry instead of disappearing. No migration, dependency, configuration change or data reset. The prior inventory/marketplace release acceptance is recorded.

Run each block in PowerShell, in order. Do not continue after a failed command. Your local untracked Compose overrides, logs and saved stashes stay untouched.

## 1. Apply the correction to your existing branch

Download `bettertrade-paged-transfers-v1-fix.bundle` into Downloads. Do not reapply the original feature.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before applying the correction." }
git switch feat/paged-transfers-v1
if ($LASTEXITCODE -ne 0) { throw "Feature switch failed." }
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-paged-transfers-v1-fix.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-paged-transfers-v1-fix.bundle" "HEAD:refs/remotes/bundle/paged-transfers-v1-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/paged-transfers-v1-fix
if ($LASTEXITCODE -ne 0) { throw "Correction application failed. Stop and send the output." }
git log -3 --oneline
git status
```

The newest message should be `fix: isolate malformed catalog pages and complete transfer fixtures`. Apply only the bundle tip. Earlier feature and correction history must not be reapplied.

## 2. What changed

The inventory browser fixture returned an old array for the new transfer page. The transfer component expected a page envelope, so it crashed the inventory screen. The fixture now returns the correct empty transfer page. Shared page reads also validate response shape and turn malformed responses into a local read error. A browser regression verifies that malformed transfer data leaves inventory visible with a retryable transfer-panel error.

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

The release runs new transfer unit tests, a 1,005-transfer native case in `catalogPagination.integration.test.ts` and four `transferPages.spec.ts` browser checks. Native coverage includes both-party isolation, off-page search, scoped cursors, compatibility overflow, outgoing acceptance rejection and receiving-party acceptance/retry. Existing inventory, marketplace and trade journeys also run. No long manual checklist is required.

Author-side Docker is unavailable. Author unit/build/type/quality checks do not substitute for your native release gate. A green report must match the exact candidate commit. If npm changes tracked files, inspect those changes before committing; never add local Compose overrides or reports containing credentials.

## 4. Start the application

Only after release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Optional visual check: open Inventory → Custody transfer records. Defaults are Incoming / Awaiting acceptance. Search or page history; switch to Outgoing to verify acceptance is absent. A receiving party can accept a valid request and inventory refreshes. Recalled supply is blocked. Page counts are labeled as page counts. Automated fixtures run only in the disposable test database; do not reseed/delete application data.

## 5. Push and create the PR

```powershell
git push -u origin feat/paged-transfers-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/paged-transfers-v1?expand=1"
```

Base: `main`. Compare: `feat/paged-transfers-v1`.

Use the title and complete description from `docs/releases/PAGED_TRANSFERS_V1_PR.md`, replacing the default template. After your release run passes, check the database/API and browser verification boxes and attach the tested SHA/report or CI URL. Do not claim hosted staging verification unless it occurred.

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

Tell me release checks passed and merge/pull completed. That acknowledgement records acceptance of this transfer-history slice; PER-001 / ARC-024 stay open for the remaining resources and hosted load acceptance. Request-specific evidence guidance and saved-brief editing still require follow-up. Hosted operations, performance acceptance and the logistics-provider marketplace remain separate. No volume deletion, stash restoration or cleanup of local override files is needed.
