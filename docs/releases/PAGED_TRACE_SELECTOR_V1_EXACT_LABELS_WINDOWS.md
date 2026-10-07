# Paged trace selector — exact-label correction — Windows instructions

Apply this correction on your existing `feat/paged-trace-selector-v1` branch with the original pagination bundle already applied. The failure came from a partial Playwright label match: `Trace lot` matched both the selector and the search input. This correction uses exact matches. No application, database, dependency or configuration change and no data reset are needed.

## 1. Download and confirm your current branch

Download `bettertrade-paged-trace-selector-v1-exact-labels.bundle` into Downloads. In PowerShell:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$currentBranch = git branch --show-current
if ($LASTEXITCODE -ne 0) { throw "Branch check failed." }
if ($currentBranch -ne "feat/paged-trace-selector-v1") { throw "Expected the existing feat/paged-trace-selector-v1 branch. Stop and send git status." }
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before applying the correction." }
```

Keep your local untracked Compose files and saved stashes. Do not create a new feature branch or reapply the original bundle.

## 2. Apply only the correction commit

```powershell
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-paged-trace-selector-v1-exact-labels.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-paged-trace-selector-v1-exact-labels.bundle" "HEAD:refs/remotes/bundle/paged-trace-selector-v1-exact-labels"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/paged-trace-selector-v1-exact-labels
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop and send the output." }
git log -2 --oneline
Select-String -Path ".\e2e\traceLotPages.spec.ts" -Pattern "getByLabel"
```

Newest commit message: `test: match trace selector labels exactly`. Each `Trace lot` and `Search trace lots` locator must include `{ exact: true }`. Cherry-pick only the bundle tip, not its history. If the correction is already applied, do not apply it twice.

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

The full release runs existing gates plus the new native cases in `recallSafety.integration.test.ts` and the browser navigation case `traceLotPages.spec.ts` (plus updated incomplete-trace/recall-response cases). No long manual checklist is required.

Author-side Docker is unavailable. Author unit/build/type/quality checks do not substitute for your native release gate. A green report must match the exact candidate commit. If npm changes tracked files, inspect those changes before committing; never add local Compose overrides or reports containing credentials.

## 4. Start the application

Only after release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Optional visual check only: open Trace & Recall, search a known lot, and use Previous/Next lots if your workspace has more than 50 records. Clear the search to restart. Search failures must not claim your inventory is empty. Existing recall responses stay accessible. Do not reset/reseed data or intentionally corrupt your application database; automated fixtures use the disposable test database.

## 5. Push and create the PR

```powershell
git push -u origin feat/paged-trace-selector-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/paged-trace-selector-v1?expand=1"
```

Base: `main`. Compare: `feat/paged-trace-selector-v1`.

Use the title and complete description from `docs/releases/PAGED_TRACE_SELECTOR_V1_PR.md`, replacing the default template. After your release run passes, check the database/API and browser verification boxes and attach the tested SHA/report or CI URL. Do not claim hosted staging verification unless it occurred.

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

Tell me release checks passed and merge/pull completed. That acknowledgement records acceptance of this trace-selector slice; PER-001 / ARC-024 stay open for the remaining resources. Request-specific evidence guidance and saved-brief editing still require follow-up. Hosted operations, performance acceptance and the logistics-provider marketplace remain separate. No volume deletion, stash restoration or cleanup of local override files is needed.
