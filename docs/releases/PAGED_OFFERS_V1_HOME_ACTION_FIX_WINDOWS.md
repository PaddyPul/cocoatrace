# Apply the summary correction on the existing feature branch

The correction changes one browser test locator only. The supplier action card's accessible name starts with its title, Review the new buyer offer, and includes its descriptive copy; Review offer is hover text rather than the entire accessible name. The test now locates the card by its title within supplier-path and verifies clicking it opens Offers with full aggregate totals. No application, permission, migration, dependency or data change.

Author browser type checks and quality checks pass. Browser execution is unavailable here; rerun the full release on your PC before merging.

Download bettertrade-paged-offers-v1-home-action-fix.bundle into Downloads. Stay on feat/paged-offers-v1. Run each block and stop at errors. Preserve local Compose overrides.

## 1. Confirm current branch and tracked changes

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git branch --show-current
git status
if ((git branch --show-current) -ne "feat/paged-offers-v1") { throw "Stop: expected the existing evidence-selection feature branch." }
if (git status --porcelain --untracked-files=no) { throw "Stop: preserve/review tracked changes first." }
```

## 2. Fetch and apply only the correction tip

```powershell
$bundle = "$env:USERPROFILE\Downloads\bettertrade-paged-offers-v1-home-action-fix.bundle"
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/paged-offers-home-action-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/paged-offers-home-action-fix
if ($LASTEXITCODE -ne 0) { throw "Correction did not apply cleanly. Stop and send git status." }
git log -3 --oneline
git status
```

## 3. Run the complete automated release

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first failing test." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

If it fails, send the specific failure, not only the final report. Do not weaken the gate or reset data. No lengthy manual journey is required for this fixture correction.

## 4. Push the same feature branch and create/update its PR

```powershell
git push -u origin feat/paged-offers-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/paged-offers-v1?expand=1"
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
