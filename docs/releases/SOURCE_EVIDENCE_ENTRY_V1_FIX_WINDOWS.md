# Source and evidence entry correction — full Windows instructions

This wave shares the conventional inventory/source-farm chooser across supplier entry points and replaces raw record-ID uploads with permitted record selection, document purpose and explanation. It adds four automated browser cases for direct inventory, source/plot/harvest, evidence onboarding/error handling and edited sourcing persistence. No migration, dependency change or data reset is required.

Run each block in PowerShell, in order. Do not continue after a failed command. Your local untracked Compose overrides, logs and saved stashes stay untouched.

## 1. Apply the correction on your existing feature branch

Download `bettertrade-source-evidence-entry-v1-fix.bundle` into Downloads. The earlier feature bundle must already be applied. Do not reapply it or switch to main before this correction.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before applying." }
if ((git branch --show-current) -ne "feat/source-evidence-entry-v1") { throw "Stop: expected the existing source-evidence feature branch." }
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-source-evidence-entry-v1-fix.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-source-evidence-entry-v1-fix.bundle" "HEAD:refs/remotes/bundle/source-evidence-entry-v1-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/source-evidence-entry-v1-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop and send the output." }
git log -2 --oneline
```

Only cherry-pick the tip correction, whose message is `fix: restore supply setup icon import`. Do not merge author history.

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

The release command runs all existing gates and the four new cases in `e2e/sourceEvidenceEntry.spec.ts`. These automate the repeated setup checks; no long manual checklist is required. Existing tenant-isolation, private upload/scanning and trade tests remain mandatory.

Author-side Docker is unavailable. Author unit/build/type/quality checks do not substitute for your native release gate. A green report must match the exact candidate commit. If npm changes tracked files, inspect those changes before committing; never add local Compose overrides or reports containing credentials.

## 4. Start the application

Only after release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Optional visual check: a new supplier's empty publication screen offers **Create inventory** and **Register source**. Evidence onboarding asks for a record before showing the file picker. Farm/batch **Add supporting evidence** preselects that record. The four automated cases cover the long setup journeys. Do not reset or reseed your application database.

## 5. Push and create the PR

```powershell
git push -u origin feat/source-evidence-entry-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/source-evidence-entry-v1?expand=1"
```

Base: `main`. Compare: `feat/source-evidence-entry-v1`.

Use the title and complete description from `docs/releases/SOURCE_EVIDENCE_ENTRY_V1_PR.md`, replacing the default template. After your release run passes, check the database/API and browser verification boxes and attach the tested SHA/report or CI URL. Do not claim hosted staging verification unless it occurred.

## 6. Merge on GitHub

Wait for required GitHub checks. Review the diff, confirm the correct base/branch and release report, then select **Merge pull request** and **Confirm merge** (or the repository's configured merge option).

If checks fail or GitHub reports a conflict, stop and send the specific output. Do not force-push or pick entire conflicting files blindly. PRD-003, PRD-004 and QLT-009 remain partial until native acceptance and their remaining criteria are assessed. The previous PRD-006 completion is already acknowledged.

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

Tell me release checks passed and merge/pull completed. That acknowledgement records acceptance of this candidate; request-specific evidence guidance and saved-brief editing still require follow-up. Hosted operations, performance acceptance and the logistics-provider marketplace remain separate. No volume deletion, stash restoration or cleanup of local override files is needed.
