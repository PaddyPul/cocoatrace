# Automated operations — full Windows instructions

Download **bettertrade-operations-worker-status-v1.bundle** into Downloads. This is one combined release: automatic bounded evidence scanning/cleanup, durable scheduled-job status, platform-admin monitor and audited cleanup recovery. It includes the backlog acknowledgement of your accepted recall corrections.

Keep your untracked local Compose files and browser output file. Do not add them to this PR. Apply only the bundle tip with cherry-pick; do not merge the bundle's full history.

## 1. Sync main and create the feature branch

Run in PowerShell. Stop on any error.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before continuing." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git switch -c feat/operations-worker-status-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop and send git status." }
```

## 2. Apply the bundle tip

```powershell
$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-operations-worker-status-v1.bundle"
if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/operations-worker-status-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/operations-worker-status-v1
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
git log -3 --oneline
git status
```

## 3. Run one full automated release

Docker Desktop must be running. The release includes the new native and browser regressions; no extra manual business journey is required for this batch.

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
```

If the new native suite needs diagnosis, the exact single-suite command is:

```powershell
npm run test:integration:docker --workspace=api -- operationsWorkers.integration.test.ts
if ($LASTEXITCODE -ne 0) { throw "Operations integration failed. Send the first failure." }
```

A targeted pass does not replace the full release. Do not force-upgrade dependencies, reset the database, prune volumes or disable safety deadlines to obtain a pass.

## 4. Push and create the PR

```powershell
git push -u origin feat/operations-worker-status-v1
if ($LASTEXITCODE -ne 0) { throw "Feature push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/operations-worker-status-v1"
```

Base: main. Head: feat/operations-worker-status-v1. Copy the exact title/body from **OPERATIONS_WORKER_STATUS_V1_PR.md**. After your exact-candidate full release passes, check the native and E2E verification boxes and add the release commit/result. Leave hosted acceptance and broad backlog completion open. Wait for required GitHub checks to pass, then merge the PR.

## 5. Pull and start the application

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed. Send output; do not reset the database." }
Start-Process "http://localhost:3000"
```

Startup applies migration 036 before API jobs start. The hardened container has no npm; no npm maintenance command is needed. Sign in with your existing platform administrator and verify its passkey. **Operations** is available in navigation or at http://localhost:3000/operations. Buyer/supplier accounts cannot operate it. Capture email still goes to your local Mailpit, not an external inbox.

Optional operator status (not another release gate):

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml exec api node --import tsx api/scripts/operations-status.ts
```

This status is initially unhealthy until all jobs have a successful run. It remains unhealthy for suppressed email, failed/terminal work or stale jobs. Correct the dependency first; the monitor offers an explained, audited retry only for safe terminal cleanup. Quota remains charged until actual deletion. See docs/runbooks/OPERATIONS_JOBS.md for lock-connection recovery and deployment limits.

Author validation is documented in the PR; Docker/PostgreSQL/browser/hosted runtime acceptance is not claimed from compilation. Completion percentages remain conservative: core pilot 35.7%, roadmap 22.8%; this candidate does not close the broad operations gates.
