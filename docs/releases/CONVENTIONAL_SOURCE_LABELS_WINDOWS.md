# Conventional inventory source labels — Windows correction

Apply this correction on the same unmerged Trust-state Accuracy feature branch after the original bundle. It changes listing presentation, adds one browser regression and corrects the manual guide. No database migration or dependency changes. Direct inventory already saves no farm link; the UI must not fabricate one.

Run each command separately in PowerShell; stop on errors. Preserve your local data and untracked Compose overrides.

## Apply

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch fix/trust-state-accuracy-v1
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-conventional-source-labels-fix.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-conventional-source-labels-fix.bundle" "HEAD:refs/remotes/bundle/conventional-source-labels-fix"
git cherry-pick bundle/conventional-source-labels-fix
git status
```

Cherry-pick only this tip; do not merge its ancestry. If the original trust branch is already merged, instead start a new correction branch from current main (`git switch main`, `git pull --ff-only origin main`, `git switch -c fix/conventional-source-labels`) and cherry-pick the same tip. Use that correction branch name when pushing and opening its PR.

## Automated checks

```powershell
npm run build --workspace=web
npm run typecheck:browser
npm run test:browser:docker
```

Expect fourteen browser cases. The added mocked case asserts that conventional inventory displays Inventory lot and Declared inventory source, with no farm/harvest wording even if stale farm data is supplied. Keep the original trust release gates: all unit, build, migration and native integration checks must have passed before merging the combined branch. If not completed, run:

```powershell
npm test --workspace=api
npm run build --workspace=api
npm run migrations:verify --workspace=api
npm run test:migrations:docker
npm run test:integration:docker
```

## Start and check

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
Start-Process "http://localhost:3000"
```

1. Open the conventional listing you already created. It should show Declared inventory source, your supplied source/location, and Inventory lot. No new inventory, harvest or farm is necessary.
2. Open a farm-based harvest listing, if you have one. It should retain Farm & plots and Harvest lot. A missing farm name must say Farm not recorded, not Linked farm record.
3. Continue the usual buyer offer and supplier response/payment/fulfilment flow. No certifier login is needed. Organic-reviewed labels are optional assurance and cannot be obtained simply by uploading a PDF.

A farm and plot are source records, not two products. Your conventional inventory is a separate lot and stays separate even if you created a farm in the same session. Optional certifier actions from the original guide are internal security tests; automated regressions cover them.

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

Require `ok: true`, `issueCount: 0`. Do not reset or reseed.

## Push and merge

```powershell
git status
git push -u origin fix/trust-state-accuracy-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...fix/trust-state-accuracy-v1?expand=1"
```

Create/update the PR against main. Mention the conventional source-label correction and passing checks. Wait for every GitHub quality check, then click Merge pull request and Confirm merge. Do not bypass failures.

## Pull merged main

```powershell
git switch main
git pull --ff-only origin main
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
Start-Process "http://localhost:3000"
```

Existing inventory and review/correction history remain intact.
