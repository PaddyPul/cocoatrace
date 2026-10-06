# Language wave dependency correction: Windows instructions

Apply this correction on your existing `feat/language-foundation-v1` branch. The language bundle is already applied but its release gate stopped at dependency advisories. Do not merge that unfinished PR yet. Keep Docker Desktop running, existing database/evidence volumes, local untracked Compose overrides and older formatting stashes.

## 1. Confirm the branch

Save `cocoatrace-language-dependency-fix.bundle` in Downloads, then:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch feat/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Branch switch failed. Stop here." }
git status
```

Continue only without tracked modifications. Untracked local Compose overrides can remain.

## 2. Apply the correction only

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-language-dependency-fix.bundle" "HEAD:refs/remotes/bundle/language-dependency-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/language-dependency-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop here and send the conflict output." }
```

This cherry-picks only the corrective commit; it does not reapply the original language commit or merge the bundle's history.

## 3. Install the corrected dependency lock

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Stop here." }
npm run check:dependencies
if ($LASTEXITCODE -ne 0) { throw "Dependency advisory checks failed." }
```

Pinned versions: proxy-addr 2.0.8, fast-copy 4.1.2, postcss-selector-parser 7.1.6 and source-map-js 1.2.2. Do not use npm audit fix --force or change security exceptions to make the gate pass.

## 4. Run the complete automated release gate

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

No long manual trade checklist is required. Docker/browser/image/recovery checks are mandatory before merge. If it fails, send the actual terminal failure and:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
Get-Content ".\dependency-test-results\summary.json" -Raw
```

## 5. Start the application after checks pass

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Briefly check sign-in and the navigation language selector. No database migration or reset is required.

## 6. Push the existing branch and update its PR

```powershell
git status
git push -u origin feat/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/language-foundation-v1?expand=1"
```

PR title: **Add English/French workspace navigation and patch dependency advisories**. Use the updated full description in `docs/releases/LANGUAGE_FOUNDATION_PR.md`. If the PR is already open, edit that PR; do not create a duplicate. After native release success, check integration/E2E verification, keep staging unchecked unless tested there, and wait for all required GitHub checks. Then click **Merge pull request** and **Confirm merge**.

## 7. Pull main and restart the merged application

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Switch failed. Stop here." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
git status
```

Leave your local Compose overrides and stashes intact. Do not run docker compose down -v.
