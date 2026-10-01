# Browser identity regression — Windows handoff

Bundle: `cocoatrace-browser-identity-regression.bundle`

New branch: `test/browser-identity-regression`

Backlog: QLT-021. The previously merged email changes must be on `main`.

This adds six automated browser journeys and fixes the two regressions they
exposed: failed login losing its error, and unrelated JSON-body verification
tokens sharing one rate-limit bucket. Rate limits remain ten attempts per
client/route/target; token targets are hashed in full. No migration or
application data reset is included. Test-only schema preparation is separate
from application startup.

## 1. Apply the bundle

Open PowerShell. Run commands one at a time and stop on errors.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-browser-identity-regression.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-browser-identity-regression.bundle" "HEAD:refs/remotes/bundle/browser-identity-regression"
git switch -c test/browser-identity-regression
git cherry-pick b326f7f bundle/browser-identity-regression
git status
git log -3 --oneline
```

Start only with no modified tracked files and no pending merge. Existing
untracked `docker-compose.real-flow.yml` files may remain. Do not use `git add .`,
force reset, or select one side of a conflict wholesale. If the branch already
exists or cherry-pick conflicts, stop and share the output. Applying just these
two new commits avoids merging divergent historical branch ancestry.

## 2. Automated checks

Start Docker Desktop. Then run:

```powershell
npm ci
npm run migrations:verify --workspace=api
npm run build --workspace=api
npm run build --workspace=web
npm run test --workspace=api
npm run typecheck:browser
npm run test:integration:docker
npm run test:browser:docker
```

Expected: 139 API unit tests, 30 API integration tests and six browser journeys
pass. The browser command automatically installs Chromium, builds and starts a
separate web/API/PostgreSQL/Mailpit stack, reads captured emails, drives the UI
and removes only its test containers. It needs no manually created customers,
reviewer login or fixture email links. First-run image/browser downloads can
take longer than later runs.

Stop before pushing if any check fails. Send the failing test/error output;
for browser failures also use:

```powershell
Get-Content ".\browser-test-results\safe\summary.json"
```

Do not send raw private traces, cookies or token-bearing email links.
Troubleshooting and port overrides are in
`docs/runbooks/BROWSER_REGRESSION.md`.

## 3. Optional short UI smoke check

You no longer need to repeat the entire identity checklist manually. To inspect
the changed login behavior in your normal local app:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

While signed out, submit a known account with an incorrect password. The login
form should remain visible and show `Invalid credentials`. Enter the correct
password and confirm sign-in. Use your existing account; no database reset or
seed command is needed. If startup fails, stop and inspect:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api web --tail 80
```

## 4. Push and open the pull request

```powershell
git status
git diff --check
git push -u origin test/browser-identity-regression
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...test/browser-identity-regression?expand=1"
```

On GitHub, confirm base `main` and compare `test/browser-identity-regression`.
Create a pull request titled **Automate identity and email browser regression**.
Describe six browser journeys, the login/rate-limit repairs, isolated fixtures
and the open ENV-019 production bootstrap blocker.

Wait for **verify**, **container-build**, **postgres-integration** and the new
**browser-identity** jobs to pass. Add browser-identity to required branch
checks if you manage the repository rules. Do not merge with a failing check.

## 5. Merge on GitHub

Open the pull request, review the changed files and green checks, then select
**Merge pull request** (or **Squash and merge**) and confirm. Delete the remote
feature branch if offered. These commands do not merge locally before review.

## 6. Pull merged main and rebuild your local app

```powershell
git switch main
git pull --ff-only origin main
git status
npm ci
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Expected Git status: on `main`, up to date with `origin/main`, no modified
tracked files. Existing untracked local overrides do not need committing.
If you want to remove the local feature branch afterward, first verify that
the GitHub pull request is merged. A squash merge may cause `git branch -d`
to refuse; leaving the branch in place is harmless.

## Validation limits and next work

The authoring environment passed builds, migration integrity, browser
typecheck, 139 API unit tests and six real Chromium journeys using temporary
WASM PostgreSQL/SMTP capture. It has no Docker; your Docker tests and GitHub CI
are required gates, not checks already claimed complete.

Next priority: ENV-019. The normal migration command on an empty database fails
because the frozen snapshot already contains a column subsequently added by
migration 009. The test baseline avoids replaying that history; it does not
repair production bootstrap. Repair bootstrap and add empty/upgrade CI checks
before proceeding to transactional offer/inventory integrity. Real SMTP domain
configuration and staging inbox delivery remain separate release gates.
