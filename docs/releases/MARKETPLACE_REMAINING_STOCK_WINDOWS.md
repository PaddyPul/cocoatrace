# Marketplace remaining-stock correction

After partial offer acceptance, the unsold advertised quantity is now published as a continuation listing at the original price and commercial terms. The accepted listing remains deal history; aggregate sibling listings and transfer reservations still cannot exceed available stock. Plain marketplace navigation browses all supply rather than silently filtering it with an old sourcing brief. Explicit request matching remains available. Marketplace data refreshes on focus and while visible.

Apply after Trading Integrity v1 and its Compose compatibility correction, on the same unmerged feature branch. This correction changes no schema or dependencies and does not reset existing data.

## Apply on your existing trading branch

Run each command separately in PowerShell. Stop on any failure. Preserve modified tracked files; local untracked Compose overrides may remain.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch fix/trading-integrity-v1
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-marketplace-remaining-stock-fix.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-marketplace-remaining-stock-fix.bundle" "HEAD:refs/remotes/bundle/marketplace-remaining-stock-fix"
git cherry-pick bundle/marketplace-remaining-stock-fix
git status
```

The bundle tip contains only this correction; do not merge its complete ancestry. No reinstall is necessary because dependencies did not change.

## Run automated checks

Start Docker Desktop and run sequentially:

```powershell
npm test --workspace=api
npm run build --workspace=api
npm run build --workspace=web
npm run typecheck:browser
npm run test:integration:docker
npm run test:browser:docker
```

Require all commands to exit successfully. The integration suite now contains 54 tests (30 existing plus 24 trading); native PostgreSQL concurrency remains required. The browser suite contains ten tests: six existing identity journeys plus four marketplace UI regressions with mocked API responses. Mocked browser cases test filtering and refresh, not real backend transaction behavior. Docker remains unavailable in the authoring environment. Do not merge until local native suites and GitHub CI pass.

Authoring verification: 151 API unit tests, API/web builds, browser TypeScript checks and the four new mocked Chromium cases passed. Supplemental WASM PostgreSQL passed 15 functional trading cases and skipped nine concurrency cases; this does not establish native race correctness. No full native Docker suite is claimed.

## Start the app and smoke test

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
Start-Process "http://localhost:3000"
```

Stop on migration errors. Do not reset the database or remove volumes.

1. Supplier publishes 10 kg of new inventory; combined listing quantity cannot exceed stock.
2. Buyer offers for 4 kg; supplier accepts; exactly one agreement exists and 6 kg remains available. Open Find verified supply, search the product name: the 6 kg continuation listing must be visible and can receive another offer. The accepted 4 kg cannot be offered again.
3. Agreement has payment terms, payment schedule and shipment; continue the usual payment-before-dispatch and delivery workflow.
4. Plain Find verified supply should show all published products, even when your saved sourcing brief asks for another commodity. Matching a specific request still applies that request, with a visible Browse all supply control.
5. Keep the buyer marketplace open while accepting as supplier in another window. Refocus the buyer window (or wait for its visible refresh) and confirm the new quantity appears.
6. Existing records remain visible.

**The 6 kg left by an acceptance made before this correction:** it will not be retroactively published, since its original advertised quantity cannot be reliably reconstructed. As supplier, click Publish supply, select that existing available 6 kg holding, enter quantity/price/terms and publish it once. Do not create another inventory record. If publication says stock is already listed, open Find verified supply with Browse all supply and check that listing instead.

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
