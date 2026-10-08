# Product register paging — full Windows instructions

Download bettertrade-product-profile-pages-v1.bundle to Downloads. This pages the authenticated product register; public product detail histories, recall collections, exports and hosted load acceptance stay open. No migration/configuration/dependency change or database reset. Existing product party scope and explicit product_profile.read.all control visibility. The legacy register rejects overflow above 1,000; the UI uses pages. Evidence counts now describe metadata records, not approval. Retained recall holds cannot present a clear safety badge. Run each block in PowerShell and stop at any error. Preserve local Compose overrides and stashes.

## 1. Sync accepted main

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
if (git status --porcelain --untracked-files=no) { throw "Stop: preserve/review tracked changes first." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
```

Untracked local docker-compose.real-flow files may remain; do not add them to the feature commit.

## 2. Verify and fetch bundle; create the feature branch

```powershell
$bundle = "$env:USERPROFILE\Downloads\bettertrade-product-profile-pages-v1.bundle"
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/product-profile-pages-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/product-profile-pages-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop; do not delete an existing branch." }
git cherry-pick bundle/product-profile-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and send git status." }
git log -3 --oneline
git status
```

Cherry-pick only the bundle tip; do not merge its full history or reapply previous bundles.

## 3. Install and run automated release checks

Ensure Docker Desktop is running. No lengthy manual test is required for this slice; the release includes the new product register native/browser tests and existing real trade journeys.

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

Author checks passed: 588 API units/72 files, quality, workspace/browser types, native test-source compilation and builds. Native Docker/PostgreSQL/browser execution is unavailable in the author environment. Your exact-candidate release gate is required. If installation changes tracked files, review them before committing and rerun release on the final commit; do not force an audit update or discard files blindly.

## 4. Push and open/update PR

```powershell
git push -u origin feat/product-profile-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/product-profile-pages-v1?expand=1"
```

Use bettertrade-product-profile-pages-v1-PR.md for the complete title/description. Add your tested SHA and release/CI results. Mark native integration/browser boxes only after pass. Base main, compare feat/product-profile-pages-v1. Wait for required GitHub checks, then merge. If conflict resolution changes the candidate, rerun release on that commit before merging.

## 5. Pull merged main and start app

Only after GitHub confirms merge:

```powershell
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Optional brief visual check: open Products, search a lot and navigate product pages. The totals remain full scoped counts. Evidence counts say recorded; missing origin is explicit; a retained recall hold shows a safety hold. Automated tests cover this slice, so no lengthy manual matrix is required. Public product detail views and trade transactions remain separate.

Tell me release checks passed and merge/pull completed. Next: public product detail histories, recall collections and exports. PER-001/ARC-024 remain IN PROGRESS.
