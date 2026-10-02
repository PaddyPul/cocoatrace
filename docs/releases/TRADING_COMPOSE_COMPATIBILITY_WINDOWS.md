# Trading integrity Compose compatibility correction

The browser and migration runners failed before tests ran because this Docker Compose installation does not accept `--wait-timeout`. This correction removes that flag and retains `--wait`, already used by the integration runner. Health checks still gate readiness. It changes no app data, migrations or dependencies.

## Apply on your existing trading branch

Run each command separately in PowerShell. Stop on any failure. Preserve modified tracked files; local untracked Compose overrides may remain.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch fix/trading-integrity-v1
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-compose-wait-compatibility-fix.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-compose-wait-compatibility-fix.bundle" "HEAD:refs/remotes/bundle/compose-wait-compatibility-fix"
git cherry-pick bundle/compose-wait-compatibility-fix
git status
```

The bundle tip contains only this correction; do not merge its complete ancestry. No reinstall is necessary because dependencies did not change.

## Rerun the blocked suites

Start Docker Desktop and run sequentially:

```powershell
npm run test:migrations:docker
npm run test:browser:docker
```

Require both commands to exit successfully, with ten migration scenarios and six browser tests passing. A startup error or zero tests is not a pass. If your earlier integration test was not successful, also run:

```powershell
npm run test:integration:docker
```

Expected: 51 integration tests pass. Earlier successful unit/build checks need not be repeated solely for these runner changes. JavaScript syntax checks and `git diff --check` passed in the authoring environment; Docker was unavailable, so native execution remains required.

## Start the app and smoke test

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
Start-Process "http://localhost:3000"
```

Stop on migration errors. Do not reset the database or remove volumes.

1. Supplier publishes 10 kg of new inventory; combined listing quantity cannot exceed stock.
2. Buyer offers for 4 kg; supplier accepts; exactly one agreement exists and 6 kg remains available.
3. Agreement has payment terms, payment schedule and shipment; continue the usual payment-before-dispatch and delivery workflow.
4. Existing records remain visible.

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

Require `ok: true` and `issueCount: 0` for consistent data. If old demo records produce findings, send their output for review before merging; do not reset them to clear the diagnostic.

## Push and merge

```powershell
git status
git diff --check
git push -u origin fix/trading-integrity-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...fix/trading-integrity-v1?expand=1"
```

If push hangs, cancel and use the previously successful fallback:

```powershell
git -c http.version=HTTP/1.1 push --verbose --progress -u origin fix/trading-integrity-v1
```

Create/update the pull request with base `main`, compare `fix/trading-integrity-v1`. Wait for `verify`, `container-build`, `postgres-integration`, `browser-identity`, and `migration-startup` to pass. Then click Merge pull request or Squash and merge, and confirm.

## Pull merged main and rebuild

```powershell
git switch main
git pull --ff-only origin main
git status
npm ci
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 60
Start-Process "http://localhost:3000"
```

Expect main up to date with origin/main, no modified tracked files, healthy startup and preserved records.
