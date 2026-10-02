# Trading integrity v1 — Windows handoff

Bundle: `cocoatrace-trading-integrity-v1.bundle`  
Branch: `fix/trading-integrity-v1`  
Backlog: ARC-005, ARC-012, TRD-001–TRD-009.

## 1. Confirm prerequisites

Merge the migration-bootstrap pull request first, with all five CI checks green.
This release builds on that safe migration runner. The earlier browser identity
and health-check corrections must also be present in main. Do not apply this
bundle while another merge/cherry-pick is unresolved.

Download the bundle into Downloads. Run commands individually in PowerShell.
Begin with no modified tracked files; local untracked Compose overrides can
remain. Preserve local changes before switching branches; do not discard them.

## 2. Apply the new commit to current main

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-trading-integrity-v1.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-trading-integrity-v1.bundle" "HEAD:refs/remotes/bundle/trading-integrity-v1"
git switch -c fix/trading-integrity-v1
git cherry-pick bundle/trading-integrity-v1
git status
git log -3 --oneline
```

The fetched ref points to the single new implementation commit. Only that
commit is applied; do not merge the bundle's old
ancestry or cherry-pick prerequisite commits already merged into main. If Git
reports an existing branch or conflict, stop and share the exact output.

## 3. Install and run automated checks

Start Docker Desktop, then:

```powershell
npm ci
npm run migrations:verify --workspace=api
npm run build --workspace=api
npm run test --workspace=api
npm run typecheck:browser
npm run test:migrations:docker
npm run test:integration:docker
npm run test:browser:docker
```

Expected: all API unit tests, ten migration startup scenarios, 51 API integration tests (21 trading plus 30 existing), and the six existing identity browser journeys pass. No new trade browser journey is claimed in this release.

Every command must pass before pushing. These commands use dedicated test
projects/databases, not your normal app's customer records. Do not run two copies
of the same Docker test command simultaneously. Integration tests exercise the
new transactional inventory protections and native PostgreSQL concurrency.
The migration suite verifies fresh startup and safe existing-history upgrades;
the browser suite covers the checked-in browser journeys.

On failure, copy the full failing output and stop. Do not change an expected
failure status, delete a migration ledger or reset app data to get a pass.
Docker was unavailable in the authoring environment, so these native checks and
GitHub CI are required release evidence.

## 4. Start the app and inspect migration output

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
Start-Process "http://localhost:3000"
```

Migration 020 should apply once; subsequent starts should be up to date. If it
reports invalid historical rows or duplicate agreements, stop and share the
message. It deliberately refuses unsafe history. Do not run `down -v`, a fresh
seed, demo reset or ledger deletion.

## 5. Short manual smoke test

Use legitimate inventory and separate supplier/buyer accounts. There is no need
to repeat the full identity checklist.

1. As supplier, publish a small available quantity, such as 10 kg. Confirm a
   second listing cannot make the combined listed quantity exceed that stock.
2. As buyer, send an offer for part of it, such as 4 kg. As supplier, accept it.
   Check that one agreement appears and the trade dashboard opens its next step.
3. Check that the remaining available quantity is 6 kg and the accepted supply
   cannot be sold again. Existing competing listings/offers should reflect the
   residual budget rather than the original stock.
4. Open the agreement: payment protection, payments and shipment should exist.
   Continue your usual terms/payment/dispatch workflow as a short regression.
5. Confirm the app still displays existing records after the rebuild.

Automated tests cover races, rejected cross-tenant actions, expiration, transfer
reservation, splitting and rollback; the manual smoke checks the visible user
journey. Do not edit records directly in SQL for this smoke test.

Run the independent read-only diagnostic:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

Expected for consistent data: `ok: true`, `issueCount: 0`, exit zero. Findings
against old demo records must be reviewed; save the output rather than resetting
data. See [the runbook](../runbooks/TRADING_INTEGRITY.md).

## 6. Push and open the pull request

```powershell
git status
git diff --check
git push -u origin fix/trading-integrity-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...fix/trading-integrity-v1?expand=1"
```

Confirm base `main` and compare `fix/trading-integrity-v1`. Suggested title:
**Make trade acceptance and inventory allocation transactional**.

Describe atomic acceptance/fulfillment/audits, shared inventory locks and
reservation budgets, migration 020 constraints, read-only reconciliation and
the automated checks you ran. Wait for green `verify`, `container-build`,
`postgres-integration`, `browser-identity` and `migration-startup` jobs. Review
the changes and resolve comments before merging.

## 7. Merge on GitHub

Select **Merge pull request** or **Squash and merge**, then confirm. Delete the
remote feature branch if offered. Do not merge failing CI or merge locally into
main before the pull request review.

## 8. Pull merged main and rebuild

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

Expected: main is up to date with origin/main, no modified tracked files, API
starts without migration errors, and existing records remain available. Local
untracked overrides can remain. Record the successful native checks before
closing the Trading Integrity backlog items.
