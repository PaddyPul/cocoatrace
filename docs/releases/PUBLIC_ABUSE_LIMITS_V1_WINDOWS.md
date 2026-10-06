# Public abuse protection — full Windows instructions

Use updated main after the Incoterm responsibility PR was merged. Download `bettertrade-public-abuse-limits-v1.bundle` into Downloads. This new branch applies only the bundle tip: author/founder histories can differ. Do not merge the full bundle history.

No migration, backfill, new secrets or database reset. Leave your local untracked Compose files and stashes alone. Do not use `git add .`, force-push, remove volumes or run `npm audit fix --force`. Docker Desktop must be running for the complete release. Use your supported Node 24 installation.

## 1. Apply

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Cannot inspect working tree." }
if ($trackedChanges) { throw "Preserve/review tracked changes before continuing." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to main." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git switch -c feat/public-abuse-limits-v1
if ($LASTEXITCODE -ne 0) { throw "Branch creation failed. Stop; do not recreate an existing branch." }
$abuseBundle = "$env:USERPROFILE\Downloads\bettertrade-public-abuse-limits-v1.bundle"
if (-not (Test-Path $abuseBundle)) { throw "Bundle missing from Downloads." }
git bundle verify $abuseBundle
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch $abuseBundle "HEAD:refs/remotes/bundle/public-abuse-limits-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
$abuseTip = git rev-parse bundle/public-abuse-limits-v1
if ($LASTEXITCODE -ne 0) { throw "Cannot resolve bundle tip." }
git show --stat --oneline $abuseTip
git cherry-pick $abuseTip
if ($LASTEXITCODE -ne 0) { throw "Apply failed. Stop and send git status; do not choose all ours/theirs." }
git log -3 --oneline
git status
```

## 2. Run automated checks

The unit/API regressions check abuse limits programmatically; no long manual scan/upload/identity checklist is needed. The complete release also exercises legitimate browser journeys.

```powershell
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
npm run check:quality
if ($LASTEXITCODE -ne 0) { throw "Quality checks failed." }
npm run test --workspace=api -- --run src/modules/security/publicRateLimits.test.ts
if ($LASTEXITCODE -ne 0) { throw "Abuse-policy unit checks failed." }
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog checks failed." }
npm run verify:release
if ($LASTEXITCODE -ne 0) { throw "Release checks failed. Stop before push/merge; send the first specific failing gate." }
Get-Content ".\release-test-results\summary.json" -Raw
git rev-parse HEAD
```

Author local checks pass, but no Docker/PostgreSQL is available here. Native integration/browser/container/migration/recovery execution is required before merge. Do not weaken limits to accommodate accumulated production/demo counters; disposable tests reset only their dedicated test counters. If dependency advisories change, send their report rather than suppressing them.

## 3. Start the application

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
docker compose -f docker-compose.yml -f docker-compose.email-test.yml logs api --tail 40
Start-Process "http://localhost:3000"
```

Optional: confirm ordinary sign-in, a public product profile/QR and a genuine allowed upload still work. Automated release covers these flows. Avoid manually hammering the persistent application; counters deliberately survive restarts and last 15 minutes. No destructive demo reset or SQL counter deletion is required.

## 4. Push and create the PR

```powershell
git status
$trackedChanges = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw "Git status failed." }
if ($trackedChanges) { throw "Unexpected tracked changes; review before pushing." }
git push -u origin feat/public-abuse-limits-v1
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/public-abuse-limits-v1?expand=1"
Get-Content ".\docs\releases\PUBLIC_ABUSE_LIMITS_V1_PR.md" -Raw
```

Base `main`, compare `feat/public-abuse-limits-v1`.

Title: **Bound public profile, QR, scan, invitation and evidence-upload abuse across API workers**.

Replace the default PR body with the text below the “PR description” heading in `docs/releases/PUBLIC_ABUSE_LIMITS_V1_PR.md`. After the native release passes, tick Database/API integration and E2E, add the successful tested SHA/report and CI URL. Leave staging unchecked until actually verified on hosted staging. SEC-011 remains in progress until the release/merge acknowledgement; do not claim the broader pilot is ready.

Wait for required GitHub checks to pass, review, then click **Merge pull request** and **Confirm merge**. Do not merge a failing gate. No manual push to main is needed.

## 5. Pull merged main and restart

Run only after GitHub confirms the PR is merged:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Cannot switch to main." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
docker compose -f docker-compose.yml -f docker-compose.email-test.yml ps
Start-Process "http://localhost:3000"
```

Tell me when the native release and merge are done so SEC-011 evidence can be updated. Next security priority is privileged MFA/recovery; hosted operations and exact route/named-place policies remain pilot blockers.
