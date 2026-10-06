# Access suspension v1 — full Windows instructions

Bundle: bettertrade-access-suspension-v1.bundle. Branch: feat/access-suspension-v1.

This adds Account access controls for platform administrators: password-confirmed, audited suspension/restoration of ordinary buyer/supplier users and organizations. Sessions are revoked; organization invitations are revoked. Restoration needs fresh sign-in and preserves separately suspended members. Privileged organizations are protected here; MFA/privileged recovery/permanent deactivation remain pilot blockers.

The earlier auth-boundary branch must already be merged into main, as you confirmed. Authoring and founder histories differ: cherry-pick ONLY this bundle's HEAD commit. Do not merge its full history.

## 1. Synchronize main safely

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Preserve/review tracked changes before continuing." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch to main failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
if (-not (Test-Path ".\api\src\migrations\031_shared_auth_rate_limits.ts")) { throw "Merge the auth-boundary wave into main first." }
git status
```

Leave untracked docker-compose.real-flow.yml and docker-compose.real-flow.yml.yml, old bundles and any saved formatting stash alone. Do not use git add ., reset or clean as a shortcut.

## 2. Apply this bundle

Download into Downloads, then:

```powershell
$accessBundle = "$env:USERPROFILE\Downloads\bettertrade-access-suspension-v1.bundle"
if (-not (Test-Path $accessBundle)) { throw "Bundle missing from Downloads." }
git bundle verify $accessBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $accessBundle "HEAD:refs/remotes/bundle/access-suspension-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/access-suspension-v1
if ($LASTEXITCODE -ne 0) { throw "Branch already exists or could not be created. Stop; do not reset it." }
$accessTip = git rev-parse bundle/access-suspension-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve bundle tip." }
git show --stat --oneline $accessTip
git cherry-pick $accessTip
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and send git status." }
git log -3 --oneline
git status
```

One new additive migration: 032_access_suspension.ts. It does not edit frozen migrations or require a data reset.

## 3. Run the automated release checks

Start Docker Desktop and wait until it is ready. This wave has automated tests; no long manual trade checklist is required.

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog tests failed." }
git status
```

All gates must pass, including migration upgrade, PostgreSQL integration, browser journeys and backup/restore. `not_run` is not a pass. The author verified 325 unit tests, quality/types/builds, migration integrity and locale/backlog tests. Native Docker execution is unavailable in the authoring environment; your release is the required application/database/browser evidence.

New coverage includes ordinary-actor denial, current-password confirmation, protected privileged targets, peer isolation, session/invitation non-revival, concurrent decisions/session issuance and rollback if audit fails. The browser regression exercises real access enrollment, administrator suspension/restoration and fresh customer sign-in.

If anything fails, preserve the first specific console message and collect sanitized summaries:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
if (Test-Path ".\browser-test-results\safe\summary.json") {
  Get-Content ".\browser-test-results\safe\summary.json" -Raw
}
git status
```

Do not send passwords, session cookies, private traces or .env files. Do not disable access/origin protections or modify expected denial codes to force a pass.

## 4. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 40
Start-Process "http://localhost:3000"
```

Normal API startup applies the manifest-verified migration. Never delete application volumes. Optional UI look: sign in as your existing platform administrator and open **Account access controls**. Ordinary buyers/suppliers cannot see or call these controls. Privileged organizations are intentionally protected. No extra manual workflow is required after the automated release passes.

Suspension stops new authenticated activity, not already authorized in-flight work. It does not cancel trades, transfer inventory or withdraw public listings. Detailed workflow text is currently English; shell navigation supports English/French. MFA and privileged recovery remain a later security slice, not included here.

## 5. Push and create the PR

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Unexpected tracked changes. Review before pushing." }
git push -u origin feat/access-suspension-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/access-suspension-v1?expand=1"
```

Base main; compare feat/access-suspension-v1. Exact title and full filled PR description are in ACCESS_SUSPENSION_V1_PR.md. Copy that description over the default template. Add your actual candidate commit, complete successful release result and CI link; tick integration/E2E only after actual success. Hosted staging/accessibility remain unchecked until measured/verified.

Wait for all required GitHub checks to pass, resolve review comments, then click **Merge pull request** and confirm. Do not bypass a red check.

## 6. Pull the merged code and restart

After GitHub confirms merge:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch to main failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Merged application startup failed." }
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Backlog register invalid." }
```

Keep application volumes. Old-API rollback ignores suspension flags, so prefer a forward repair and restrict external exposure if repair is required. Broader IDN-011 stays in progress until privileged/permanent lifecycle requirements are met. Next security work: privileged MFA/recovery and remaining public-endpoint abuse controls; product/provider/branding work stays in the groomed roadmap.
