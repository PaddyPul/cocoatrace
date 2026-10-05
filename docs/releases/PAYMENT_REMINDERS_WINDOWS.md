# Payment due dates and reminders v1 — Windows apply and release

Download cocoatrace-payment-reminders-v1.bundle into Downloads.
Run each block in PowerShell from the repository. Stop on any failed command.
Do not delete volumes or reset the application database.

## 1. Synchronize main

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
```

Tracked files must be clean before applying. Untracked diagnostic logs/local Compose
files may remain; do not add them to the feature commit.

## 2. Apply only this wave's commit

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-payment-reminders-v1.bundle" "HEAD:refs/remotes/bundle/payment-reminders-v1"
git switch -c feat/payment-reminders-v1 origin/main
git cherry-pick bundle/payment-reminders-v1
git status
```

Cherry-pick the bundle tip, rather than merging its complete author-side history.
If cherry-pick reports a conflict, stop and share git status; do not choose all ours/theirs.
No dependencies were added, so npm install is unnecessary.

## 3. Automated release checks

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge." }
```

This runs builds/types, unit checks, migration integrity, fresh/upgrade migrations,
integration tests, browser journeys and the recovery checks configured in the runner.
A long manual trade checklist is not required. Native concurrency checks run in the
Docker PostgreSQL suite; author supplemental PostgreSQL does not substitute for them.

## 4. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

The normal API startup applies migration 027 without resetting data and starts the reminder worker. Due dates and email delivery counts appear in Payment operations. Local captured email can be viewed with:

```powershell
Start-Process "http://localhost:8025"
```

No long manual checklist is needed. Automated tests cover deadlines, duplicate prevention, recipient isolation, dispute pauses and retries. To inspect one bounded worker pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run payments:remind
```

Automatic reminders require more than 24 hours overdue, at most once per UTC day. New payments are not expected to trigger immediate email. Disabled SMTP leaves work queued. Read docs/runbooks/PAYMENT_REMINDERS.md for operational limits.

## 5. Push and create the pull request

```powershell
git status
git push -u origin feat/payment-reminders-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/payment-reminders-v1?expand=1"
```

Create a pull request titled **Activate payment deadlines and durable overdue reminders**.
Wait for all GitHub checks to pass, then merge the pull request on GitHub.

## 6. Pull the merged code and restart

```powershell
git switch main
git pull --ff-only origin main
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
```

Optional after confirming main is clean:

```powershell
git branch -d feat/payment-reminders-v1
```

If Git refuses deletion after a squash merge, keep the local branch; no force deletion is needed.
