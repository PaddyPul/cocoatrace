# Payment reminder audit correction — Windows

Save cocoatrace-payment-reminders-audit-fix.bundle in Downloads. Stay on the existing unmerged feat/payment-reminders-v1 branch. Stop on failures; do not reset data.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch feat/payment-reminders-v1
git fetch "$env:USERPROFILE\Downloads\cocoatrace-payment-reminders-audit-fix.bundle" "HEAD:refs/remotes/bundle/payment-reminders-audit-fix"
git cherry-pick bundle/payment-reminders-audit-fix
git status
```

Tracked files must be clean before cherry-picking. If conflicts occur, stop and share git status.

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

Only after all gates pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
Start-Process "http://localhost:8025"
git push -u origin feat/payment-reminders-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/payment-reminders-v1?expand=1"
```

Create or update the PR, wait for green GitHub checks, then merge it. Finally:

```powershell
git switch main
git pull --ff-only origin main
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
```

No new migration or dependencies are introduced. Local email is captured in Mailpit, not a personal inbox. Full automated testing replaces another long manual checklist.
