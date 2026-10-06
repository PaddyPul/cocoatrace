# BetterTrade backlog grooming — Windows handoff

This bundle changes plans, backlog tracking and its read-only CI test. It does not implement providers or rename database/runtime resources. Keep the existing repository folder, remote and Compose project names.

## Before applying

Finish the existing language-label correction first if it has not passed and merged. The grooming audit deliberately leaves language work partial; do not infer that it fixed the selector failure. Follow LANGUAGE_FOUNDATION_WINDOWS.md / the previously supplied label-fix commands, then on your language branch:

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Existing language release failed. Stop and send the first failure." }
git push -u origin feat/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Language push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/language-foundation-v1?expand=1"
```

Use LANGUAGE_FOUNDATION_PR.md for that separate PR. Wait for CI, merge it on GitHub, then continue below. If that correction is already tested and merged, skip the prerequisite. Do not merge a failing release merely to apply a planning document.

## 1. Check and synchronize main

Download `bettertrade-pilot-grooming-v1.bundle` to Downloads. Run each block in PowerShell; stop if a guard fails.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Status failed." }
if ($trackedChanges) { throw "Tracked local changes exist. Preserve/review them before continuing." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Could not switch to main. Stop." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed. Stop." }
git status
```

Your two local `docker-compose.real-flow.yml` files may remain untracked; do not add them or secrets to this PR. If Git blocks checkout because of an untracked file, preserve it and stop for targeted instructions. Never use reset/clean to bypass the message.

## 2. Verify and import the bundle

```powershell
$groomingBundle = "$env:USERPROFILE\Downloads\bettertrade-pilot-grooming-v1.bundle"
if (-not (Test-Path $groomingBundle)) { throw "Bundle is not in Downloads." }
git bundle verify $groomingBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $groomingBundle "HEAD:refs/remotes/bundle/bettertrade-pilot-grooming-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c docs/bettertrade-pilot-grooming-v1
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed; stop rather than resetting an existing branch." }
$groomingTip = git rev-parse bundle/bettertrade-pilot-grooming-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve bundle tip." }
git show --stat --oneline $groomingTip
git cherry-pick $groomingTip
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and send git status; do not choose ours/theirs for every file." }
git status
git log -3 --oneline
```

Cherry-pick only the tip. Do not merge the authoring bundle's full history into your GitHub history. The tip contains documentation, the progress script/tests and CI/config paths only; no api/src or web/src changes. If already applied, do not force another copy.

## 3. Test the planning change

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run check:quality
if ($LASTEXITCODE -ne 0) { throw "Quality checks failed. Stop." }
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog register test failed. Stop." }
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Progress register invalid. Stop." }
git diff --check
if ($LASTEXITCODE -ne 0) { throw "Whitespace check failed." }
git status
```

Expected closure counts: roadmap 69/342 (20.2%); core pilot 7/28 (25%); additional provider gates 0/12 (0%); provider launch including core 7/40 (17.5%). If these change, inspect the changed register/rows rather than editing percentages manually.

This bundle needs no long manual trade test. It has no application/schema/dependency changes. Full release testing remains required for the preceding language correction and normal application changes. Optional complete baseline verification:

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop and send the first failing gate plus summary." }
```

Read docs/BETTERTRADE_PILOT_PLAN.md and docs/BETTERTRADE_SERVICE_MARKETPLACE.md. The new name appears in plans; the running app still uses existing runtime identifiers until BRD implementation.

## 4. Start the application if desired

No restart is needed to read the backlog. To use your existing local captured-email setup:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Do not run `down -v`; that deletes volumes. This command starts local development/test infrastructure, not a real-data production deployment.

## 5. Push the branch

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Unexpected tracked changes. Review them before pushing." }
git push -u origin docs/bettertrade-pilot-grooming-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...docs/bettertrade-pilot-grooming-v1?expand=1"
```

## 6. Create and merge the pull request

Base `main`, compare `docs/bettertrade-pilot-grooming-v1`. Use the exact title and complete description in BETTERTRADE_PILOT_GROOMING_PR.md. Replace the repository's generic template. Update verification only with checks actually run. Wait for all required CI checks and resolved review comments, then click Merge pull request and confirm. Do not bypass red CI.

## 7. Pull the merged result and retain your local application

Only after GitHub confirms merging:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Merged backlog invalid." }
```

No application rebuild is needed for planning-only changes. If you want to start it, use step 4. Do not apply or drop the old formatting stash unless separately reviewed. No new dependency upgrades, secret edits, account creation or database repair is required here.

Next implementation queue: security boundary closure, then coherent supplier/sourcing/shared trade actions, then monitored hosted operations and performance. The provider marketplace starts with approved model/policies and its own three-persona regressions; a runtime mass rename is not the next command.
