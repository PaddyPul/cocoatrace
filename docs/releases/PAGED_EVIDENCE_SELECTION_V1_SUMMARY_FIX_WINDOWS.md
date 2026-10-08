# Apply the summary correction on the existing feature branch

The founder release run passed 279/280 integration tests. A holdings summary assertion received no available_count; its HTTP status was not captured. This correction groups tenant holdings by batch and materializes one unchanged recall assessment per batch instead of repeating it twice per holding. It also adds safe status/error-code diagnostics to summary assertions. The exact original error is not established; native release acceptance remains required. No migration, seed, timeout increase or dependency change.

Author: 523 API unit tests pass, quality checks pass, workspace/browser types and API build checked. Docker/PostgreSQL/browser execution is unavailable in the author environment.

Download bettertrade-paged-evidence-selection-v1-summary-fix.bundle into Downloads. Run each block in PowerShell; stop at any error. Keep the current feature branch and local Compose overrides. Do not apply the old bundle again.

## 1. Confirm current branch and tracked changes

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git branch --show-current
git status
if ((git branch --show-current) -ne "feat/paged-evidence-selection-v1") { throw "Stop: expected the existing evidence-selection feature branch." }
if (git status --porcelain --untracked-files=no) { throw "Stop: preserve/review tracked changes first." }
```

## 2. Fetch and apply only the correction tip

```powershell
$bundle = "$env:USERPROFILE\Downloads\bettertrade-paged-evidence-selection-v1-summary-fix.bundle"
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/evidence-selection-summary-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/evidence-selection-summary-fix
if ($LASTEXITCODE -ne 0) { throw "Correction did not apply cleanly. Stop and send git status." }
git log -3 --oneline
git status
```

## 3. Run the complete automated release

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first failing test including HTTP/code diagnostic." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

If it fails, send the specific failure, not only the final report. Do not weaken the gate or reset data. No additional long manual journey is required for this query correction.

## 4. Push the same feature branch and create/update its PR

```powershell
git push -u origin feat/paged-evidence-selection-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/paged-evidence-selection-v1?expand=1"
```

Use the supplied PR title/description. Add your tested SHA and passing report/CI URL; check native integration/browser boxes only after they pass. If the PR already exists, update it. Wait for required GitHub checks, then merge into main. If conflict resolution changes code, rerun the release on that commit before merging.

## 5. After GitHub confirms merge, sync main and start the app

```powershell
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Tell me release checks passed and merge/pull completed. The wider performance/architecture items remain open until their full acceptance criteria are met.
