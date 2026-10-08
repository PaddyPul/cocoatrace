# Product register correction — Windows migration test timing

Download bettertrade-product-profile-pages-v1-timeout.bundle to Downloads. Stay on feat/product-profile-pages-v1; do not reapply the original bundle or switch to main yet. This changes only test timing/error diagnostics and release documentation. It does not change migration hashes, application behavior or data.

## 1. Apply the correction on the existing branch

Run each block in PowerShell; stop on an error.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
if (git status --porcelain --untracked-files=no) { throw "Stop: preserve/review tracked changes before applying." }
git switch feat/product-profile-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Feature switch failed. Stop." }
$bundle = "$env:USERPROFILE\Downloads\bettertrade-product-profile-pages-v1-timeout.bundle"
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/product-profile-pages-v1-timeout"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/product-profile-pages-v1-timeout
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop and send git status." }
git log -3 --oneline
git status
```

Cherry-pick only the correction tip, never merge the entire bundle history. Preserve untracked Compose files and existing stashes.

## 2. Run the focused check, then full release

No dependency reinstall or database reset is needed. Ensure Docker Desktop is running.

```powershell
npm run test --workspace=api -- --run src/testing/migrationIntegrity.test.ts
if ($LASTEXITCODE -ne 0) { throw "Focused migration integrity test failed. Stop and send its failure." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

The five integrity assertions remain unchanged: valid baseline, CRLF equivalence, tampering rejection, renamed/missing migration rejection and new migration registration. Only this suite/hooks receive 30 seconds; checker processes have a 15-second cap and explicit startup/timeout error. Global unit timeouts are unchanged. Author full 588 units and API type checks/quality pass; Windows/Docker exact-candidate verification remains required.

## 3. Push and create/update the existing feature PR

Only after the release passes for the current commit:

```powershell
git push -u origin feat/product-profile-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/product-profile-pages-v1?expand=1"
```

Use bettertrade-product-profile-pages-v1-timeout-PR.md for the complete replacement PR title/description. Add your tested SHA/results and mark native/browser boxes after pass. Base main, compare feat/product-profile-pages-v1. Wait for required GitHub checks, then merge. If conflict resolution changes the candidate, rerun release for that final commit.

## 4. Pull merged main and start app

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

No extra manual persona matrix is needed for this test correction. Report release checks passed and merge/pull completed; product register acceptance remains pending until then.
