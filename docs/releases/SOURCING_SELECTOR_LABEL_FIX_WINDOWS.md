# Sourcing selector label correction — apply, test, push, merge and sync

Download `bettertrade-sourcing-selector-label-fix.bundle` to Downloads. Run these blocks in order on your existing feature branch. The request selector previously wrapped the option text inside its label, making the accessible name longer than 'Sourcing request'. The correction uses a separate label explicitly associated with the select. Apply only this correction tip to your existing sourcing feature branch. No database reset is needed.

## 1. Stay on the existing feature branch

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before continuing." }
git switch feat/sourcing-request-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Feature branch switch failed. Stop here." }
git log -3 --oneline
```

Keep local Compose overrides and stashes. Do not switch to main or merge the sourcing candidate yet.

## 2. Apply only the correction tip

```powershell
$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-sourcing-selector-label-fix.bundle"
if (-not (Test-Path $bundle)) { throw "Correction bundle not found in Downloads." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/sourcing-selector-label-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/sourcing-selector-label-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop and send git status; do not choose whole-file ours/theirs." }
git log -3 --oneline
git status
```

Cherry-pick only the correction tip, not its complete historical branch. This is a selector accessibility correction. Request authorization, paging and summaries are unchanged. No migration or dependency change.

## 3. Rerun the automated release suite

Dependencies are unchanged; keep your existing installation. Start Docker Desktop and wait for its engine to be ready. Finish any Docker update before testing. The suite uses disposable test projects; it does not require a long manual journey or resetting your app database.

```powershell
node --version
docker version
if ($LASTEXITCODE -ne 0) { throw "Docker is not ready." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

The release run includes quality, types, dependencies, unit tests, container checks, migrations, PostgreSQL/storage/scanner integration, browser journeys and backup/restore rehearsal. Author checks passed, but author cannot execute Docker/PostgreSQL/browser checks here. This Windows run supplies that evidence. If it fails, send the first named failure and `release-test-results/summary.json`; do not bypass a gate or increase all timeouts.

## 4. Push the tested feature branch

```powershell
if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared after testing. Stop and inspect them." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "The current commit is not release-tested." }
git push -u origin feat/sourcing-request-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/sourcing-request-pages-v1?expand=1"
```

## 5. Create the PR with its specific title and description

Title: **Page sourcing demand and preserve full dashboard totals**

If the PR already exists, update it instead of creating a duplicate. Replace the default PR body with `docs/releases/SOURCING_REQUEST_PAGES_V1_PR.md` (the Replacement PR description section). After your release pass, tick its integration and E2E boxes and append the tested commit and release result. Do not tick staging verification unless done on staging. Keep PER-001 / ARC-024 open. Wait for required GitHub CI checks to pass, then merge the PR in GitHub. If GitHub requires a main update, merge main into this feature branch, resolve carefully, and rerun the release suite for the new commit before pushing.

## 6. Pull the merged code into main

Only after GitHub confirms the PR is merged:

```powershell
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
git log -3 --oneline
```

## 7. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

No additional manual matrix is required for this slice after the automated release pass. Report “release checks passed and merge/pull completed” so its accepted checkpoint can be recorded. Next: remaining collection/architecture gaps and hosted performance acceptance.
