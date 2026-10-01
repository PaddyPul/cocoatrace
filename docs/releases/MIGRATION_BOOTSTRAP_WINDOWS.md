# Migration bootstrap v1 — Windows handoff

Bundle: `cocoatrace-migration-bootstrap-v1.bundle`
Branch: `fix/migration-bootstrap-v1`
Backlog: ENV-019, ENV-007, QLT-005.

## Prerequisite

Finish your current browser-regression pull request, including the health-check
correction: all four existing CI jobs must be green, then merge it on GitHub.
This bundle is the next separate release. Do not apply it over a pending merge
or cherry-pick conflict.

## 1. Apply

Download the bundle into Downloads. Run commands individually in PowerShell:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-migration-bootstrap-v1.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-migration-bootstrap-v1.bundle" "HEAD:refs/remotes/bundle/migration-bootstrap-v1"
git switch -c fix/migration-bootstrap-v1
git cherry-pick bundle/migration-bootstrap-v1
git status
git log -2 --oneline
```

Begin with no modified tracked files or merge in progress. Existing untracked
local Compose overrides can remain. Only the new implementation commit is
cherry-picked; do not merge the bundle's historical ancestry. If the branch
exists or Git reports a conflict, stop and share the output. Do not force reset
or choose one side wholesale.

## 2. Automated verification

Start Docker Desktop, then run:

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

Expected: 144 API unit tests, ten migration startup scenarios, 30 API integration
tests and six browser journeys pass. The migration command builds the normal
API container, invokes the actual release migration runner in production
configuration, and tests fresh startup, repeat/no-op, concurrent startup,
data/history preservation, transactional failure rollback and unsafe-history
refusals. Its database uses a separate fixed project with tmpfs storage and no
published port. Your normal app database is not reset or seeded.

Stop on any failure. Copy the failing output; do not push or manually alter
migration history to make the tests green. No full manual identity checklist
or manually prepared empty database is required.

## 3. Start your normal local application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 60
Start-Process "http://localhost:3000"
```

An existing current database should report `Already up to date`. Open the app
and sign in using an existing account as a short smoke check; your records
should remain available. Do not run `down -v`, fresh seed/reset, or migration
ledger deletion. If the runner refuses an incomplete/empty/unknown historical
ledger, share the exact message and stop; that needs investigation, not an
automatic data reset. A genuinely empty install now loads the frozen baseline
once, then applies later migrations.

## 4. Push and create a pull request

```powershell
git status
git diff --check
git push -u origin fix/migration-bootstrap-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...fix/migration-bootstrap-v1?expand=1"
```

Confirm base `main`, compare `fix/migration-bootstrap-v1`. Suggested title:
**Repair fresh database bootstrap and test safe upgrades**.
Describe atomic baseline/forward migrations, fail-closed history checks,
data-preserving upgrade/rollback tests and unchanged frozen migration hashes.

Wait for five green CI jobs: `verify`, `container-build`,
`postgres-integration`, `browser-identity`, and new `migration-startup`.
Add `migration-startup` to required repository checks if you manage branch
protection. Do not merge a failing job.

## 5. Merge

On GitHub, review the changed files and checks, select Merge pull request (or
Squash and merge), and confirm. Delete the remote branch if offered. No local
merge into main before review is needed.

## 6. Pull merged main and rebuild

```powershell
git switch main
git pull --ff-only origin main
git status
npm ci
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Expected: main is up to date with origin/main, no modified tracked files, and
the app starts with your existing data. Local untracked overrides can remain.

## Scope and evidence

Three subagents handled implementation, regression tests and independent
review; the primary agent integrated and verified the result. API build,
144 unit tests, migration integrity, browser typecheck, YAML and script syntax
passed. Nine nonconcurrent scenarios ran successfully against the actual
migration CLI and compiled API using temporary WASM PostgreSQL. Docker is not
available in the authoring environment: native PostgreSQL/concurrent startup
and full CI remain required gates.

No frozen schema, migration or integrity-manifest hash changed. Production
backup/restore and staging deployment remain separate work, documented in
`docs/runbooks/MIGRATION_STARTUP.md`. The backlog stays in progress until native
checks are confirmed. After this gate closes, the next implementation wave is
transactional offer acceptance and inventory reservation (Trading Integrity v1).
