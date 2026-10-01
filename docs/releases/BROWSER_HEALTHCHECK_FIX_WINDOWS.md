# Browser container readiness correction — Windows

Bundle: `cocoatrace-browser-healthcheck-fix.bundle`

The uploaded CI log shows successful API/web builds and healthy API,
PostgreSQL and Mailpit containers. Web readiness fails before browser tests
start. This patch replaces Alpine's potentially IPv6 `localhost` probe with
explicit IPv4 and verifies the proxied `/api/health/ready` route. It also prints
web logs and health-probe output before test-container cleanup.

Docker is unavailable in the authoring environment. Script syntax, Compose
YAML and patch checks passed; actual container readiness must be rerun locally
and in GitHub. No application data or migration is changed.

## 1. Apply to the existing pull-request branch

Run commands separately in PowerShell. Stop if tracked files are modified, a
merge is pending, or a cherry-pick conflicts. Existing untracked local Compose
overrides may remain.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch test/browser-identity-regression
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-browser-healthcheck-fix.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-browser-healthcheck-fix.bundle" "HEAD:refs/remotes/bundle/browser-healthcheck-fix"
git cherry-pick bundle/browser-healthcheck-fix
git status
git log -2 --oneline
```

Only the new fix commit is cherry-picked. Do not merge the whole bundle history
or create another pull request.

## 2. Rerun browser checks

Start Docker Desktop, then run:

```powershell
npm run typecheck:browser
npm run test:browser:docker
```

Expected: every test container becomes healthy, all six journeys pass and the
runner removes its dedicated containers. Your application database remains
untouched. No manual identity checklist is required. Dependencies are unchanged;
if `node_modules` is absent, run `npm ci` first.

If startup still fails, share the new web logs and health output printed before
cleanup. Do not push or merge with failing tests.

## 3. Push the correction

```powershell
git diff --check
git push origin test/browser-identity-regression
```

This updates your existing pull request, shown as #24 in the screenshot.
GitHub reruns its checks automatically. Wait for `verify`, `container-build`,
`postgres-integration` and `browser-identity` to be green.

## 4. Merge on GitHub

Open the existing pull request and confirm base `main`. Review the correction,
then select Merge pull request (or Squash and merge) and confirm once all checks
pass. Delete the remote feature branch if offered.

## 5. Pull merged main and start the local app

```powershell
git switch main
git pull --ff-only origin main
git status
npm ci
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Expected: `main` is up to date with `origin/main` and tracked files are clean.
No application database reset, seeding or destructive cleanup is needed.
