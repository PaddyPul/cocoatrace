# Payment terms workflow: Windows

Save cocoatrace-payment-terms-workflow-v1.bundle in Downloads. Start from main after container-security and its correction are merged. Keep Docker Desktop running. Preserve tracked changes first; local untracked Compose overrides may remain. Do not apply old formatting stashes or reset storage.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
```

With no tracked modifications:

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-payment-terms-workflow-v1.bundle" "HEAD:refs/remotes/bundle/payment-terms-workflow-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c refactor/payment-terms-workflow-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed." }
git cherry-pick bundle/payment-terms-workflow-v1
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop here." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

No dependency changes: npm ci is unnecessary when the preceding merged version was installed. Existing automated browser journeys cover payment plans; no long manual regression checklist is needed. Native release verification remains required. If a gate fails, send its terminal error and Get-Content ".\release-test-results\summary.json" -Raw.

After checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
git status
git push -u origin refactor/payment-terms-workflow-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...refactor/payment-terms-workflow-v1?expand=1"
```

Use the title/description in PAYMENT_TERMS_WORKFLOW_PR.md. Mark native verification boxes only after checks pass. Wait for all CI checks, merge, then:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
git status
```
