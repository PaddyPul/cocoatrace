# Staging Rehearsal v1 — Windows instructions

This bundle adds one-command repository verification, a real prepayment buyer/supplier browser journey, a disposable PostgreSQL backup/restore rehearsal and staging configuration preparation. It does not deploy anything or require cloud accounts yet.

## 1. Apply from your synchronized main

Download `cocoatrace-staging-rehearsal-v1.bundle` into Downloads. Run PowerShell commands individually:

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
git status
git switch main
git pull --ff-only origin main
```

Continue with no modified tracked files or conflicts. Untracked local Compose overrides may remain.

```powershell
if (-not (Test-Path "api\src\migrations\023_recall_response.ts")) { throw "Main needs the merged Recall Response release before this bundle." }
git bundle verify "$env:USERPROFILE\Downloads\cocoatrace-staging-rehearsal-v1.bundle"
git fetch "$env:USERPROFILE\Downloads\cocoatrace-staging-rehearsal-v1.bundle" "HEAD:refs/remotes/bundle/staging-rehearsal-v1"
git switch -c feat/staging-rehearsal-v1
git cherry-pick bundle/staging-rehearsal-v1
git status
git log -3 --oneline
```

Only the bundle tip commit is applied. If the branch already exists or any command fails, stop and share the output rather than reapplying, resetting or choosing one side of a conflict blindly. No new dependencies or migrations are added. If dependencies are absent, run `npm ci`.

## 2. Run all automated release gates with one command

Start Docker Desktop, then:

```powershell
npm run verify:release
```

This runs API unit tests, builds, browser type checking, migration integrity, fresh/upgrade migration tests, PostgreSQL/storage/scanner integration, browser journeys and the new backup/restore rehearsal. It installs Chromium automatically as needed. Each Docker harness uses its own disposable project; your local application data is preserved. Do not reset or reseed your application.

Success ends with:

```text
Release checks: passed. Report: release-test-results/summary.json
```

Inspect the report:

```powershell
Get-Content ".\release-test-results\summary.json"
```

If it fails, share the failed stage and its terminal error. Later stages marked `not_run` did not pass. For browser errors also share:

```powershell
Get-Content ".\browser-test-results\safe\summary.json"
```

After a correction, rerun the failed command printed by the report/terminal. Run the full release command before merging the final corrected code. No long manual trade checklist is required for the automated prepayment journey.

## 3. Start the application (optional usability check)

The feature changes are primarily automation. Use this only if you want to inspect the existing UI:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
Start-Process "http://localhost:3000"
```

Do not replace your local `.env` with the staging template. `check:staging` is for injected, provisioned staging variables later; it is expected to reject a local demo configuration.

## 4. Push and merge

After `verify:release` passes:

```powershell
git status
git push -u origin feat/staging-rehearsal-v1
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...feat/staging-rehearsal-v1?expand=1"
```

Create a PR into main titled **Add staging preparation and automated trade/recovery rehearsals**. Wait for every GitHub check, including the new recovery rehearsal, to pass. Merge and confirm. If a push hangs, use your previously working command:

```powershell
git -c http.version=HTTP/1.1 push --verbose --progress -u origin feat/staging-rehearsal-v1
```

Keep local override files uncommitted; do not use `git add .`.

## 5. Pull main and keep your application current

After GitHub confirms merge:

```powershell
git switch main
git pull --ff-only origin main
git status
git log -3 --oneline
docker compose -f docker-compose.yml -f docker-compose.email-test.yml up -d --build
```

If the pull refuses, share the output; do not reset local work.

## 6. What you need to decide next

Provide your monthly staging hosting budget, desired domain, and any existing hosting/email accounts. Then we can select compatible providers and provision staging with separate database/storage/secrets and real email. No live staging or production deployment has been created by this bundle.

Authoring validation and limits: 165 API unit tests, three runner checks, API build, browser type checking, migration integrity, JavaScript syntax and YAML/static configuration passed here. Native Docker is unavailable in the authoring environment, so the full trade browser journey and actual pg_dump/pg_restore rehearsal require the automated command above and CI before this wave is closed. Recovery rehearsal covers database contents and evidence metadata, not privately stored object bytes or managed-provider PITR.
