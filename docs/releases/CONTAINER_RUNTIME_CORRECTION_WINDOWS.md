# Container runtime correction: Windows

Apply on the existing unmerged feat/container-security-v1 branch. Do not switch to main or merge the original failing branch first. Save cocoatrace-container-runtime-fix.bundle in Downloads. Keep Docker Desktop running. No data/evidence reset is needed; do not apply old stashes.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch feat/container-security-v1
if ($LASTEXITCODE -ne 0) { throw "Branch switch failed." }
git status
```

Stop for tracked modifications. Local untracked Compose overrides can remain. Then:

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-container-runtime-fix.bundle" "HEAD:refs/remotes/bundle/container-runtime-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/container-runtime-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop here." }
npm run check:containers
if ($LASTEXITCODE -ne 0) { throw "Image checks failed. Stop here." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

Application dependencies are unchanged; no npm install or forced audit fix is needed. The image check rebuilds changed API layers and scans both images again. It must pass; no CVE ignore is added. The full release repeats the image check (cached builds) and continues through native migration, database, browser and recovery checks.

If the scan fails, send the error and Get-Content ".\container-test-results\summary.json" -Raw. Findings now include scanner target/package paths when provided. Actual image rescan was unavailable in the authoring environment.

After the full release passes:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
git status
git push -u origin feat/container-security-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/container-security-v1?expand=1"
```

Create/update the existing PR against main. Wait for all CI checks to pass, then merge. Pull and restart:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "Install failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
git status
```

## Maintenance commands after this correction

npm/npx/Yarn/Corepack no longer ship inside the API container. They remain on your PC. Tracked demo/browser/recovery container commands were updated. An old local override with npx tsx must use node --import tsx instead. Use the supported direct commands inside the container:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api node --import tsx api/scripts/reconcile-trades.ts
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api node --import tsx api/scripts/scan-pending-evidence.ts
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api node --import tsx api/scripts/deliver-payment-reminders.ts
```

Run these only when performing the corresponding maintenance task; they are not extra acceptance tests for this patch.
