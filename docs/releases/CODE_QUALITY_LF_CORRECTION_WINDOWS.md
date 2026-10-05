# Windows LF checkout correction

Continue on the existing unmerged `feat/code-quality-gates-v1` branch. Save the correction bundle in Downloads. No dependency changes or database reset are involved.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch feat/code-quality-gates-v1
git fetch "$env:USERPROFILE\Downloads\cocoatrace-code-quality-gates-lf-fix.bundle" "HEAD:refs/remotes/bundle/code-quality-gates-lf-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/code-quality-gates-lf-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop here." }
npm run format:fix
if ($LASTEXITCODE -ne 0) { throw "Formatting failed." }
git status
npm run check:quality
if ($LASTEXITCODE -ne 0) { throw "Quality checks failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed." }
```

The scoped format command converts existing checkout bytes to LF; Git attributes enforce LF on future checkouts. Tracked files should be clean afterwards. Leave local Compose overrides untracked. If tracked changes remain, share `git diff --stat` rather than committing them blindly. Do not globally renormalize frozen migrations.

After passing release checks:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
git push -u origin feat/code-quality-gates-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/code-quality-gates-v1?expand=1"
```

Create the PR with base main. Wait for all CI checks, merge, then:

```powershell
git switch main
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
```

Dependency vulnerabilities remain open under SEC-014. Do not run npm audit fix --force as part of this correction.
