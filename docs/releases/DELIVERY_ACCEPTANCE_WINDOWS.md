# Delivery acceptance v1 — Windows apply and release

Download cocoatrace-delivery-acceptance-v1.bundle into Downloads.
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
git fetch "$env:USERPROFILE\Downloads\cocoatrace-delivery-acceptance-v1.bundle" "HEAD:refs/remotes/bundle/delivery-acceptance-v1"
git switch -c feat/delivery-acceptance-v1 origin/main
git cherry-pick bundle/delivery-acceptance-v1
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

The normal API startup applies migration 026. Existing data remains. Open delivered deals
now show buyer inspection/acceptance in the deal room; historical completed deals stay closed.
If you prefer to inspect the new behavior manually, use one delivered test deal: buyer
accepts the exact quantity, or reports a discrepancy with an actual PDF/JPEG/PNG; supplier
proposes a resolution, buyer approves then separately accepts after replacement. Automated
browser tests already exercise these actions.

## 5. Push and create the pull request

```powershell
git status
git push -u origin feat/delivery-acceptance-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/delivery-acceptance-v1?expand=1"
```

Create a pull request titled **Require buyer delivery acceptance before trade settlement**.
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
git branch -d feat/delivery-acceptance-v1
```

If Git refuses deletion after a squash merge, keep the local branch; no force deletion is needed.
