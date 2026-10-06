# Unified trade actions v1 — full Windows instructions

This wave makes the dashboard, deal room and contract guidance consume one server-owned next-action policy. It includes role/permission checks, supplier-before-buyer payment terms, payment/document gates, Incoterm handoffs, explicit empty/failure states and automated transition coverage. No migration, dependency change or data reset is required.

Run each block in PowerShell, in order. Do not continue after a failed command. Your local untracked Compose overrides, logs and saved stashes stay untouched.

## 1. Download and update main

Download `bettertrade-unified-trade-actions-v1.bundle` into Downloads.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before switching branches." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main pull failed." }
git switch -c feat/unified-trade-actions-v1
if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Do not overwrite an existing branch." }
```

## 2. Apply the new feature commit

```powershell
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-unified-trade-actions-v1.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-unified-trade-actions-v1.bundle" "HEAD:refs/remotes/bundle/unified-trade-actions-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/unified-trade-actions-v1
if ($LASTEXITCODE -ne 0) { throw "Bundle application failed. Stop and send the conflict/output." }
git log -2 --oneline
git status
```

The newest message should be `feat: unify permitted trade next actions`. Cherry-pick only the tip; do not merge the bundle's author history or reapply earlier security work. Your GitHub merge history can differ from the bundle history.

## 3. Run automated acceptance

Keep Docker Desktop running. Use the supported Node version (Node 24 for the existing local rehearsal).

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
git status
```

The release command runs the existing quality, type, advisory, build, container, migration, native integration, browser and backup/restore gates. The new native API checks compare dashboard and contract actions for both organizations; the new browser journey checks actual displayed guidance through terms, payment verification and FOB handoff. Existing five payment-plan journeys continue to cover end-to-end completion. No long manual trade checklist is required.

Author-side Docker is unavailable. Author unit/build/type/quality checks do not substitute for your native release gate. A green report must match the exact candidate commit. If npm changes tracked files, inspect those changes before committing; never add local Compose overrides or reports containing credentials.

## 4. Start the application

Only after release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

The dashboard and deal room now show the same next-action title. After verified prepayment on FOB, the supplier waits for buyer booking; after booking, cargo preparation belongs to the supplier. Buyer payment references remain separate from seller receipt verification. A completed trade can still have a separate outstanding platform fee.

An optional quick visual check is enough: open an existing deal as each party and compare its dashboard card with its deal-room guidance. Automated fixtures handle the long journeys. Do not reset or reseed your application database.

## 5. Push and create the PR

```powershell
git push -u origin feat/unified-trade-actions-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/unified-trade-actions-v1?expand=1"
```

Base: `main`. Compare: `feat/unified-trade-actions-v1`.

Use the title and complete description from `docs/releases/UNIFIED_TRADE_ACTIONS_V1_PR.md`, replacing the default template. After your release run passes, check the database/API and browser verification boxes and attach the tested SHA/report or CI URL. Do not claim hosted staging verification unless it occurred.

## 6. Merge on GitHub

Wait for required GitHub checks. Review the diff, confirm the correct base/branch and release report, then select **Merge pull request** and **Confirm merge** (or the repository's configured merge option).

If checks fail or GitHub reports a conflict, stop and send the specific output. Do not force-push or pick entire conflicting files blindly. The PRD-006 completion box stays pending until native acceptance and merge are confirmed; PRD-011 remains partial because other platform empty states are separate work.

## 7. Pull merged main and restart

Once GitHub confirms the PR is merged:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Merged main pull failed." }
git status
git log -3 --oneline
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Merged application startup failed." }
Start-Process "http://localhost:3000"
```

Tell me release checks passed and merge/pull completed. That acknowledgement closes the implemented next-action item; it does not close hosted operations, performance acceptance or the logistics-provider marketplace. No volume deletion, stash restoration or cleanup of local override files is needed.
