# Container-security wave: Windows

Start on clean main after dependency-security merged. Save cocoatrace-container-security-v1.bundle in Downloads. Keep Docker Desktop running in Linux-container mode. No database reset or reseed is required.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
```

Only local untracked Compose overrides should remain. Preserve tracked changes before proceeding; do not apply old stashes to this branch automatically.

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-container-security-v1.bundle" "HEAD:refs/remotes/bundle/container-security-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/container-security-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed." }
git cherry-pick bundle/container-security-v1
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop here." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "Install failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
git status
```

The release now builds fresh production images, checks runtime dependencies/non-root execution and scans OS/library packages before existing migration/integration/browser/recovery gates. It downloads Node 24, unprivileged Nginx and Trivy images plus a vulnerability database on the first run. No paid service is activated. Future scans reuse the public database cache. A download, startup or CVE failure is a failed check, not a reason to merge.

If image checks fail, send the relevant terminal error and:

```powershell
Get-Content ".\container-test-results\summary.json" -Raw
```

Do not rerun the entire suite repeatedly to diagnose one image failure. Once corrected, `npm run check:containers` isolates that gate. High/critical/unknown and unfixed findings block; no broad ignore list is supplied. Actual scan results were not available in the authoring environment and must pass here or in CI.

After all checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
git push -u origin feat/container-security-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/container-security-v1?expand=1"
```

Create the PR against main titled `Reduce runtime images and enforce container security scans`. Wait for all CI checks, merge, then:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "Install failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
```

This release leaves application storage volumes intact. Container scanner caches and temporary scan-image tags are separate from your application Compose project.
