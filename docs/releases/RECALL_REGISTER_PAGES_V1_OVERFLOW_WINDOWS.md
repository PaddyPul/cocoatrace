# Recall register correction — legacy inventory and transfer overflow preflight

Download bettertrade-recall-register-pages-v1-overflow.bundle to Downloads. Stay on feat/recall-register-pages-v1; do not reapply the original bundle or switch to main yet. This rejects oversized legacy inventory/transfer lists before expensive recall projection. Small lists keep scoped recall details. Read deadlines are unchanged. No migration, dependency change or database reset is required.

## 1. Apply the correction on the existing branch

Run each block in PowerShell; stop on an error.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
if (git status --porcelain --untracked-files=no) { throw "Stop: preserve/review tracked changes before applying." }
git switch feat/recall-register-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Feature switch failed. Stop." }
$bundle = "$env:USERPROFILE\Downloads\bettertrade-recall-register-pages-v1-overflow.bundle"
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/recall-register-pages-v1-overflow"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/recall-register-pages-v1-overflow
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop and send git status." }
git log -3 --oneline
git status
```

Cherry-pick only the correction tip, never merge the entire bundle history. Preserve untracked Compose files and existing stashes.

## 2. Rerun the full release

Ensure Docker Desktop is running. No reinstall or data reset is required. The previous browser failures still make that report a failed release. The existing native overflow regressions must still return 422/CATALOG_READ_LIMIT; this correction does not accept timeout responses as successful tests.

First run integration alone to check the reported failure without repeating earlier gates:

```powershell
npm run test:integration:docker
if ($LASTEXITCODE -ne 0) { throw "Integration failed. Stop and send the first specific failing test." }
```

Then run all release gates:

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

Author quality checks, API type checks/build and all 601 API unit tests in 73 files pass. Native Docker/browser execution is unavailable here; your full exact-candidate release report is required.

## 3. Push and create/update the existing feature PR

Only after the release passes for the current commit:

```powershell
git push -u origin feat/recall-register-pages-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/recall-register-pages-v1?expand=1"
```

Use bettertrade-recall-register-pages-v1-overflow-PR.md for the complete replacement PR title/description. Add your tested SHA/results and mark native/browser boxes after pass. Base main, compare feat/recall-register-pages-v1. Wait for required GitHub checks, then merge. If conflict resolution changes the candidate, rerun release for that final commit.

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

No extra manual persona matrix is needed for this correction. Report release checks passed and merge/pull completed; recall register acceptance remains pending until then.
