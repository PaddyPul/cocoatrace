# Privileged access lifecycle v1 — complete Windows handoff

Apply after privileged passkeys and both browser corrections have merged. This wave adds a reviewed operator console, not another public administration endpoint. No migration, dependency change or data reset is required. All existing UI/browser journeys remain automated.

## 1. Download and synchronize main

Download `bettertrade-privileged-access-lifecycle-v1.bundle` to Downloads. Run blocks one at a time in PowerShell; stop on any failure. Local untracked Compose files, browser logs and stashes are not part of this commit and must remain untouched.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before switching branches." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main pull failed." }
git switch -c feat/privileged-access-lifecycle-v1
if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop; do not overwrite an existing branch." }
```

## 2. Apply only the bundle's new feature commit

```powershell
git bundle verify "$env:USERPROFILE\Downloads\bettertrade-privileged-access-lifecycle-v1.bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$env:USERPROFILE\Downloads\bettertrade-privileged-access-lifecycle-v1.bundle" "HEAD:refs/remotes/bundle/privileged-access-lifecycle-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/privileged-access-lifecycle-v1
if ($LASTEXITCODE -ne 0) { throw "Bundle application failed. Stop and send the output." }
git log -2 --oneline
git status
```

Newest message: `feat: add two-reviewer privileged access lifecycle`. Cherry-picking only the tip accommodates GitHub's merge/cherry-pick history. Do not merge the bundle's whole author history or reapply prior passkey commits.

## 3. Automated acceptance

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
git status
```

Use the supported Node version; Node 24 is the current local rehearsal choice. The integration gate includes 12 new real-PostgreSQL lifecycle cases; browser suspension/passkey/identity journeys run unchanged. No new long manual checklist is needed. Author-side native Docker is unavailable, so green local/CI release checks are mandatory. Do not bypass a red security gate. If npm changes tracked files unexpectedly, inspect them instead of adding everything.

## 4. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Keep localhost consistent for passkeys. The account-access screen now explains protected-account two-reviewer review. Do not disable/recover actual accounts just to smoke-test; automated disposable fixtures cover the decisions. The operator procedure is in `docs/runbooks/PRIVILEGED_ACCESS_LIFECYCLE.md`; it requires consenting independent reviewer tokens via secret stdin, never PRs/chat/CLI arguments.

## 5. Push and open the PR

```powershell
git push -u origin feat/privileged-access-lifecycle-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/privileged-access-lifecycle-v1?expand=1"
```

Base `main`; compare `feat/privileged-access-lifecycle-v1`. Use the exact title/description in `docs/releases/PRIVILEGED_ACCESS_LIFECYCLE_V1_PR.md`. Record the tested SHA and release report; tick native database/browser verification only after it passes. Wait for required GitHub checks, then merge. If GitHub reports a conflict or failed check, stop and send its specific output. Do not force-push or choose entire files blindly to resolve conflicts.

## 6. Pull the merged commit and restart

After GitHub confirms the PR is merged:

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

Report that release checks passed and merge/pull completed. No volume deletion, seeding, stash restoration or cleanup of local Compose overrides is required. Privileged bootstrap/recovery operation with insufficient reviewers, live hosting, physical-device verification and real alert delivery remain separate pilot work.
