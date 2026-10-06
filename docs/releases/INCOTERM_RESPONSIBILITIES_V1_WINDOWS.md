# Incoterm responsibilities — full Windows handoff

Your access-suspension/restoration work is confirmed merged. Apply this new wave to updated main. All-term milestone policy changes are in one bundle-tip commit; cherry-pick only that tip because author/founder histories differ.

No database migration or reset. Leave local untracked Compose files and existing stashes alone. Do not use `git add .`, force-push, delete volumes or suppress failing release checks. Docker Desktop must be running.

## 1. Download and apply

Download `bettertrade-incoterm-responsibilities-v1.bundle` into Downloads. Open PowerShell in your existing repository:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Cannot inspect working tree." }
if ($trackedChanges) { throw "Preserve tracked changes before continuing." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to main. Stop." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Cannot update main. Stop." }
git switch -c feat/incoterm-responsibilities-v1
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Do not recreate an existing branch; send git status." }
$tradeBundle = "$env:USERPROFILE\Downloads\bettertrade-incoterm-responsibilities-v1.bundle"
if (-not (Test-Path $tradeBundle)) { throw "Bundle missing from Downloads." }
git bundle verify $tradeBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $tradeBundle "HEAD:refs/remotes/bundle/incoterm-responsibilities-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
$tradeTip = git rev-parse bundle/incoterm-responsibilities-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve bundle tip." }
git show --stat --oneline $tradeTip
git cherry-pick $tradeTip
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop and send git status; do not choose all ours/theirs." }
git log -3 --oneline
git status
```

## 2. Automated tests

No long manual trade checklist is required. The release includes PostgreSQL action matrices and existing real-account browser journeys with corrected FOB roles and selector restrictions. First run the fast checks, then the complete release:

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run check:quality
if ($LASTEXITCODE -ne 0) { throw "Quality checks failed. Stop." }
npm run test --workspace=api -- --run src/modules/transport/responsibilities.test.ts src/services/tradeNextAction.test.ts
if ($LASTEXITCODE -ne 0) { throw "Transport policy/dashboard tests failed. Stop." }
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog tests failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge and send the first specific failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
```

Use your supported Node 24 installation. The author ran unit/quality/type/build checks, but has no Docker/PostgreSQL; the complete native release must pass here. If advisories change, send their report rather than running `npm audit fix --force`. Optional diagnostics after a failure: `Get-Content ".\release-test-results\summary.json" -Raw`; the first specific test/error is more useful than the final npm failure. Do not rerun everything repeatedly before diagnosing a failure.

## 3. Start the application after green release

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 40
Start-Process "http://localhost:3000"
```

Optional short visual check: on an FOB shipment buyer sees booking/provider details and cannot select Cargo Ready or Origin Loading; seller can confirm origin readiness/loading and cannot select departure/arrival or receipt. Departure switches to buyer. DDP import clearance and DPU unloading belong to seller. Buyer receipt remains separate from acceptance. Existing shipments missing correctly attributed origin events can be blocked; do not fabricate historical events. See the runbook for reviewed remediation limits.

## 4. Push and open the PR

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Unexpected tracked changes; review before pushing." }
git push -u origin feat/incoterm-responsibilities-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/incoterm-responsibilities-v1?expand=1"
Get-Content ".\docs\releases\INCOTERM_RESPONSIBILITIES_V1_PR.md" -Raw
```

Base `main`, compare `feat/incoterm-responsibilities-v1`. Title: **Enforce buyer/seller transport responsibilities for all 11 Incoterms**.

Replace the default PR description with the exact body in `docs/releases/INCOTERM_RESPONSIBILITIES_V1_PR.md` (below its “PR description” heading). After successful native release, tick the database/API and E2E boxes and add your tested commit (`git rev-parse HEAD`), release result and CI link. Leave staging unchecked until actually tested in hosted staging. Do not claim LOG-001 fully closed: exact named places, modes and domestic policies remain.

Create the PR. Wait for required GitHub checks to pass, review the changes and use **Merge pull request**, then **Confirm merge**. Do not merge a red release gate. No need to push main manually.

## 5. Pull the merged code and restart

Run only after GitHub confirms the PR is merged:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to main." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Keep this branch if you want the review history; deleting it is optional. Tell me when the release and merge are complete so the backlog evidence can be updated.
