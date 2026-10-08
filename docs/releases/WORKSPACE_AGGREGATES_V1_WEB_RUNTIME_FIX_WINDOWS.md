# Workspace aggregates web runtime correction — Windows

Apply this correction after the marketplace correction on your existing `feat/workspace-aggregates-v1` branch. Do not reapply the original bundle or merge bundle history. Preserve your local Compose overrides and stash. No database reset, migration, dependency upgrade or timeout increase is required.

## 1. Apply the downloaded correction

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch feat/workspace-aggregates-v1
if ($LASTEXITCODE -ne 0) { throw "Branch switch failed. Stop here." }
$trackedChanges = git status --porcelain --untracked-files=no
if ($trackedChanges) { throw "Tracked changes exist. Preserve them before applying the correction." }
$bundle = "$env:USERPROFILE\Downloads\bettertrade-workspace-aggregates-v1-web-runtime-fix.bundle"
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/workspace-aggregates-v1-web-runtime-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/workspace-aggregates-v1-web-runtime-fix
if ($LASTEXITCODE -ne 0) { throw "Correction could not be applied. Stop and send git status." }
git log -3 --oneline
git status
```

Untracked `docker-compose.real-flow.yml` files may remain untracked. Do not add them to this PR.

## 2. Test

Docker Desktop must be running. Dependencies have not changed; use your existing installation.

```powershell
docker info
if ($LASTEXITCODE -ne 0) { throw "Docker is unavailable. Start or restart Docker Desktop and wait for its engine." }
docker pull nginxinc/nginx-unprivileged:stable-alpine-slim
if ($LASTEXITCODE -ne 0) { throw "Image pull failed. Resolve Docker/network connectivity before rerunning." }
npm run test:integration:docker
if ($LASTEXITCODE -ne 0) { throw "Integration failed. Stop and send the first failure, including its response code." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
$candidate = (git rev-parse HEAD).Trim()
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
git status
```

The Docker checks establish engine/registry connectivity. An i/o timeout is an infrastructure failure, not a passed or failed API assertion. Restart Docker Desktop if needed; do not delete app volumes. The integration command checks the repaired native PostgreSQL query and safety cases. The full release then verifies browser journeys, migrations, containers and restore. Author checks passed for the marketplace correction: 563 API unit tests, quality/type checks and API build. This runtime correction additionally passes container runner policy tests and code-quality checks. Native slim image build, non-root/configuration/TIFF absence checks and scan remain pending. Native Docker/PostgreSQL/browser confirmation must come from your run; it was not available in the author environment.

## 3. Push and open/update the PR

Only continue after the exact-candidate release report passes.

```powershell
git push -u origin feat/workspace-aggregates-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/workspace-aggregates-v1?expand=1"
```

If the PR already exists, open it rather than creating a duplicate. Replace its title and description with the supplied PR document. Add the tested commit SHA and release results; check the integration/browser boxes after their pass. Wait for required GitHub CI checks, then click **Merge pull request** and **Confirm merge**. Keep broad PER-001/ARC-024 items in progress.

## 4. Pull merged main and start the app

After GitHub confirms the merge:

```powershell
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

Retain business data and volumes. No additional long manual checklist is required for this correction; the automated release covers it. Report completion once release, merge and pull finish.
