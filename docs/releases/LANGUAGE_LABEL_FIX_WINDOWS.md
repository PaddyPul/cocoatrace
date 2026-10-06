# Language selector label correction: Windows instructions

Apply this correction on your existing `feat/language-foundation-v1` branch. The language and dependency corrections are already applied but the browser gate stopped at the exact language-label lookup. Do not merge that unfinished PR yet. Keep Docker Desktop running, existing database/evidence volumes, local untracked Compose overrides and older formatting stashes.

## 1. Confirm the branch

Save `cocoatrace-language-label-fix.bundle` in Downloads, then:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git switch feat/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Branch switch failed. Stop here." }
git status
```

Continue only without tracked modifications. Untracked local Compose overrides can remain.

## 2. Apply the correction only

```powershell
git fetch "$env:USERPROFILE\Downloads\cocoatrace-language-label-fix.bundle" "HEAD:refs/remotes/bundle/language-label-fix"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/language-label-fix
if ($LASTEXITCODE -ne 0) { throw "Correction failed. Stop here and send the conflict output." }
```

This cherry-picks only the corrective commit; it does not reapply the original language commit or merge the bundle's history.

## 3. Run the complete automated release gate

```powershell
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop here." }
```

Dependencies are unchanged from the advisory correction; another npm ci is unnecessary. No long manual trade checklist is required. Docker/browser/image/recovery checks are mandatory before merge. If it fails, send the actual terminal failure and:

```powershell
Get-Content ".\release-test-results\summary.json" -Raw
Get-Content ".\browser-test-results\safe\summary.json" -Raw
```

## 4. Start the application after checks pass

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Briefly check sign-in and the navigation language selector. No database migration or reset is required.

## 5. Push the existing branch and update its PR

```powershell
git status
git push -u origin feat/language-foundation-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/language-foundation-v1?expand=1"
```

PR title: **Add English/French workspace navigation and patch dependency advisories**. Use the updated full description in `docs/releases/LANGUAGE_FOUNDATION_PR.md`. If the PR is already open, edit that PR; do not create a duplicate. After native release success, check integration/E2E verification, keep staging unchecked unless tested there, and wait for all required GitHub checks. Then click **Merge pull request** and **Confirm merge**.

## 6. Pull main and restart the merged application

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
