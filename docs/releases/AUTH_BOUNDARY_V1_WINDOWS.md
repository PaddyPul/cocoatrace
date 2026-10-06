# Authentication boundary — full Windows handoff

Bundle: bettertrade-auth-boundary-v1.bundle. Branch: feat/browser-auth-boundary-v1. Outcomes: cookie/origin and credential consistency, shared PostgreSQL account/IP throttling and automated regressions. This is not the runtime BetterTrade rename or provider marketplace.

## Prerequisite and testing effort

The prior language correction and BetterTrade grooming changes must be applied and merged into main first. If they are not, use their supplied handoffs; grooming needs only its short tooling checks, while the outstanding application release must pass. This dependency keeps your main/history coherent. Do not merge unverified language fixes or the author's complete bundle history.

For this batch, run one automated `verify:release`; no new long manual farm/trade/identity checklist is required. Native PostgreSQL/browser/container/recovery cannot be run in the authoring environment and must pass on your PC/CI before merge. Local author evidence: 319 API tests, quality/types/builds/migration integrity and a focused Chromium origin-policy probe pass.

## 1. Check and synchronize

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Tracked changes exist. Preserve/review them before continuing." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
if (-not (Test-Path ".\docs\pilot-gates.json")) { throw "BetterTrade grooming is not on main yet. Complete that handoff first." }
git status
```

Leave your untracked local Compose overrides and any old formatting stash alone. Do not use git add . / reset / clean to bypass changes.

## 2. Import only the correction tip

Download the bundle into Downloads:

```powershell
$securityBundle = "$env:USERPROFILE\Downloads\bettertrade-auth-boundary-v1.bundle"
if (-not (Test-Path $securityBundle)) { throw "Bundle is missing from Downloads." }
git bundle verify $securityBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $securityBundle "HEAD:refs/remotes/bundle/auth-boundary-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/browser-auth-boundary-v1
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop rather than resetting an existing branch." }
$securityTip = git rev-parse bundle/auth-boundary-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve bundle tip." }
git show --stat --oneline $securityTip
git cherry-pick $securityTip
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and send git status; do not resolve every file with ours/theirs." }
git status
git log -3 --oneline
```

No git merge bundle/... command: authoring and founder histories differ. Cherry-pick only HEAD, which contains this batch and migration 031. Frozen historical migrations remain unchanged.

## 3. Run the automated release gate

Start Docker Desktop, wait until it is running, then:

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release failed. Stop; do not push/merge. Send the first failing gate and summary." }
Get-Content ".\release-test-results\summary.json" -Raw
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog validation failed." }
git status
```

Expected: every release check passed; not_run is not a pass. New coverage includes real sessions, concurrent PostgreSQL counters and browser origin denial plus normal sign-out. The full suite also protects existing identity/trade/payment/delivery/recall flows. Do not disable throttling or add origin exemptions to make tests pass.

If it fails:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
if (Test-Path ".\browser-test-results\safe\summary.json") {
  Get-Content ".\browser-test-results\safe\summary.json" -Raw
}
git status
```

Keep the native console's first specific failure. Do not send cookies, passwords, .env files or private traces. No repetitive manual persona test is needed for this batch; automated failures guide any targeted follow-up.

## 4. Start the application

The normal API startup applies the additive manifest-verified migration. Never delete volumes or migration history.

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 40
Start-Process "http://localhost:3000"
```

Optional short confirmation: normal sign-in/sign-out still works. The automated browser test already covers it. If login returns AUTH_RATE_LIMIT_UNAVAILABLE, inspect API/migration/DB readiness; do not drop the counter table or bypass protection. Cookie API clients need the exact trusted Origin; explicit bearer clients can omit Origin, and a bad bearer header no longer falls back to cookies.

The immediate proxy peer may share its 100-per-route/15-minute budget across users; account budgets are ten per 15 minutes. Do not set trust proxy=true to bypass a shared-IP 429. Reviewed ingress configuration and operational load budgets remain follow-ups.

## 5. Push and create the PR

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Unexpected tracked changes. Review them before pushing." }
git push -u origin feat/browser-auth-boundary-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/browser-auth-boundary-v1?expand=1"
```

Base main, compare feat/browser-auth-boundary-v1. Use the exact title and complete description in AUTH_BOUNDARY_V1_PR.md. Update verification with your native result/commit and CI link; tick integration/E2E only after actual success. All required CI checks must pass; resolve review comments, then click Merge pull request and confirm. Do not bypass a red gate.

## 6. Pull the merged result and restart

After GitHub confirms merge:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch to main failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main pull failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Merged application startup failed." }
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Backlog register invalid." }
```

Do not run down -v or rename Compose projects: existing volumes stay intact. Once native release/merge evidence is confirmed, update the exact completed item criteria; no automatic pilot authorization. Next security slice is administrator MFA/recovery and audited suspension, alongside remaining public endpoint abuse controls. Product navigation and provider fulfillment follow the groomed queue.
