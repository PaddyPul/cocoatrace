# Recall Safety v1 — Windows release instructions

This wave makes active recalls operational safety holds. It calculates quantity impact from the live trace graph, writes explicit lot/holding holds, withdraws affected listings and blocks new publication, offers, custody movement, splits and physical dispatch. Quantities and ownership remain unchanged. Arrival/customs/delivery reporting for already-dispatched cargo remains available for containment. Resolving a notice does not republish withdrawn listings.

## Apply locally

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-recall-safety-v1.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-recall-safety-v1.bundle" "HEAD:refs/remotes/bundle/recall-safety-v1"
git switch -c fix/recall-safety-holds-v1
git cherry-pick bundle/recall-safety-v1
git status
git log -3 --oneline
```

Use the command for the bundle name supplied with this release. If the branch already exists, switch to it and stop before recreating it. Keep untracked local Compose override files uncommitted.

## Automated checks

```powershell
npm test --workspace=api
npm run build --workspace=api
npm run build --workspace=web
npm run typecheck:browser
npm run migrations:verify --workspace=api
npm run test:migrations:docker
npm run test:integration:docker
npm run test:browser:docker
```

Expected native integration coverage is 76 tests after the existing suites and this wave are combined; native Docker/PostgreSQL is the release gate. Browser coverage is 16 tests: identity, marketplace, trust and recall presentation. Authoring validation passed 159 unit tests, both builds, browser type checks, migration integrity and eight recall integration tests in a supplemental PostgreSQL emulator; three emulator-only tests are intentionally native-only because they exercise receipt containment, audit rollback timing and the real activation/acceptance race. Do not merge until native Docker and GitHub CI pass.

## Start and inspect

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 100
Start-Process "http://localhost:3000"
```

Then run the operational reports:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run recall:check
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

Both should report `ok: true` and `issueCount: 0`. A historical trust correction count from `npm run trust:report` can remain positive.

## Manual buyer–supplier check

1. Supplier creates direct conventional inventory, publishes it and confirms it appears in the marketplace.
2. Buyer opens the listing and submits an offer. Supplier accepts through the normal payment-protected deal flow.
3. A user with the existing recall-management permission opens Recall Center, selects the batch or lot, enters a reference, reason, instructions and severity, then activates the recall.
4. The listing disappears from the marketplace. A stale listing detail shows a safety hold. New offers, republishing, transfers, splits and loaded/departed dispatch attempts are blocked with an active-recall message. Payment-exception dispatch cannot bypass it.
5. If the shipment was already loaded, receipt/arrival/customs/delivery updates remain available for containment. The recall stays visible in the journey.
6. Resolve the recall. The old listing remains withdrawn; explicitly review and republish only after the safety decision. If another active recall covers the same stock, it remains blocked.
7. Run both reports again.

No certifier account is required for this journey. Do not reset, reseed or remove database volumes.

## Push, merge and synchronize

```powershell
git status
git push -u origin fix/recall-safety-holds-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...fix/recall-safety-holds-v1?expand=1"
```

Create the PR against `main`, wait for every quality check and merge only after native migration, integration and browser checks pass. Suggested title: `Add transactional recall safety holds`. After merge:

```powershell
git switch main
git pull --ff-only origin main
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run recall:check
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```
