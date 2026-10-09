# Recall response JSON assertion correction

Download `bettertrade-recall-response-pages-v1-json-fix.bundle` to Downloads. Stay on your existing `feat/recall-response-pages-v1` branch. This patch corrects only a test expectation plus delivery documentation: the embedded PostgreSQL JSON quantity is numeric 1. Application behavior is unchanged. Do not create another PR or switch to main before applying.

## 1. Confirm the existing branch is clean

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch feat/recall-response-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Feature branch switch failed." }
git status
if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before continuing." }
```

Leave local untracked Compose overrides intact and out of the commit.

## 2. Apply the correction tip

```powershell
$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-recall-response-pages-v1-json-fix.bundle"
if (-not (Test-Path $bundle)) { throw "Correction bundle not found." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/recall-response-pages-v1-json-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/recall-response-pages-v1-json-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop and send git status." }
git log -3 --oneline
git status
```

Cherry-pick only the correction tip; do not merge the entire bundle history.

## 3. Install and run the automated release suite

Start Docker Desktop and wait for its engine to be ready. Finish any Docker update before testing. The suite uses disposable test projects; it does not require a long manual journey or resetting your app database.

```powershell
node --version
docker version
if ($LASTEXITCODE -ne 0) { throw "Docker is not ready." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
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
git push -u origin feat/recall-response-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/recall-response-pages-v1?expand=1"
```

## 5. Create the PR with its specific title and description

Title: **Bound recall response collections and preserve recovery drafts**

Replace the default PR body with `docs/releases/RECALL_RESPONSE_PAGES_V1_PR.md` (the Replacement PR description section). After your release pass, tick its integration and E2E boxes and append the tested commit and release result. Do not tick staging verification unless done on staging. Keep PER-001 / ARC-024 open. Wait for required GitHub CI checks to pass, then merge the PR in GitHub. If GitHub requires a main update, merge main into this feature branch, resolve carefully, and rerun the release suite for the new commit before pushing.

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

No additional manual matrix is required for this slice after the automated release pass. Report “release checks passed and merge/pull completed” so its accepted checkpoint can be recorded. Next: remaining public product detail histories and exports, with hosted performance acceptance still open.
