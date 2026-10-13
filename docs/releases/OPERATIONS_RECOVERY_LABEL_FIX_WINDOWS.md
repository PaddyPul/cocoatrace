# Operations recovery label correction — Windows

Download **bettertrade-operations-recovery-label-fix.bundle** into Downloads. Apply this correction on your existing **feat/operations-worker-status-v1** branch. It fixes the recovery textarea's exact label after a React refresh and strengthens the browser case to cover successful and failed refreshes. No database or worker changes.

## Apply the correction

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before continuing." }
git switch feat/operations-worker-status-v1
if ($LASTEXITCODE -ne 0) { throw "Feature switch failed. Stop and send git status." }
$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-operations-recovery-label-fix.bundle"
if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/operations-recovery-label-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/operations-recovery-label-fix
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
git log -3 --oneline
git status
```

Only cherry-pick the tip. Do not merge the bundle history or add your untracked Compose/output files.

## Verify the corrected candidate

No dependency changes; keep the existing npm installation. Docker Desktop must be running.

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
```

## Push, PR, merge and pull

Only after the exact corrected candidate passes:

```powershell
git push -u origin feat/operations-worker-status-v1
if ($LASTEXITCODE -ne 0) { throw "Feature push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/operations-worker-status-v1"
```

Use/update the same feature PR. Title: **Schedule bounded operations and add audited cleanup recovery**. Replace its body with **OPERATIONS_WORKER_STATUS_V1_PR.md**, supplied with this correction. Mark native/E2E checked after the full release passes and record the candidate SHA/result. Wait for required CI checks before merging; leave hosted and broad backlog completion unchecked.

After merging:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed. Send output; do not reset the database." }
Start-Process "http://localhost:3000"
```

The feature's migration still applies automatically before startup. This correction introduces no migration. Author checks: quality, browser type checks and web production build; browser runtime acceptance remains yours through the full automated release. No manual business journey is required.
