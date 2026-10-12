# Stress startup correction — apply, test, push, merge and sync

Download `bettertrade-evidence-stress-startup-fix.bundle` to Downloads. Apply this correction on your existing `feat/evidence-preflight-stress-v1` branch. The synthetic S3 bucket now includes `test` as required by environment isolation. A regression test uses the real configuration parser. Safe startup stage codes replace the opaque child-exit failure. No production configuration, dependency or migration changes.

## 1. Keep your current feature branch and preserve local files

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before continuing." }
git switch feat/evidence-preflight-stress-v1
if ($LASTEXITCODE -ne 0) { throw "Feature switch failed. Stop here." }
```

Leave your untracked local Compose files alone. Do not switch to main or merge before this correction passes.

## 2. Verify and apply the bundle tip

```powershell
$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-evidence-stress-startup-fix.bundle"
if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/evidence-stress-startup-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/evidence-stress-startup-fix
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and send git status; do not choose whole-file ours/theirs." }
git log -3 --oneline
git status
```

Cherry-pick only the tip. Do not merge the bundle's full historical branch.

## 3. Install and run the automated release suite

Start Docker Desktop and wait for its engine to be ready. Finish any Docker update before testing. The suite uses disposable test projects; it does not require a long manual journey or resetting your app database.

```powershell
node --version
docker version
if ($LASTEXITCODE -ne 0) { throw "Docker is not ready." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run test:evidence:stress:docker
if ($LASTEXITCODE -ne 0) { throw "Stress gate failed. Send evidence-stress-test-results/summary.json. Stop here." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

The release run includes quality, types, dependencies, unit tests, container checks, migrations, PostgreSQL/storage/scanner integration, browser journeys and backup/restore rehearsal. Author quality, workspace/browser types, builds, unit, migration integrity and backlog checks are recorded with the delivery. Author cannot execute Docker/PostgreSQL/browser checks here. This Windows run supplies that evidence. If it fails, send the first named failure and `release-test-results/summary.json`; do not bypass a gate or increase all timeouts.

## 4. Push the tested feature branch

```powershell
if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared after testing. Stop and inspect them." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "The current commit is not release-tested." }
git push -u origin feat/evidence-preflight-stress-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/evidence-preflight-stress-v1?expand=1"
```

## 5. Create the PR with its specific title and description

Title: **Move proof checks outside trade locks and gate transfer memory**

Replace the default PR body with `docs/releases/EVIDENCE_PREFLIGHT_STRESS_V1_PR.md` (the Replacement PR description section). After your release pass, tick its integration and E2E boxes and append the tested commit and release result. Do not tick staging verification unless done on staging. Keep PER-003 / OPS-010 open. Wait for required GitHub CI checks to pass, then merge the PR in GitHub. If GitHub requires a main update, merge main into this feature branch, resolve carefully, and rerun the release suite for the new commit before pushing.

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

No migration is added in this wave. The hardened API intentionally has no npm; future maintenance runs use direct `node --import tsx api/scripts/...` commands.

The new release gate runs four parallel 10 MiB uploads and slow authorized downloads, proves busy rejection, verifies downloaded checksums and samples API RSS every 10 ms against a 512 MiB budget. Read `evidence-stress-test-results/summary.json` for this machine's measured peak. Scanner, database and object-store memory are excluded. This is a one-process canary, not hosted capacity certification or distributed admission coverage.

No extra manual matrix is required. If the stress gate fails, send its safe summary and first named gate. Never bypass the budget. After required CI passes and merge/pull finishes, report acceptance. Next: recall proof eligibility, streaming transfers, distributed admission and hosted performance/operations evidence.

If a killed stress runner leaves `evidence-stress-test-results/.run.lock`, first ensure no stress process is running and stop only its `bettertrade-evidence-stress-*` Compose project. Remove that stale lock only after confirming the run has ended. Do not remove volumes belonging to your application.
