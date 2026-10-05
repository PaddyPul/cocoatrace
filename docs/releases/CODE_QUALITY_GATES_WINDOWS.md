# Code-quality gates: Windows handoff

Run commands in PowerShell. Stop at any failed command. No database reset or reseeding is required.

## Apply

Save `cocoatrace-code-quality-gates-v1.bundle` in Downloads. Start from your clean, merged main branch:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch main
git pull --ff-only origin main
git status
```

If tracked files are modified, preserve them before continuing. Local Compose overrides should stay local; do not use `git add .`.

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-code-quality-gates-v1.bundle" "HEAD:refs/remotes/bundle/code-quality-gates-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/code-quality-gates-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed." }
git cherry-pick bundle/code-quality-gates-v1
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and share git status." }
```

This applies the single correction commit onto your actual main history. If the branch already exists, stop and inspect it instead of deleting it.

## Install and test

New lint dependencies require a clean install. Use Node 22.13 or newer within Node 22, Node 24+, or Node 20.19+; an older version must be upgraded first. Node 22 is the CI version.

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
git status
```

The release command includes lint, formatting, script-contract/policy checks, API/web/browser types, unit tests, builds, migration checks, native integration, browser journeys and recovery. Full native release results are required before pushing. No lengthy manual journey is requested for this cleanup.

## Start the app

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

## Push and merge

```powershell
git push -u origin feat/code-quality-gates-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/code-quality-gates-v1?expand=1"
```

Create the pull request with base `main`, title `Add incremental code-quality and script-contract gates`, and include the release result. Wait for all GitHub checks, merge the pull request, then run:

```powershell
git switch main
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
```

Report completion only after release tests, CI, merge and main pull succeed. Keep local overrides out of the PR.
