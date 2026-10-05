# Dependency-security wave: Windows instructions

Start from clean main after the code-quality/LF correction merge. Save `cocoatrace-dependency-security-v1.bundle` in Downloads. No database reset, reseed or extra manual trade test is required. Node 24.21 is supported.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch main
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
```

Preserve any tracked changes before proceeding. Local Compose overrides remain untracked.

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-dependency-security-v1.bundle" "HEAD:refs/remotes/bundle/dependency-security-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git switch -c feat/dependency-security-v1 origin/main
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed." }
git cherry-pick bundle/dependency-security-v1
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Stop and share git status." }
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
git status
```

The release includes new advisory-policy regressions and audits plus existing migration, native integration, browser journeys and restore tests. Internet access to the npm audit registry is required; network failures fail closed. To diagnose an audit failure, run `npm run check:dependencies` and read `dependency-test-results/summary.json`. A fresh upstream advisory can block a previously passing commit.

Npm may still print high findings from one unpatched braces/build-tool advisory and its parent packages. The reviewed gate permits only that exact development-only package/version until 2026-11-05; production findings and any other advisory fail. See `runbooks/DEPENDENCY_SECURITY.md`. Do not run npm audit fix --force. Container/OS scanning remains separate backlog work.

After all release checks pass:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
git push -u origin feat/dependency-security-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/dependency-security-v1?expand=1"
```

Create the PR with base main, title `Patch vulnerable dependencies and enforce advisory review`. Wait for all CI checks, merge, then:

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

Share the failed gate output if anything fails; do not push/merge a failing release or include local Compose overrides in the PR.
