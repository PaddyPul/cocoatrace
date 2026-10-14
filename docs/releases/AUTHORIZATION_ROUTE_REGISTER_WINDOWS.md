# Authorization route register: Windows handoff

This batch adds a checked 195-route security inventory, systematic credential/permission coverage and early platform-admin guards on access-application review. Existing services already required that platform authority; this moves rejection before payload validation and retains the service check. It also records founder acceptance of reviewed operator-alert recovery at 12:19 UTC on 2026-10-14.

No migration, dependency or secret changes. Full-roadmap completion remains 88/343 (25.7%); core 11/28 (39.3%), provider-inclusive 11/40 (27.5%). SEC-006 and QLT-002 move to IN PROGRESS, with no partial completion credit. Source/test pointers and entry gates do not prove every resource/role combination. The full gap review is docs/security/ROUTE_SECURITY_REVIEW_2026-10-14.md.

## 1. Apply on a new feature branch

Download `bettertrade-authorization-route-register-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

Paste this entire block:

```powershell
& {
    $ErrorActionPreference = "Stop"
    cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them first." }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
    git switch -c feat/authorization-route-register-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-authorization-route-register-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/authorization-route-register-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/authorization-route-register-v1
    if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
    git log -2 --oneline
    git status --short
}
```

The bundle contains complete history for portability. Apply only the tip as above. Dependencies are unchanged; reuse the installation from the release that just passed.

## 2. Run one full release gate

Start Docker Desktop. Stop other test/build runs. Redirection happens inside cmd.exe, so ordinary Docker/Vite stderr progress does not trigger PowerShell NativeCommandError. Native exit codes are still checked. Paste the entire block; the success message is inside its guards.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot read candidate commit." }
    cmd.exe /d /c "npm run verify:release > authorization-route-register-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content authorization-route-register-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The new source/register gate runs automatically. API unit tests check actual route registration, every protected credential boundary and implicit GET-to-HEAD behavior. Native tests check all 155 declared-permission routes with a live account lacking permissions, early access-review rejection, foreign/absent recall nondisclosure and absence of business mutation audits for the denied actor. All are included in the normal full release; no extra manual persona test loop is needed.

## 3. Push and create the PR

Only after the exact-commit release passes:

```powershell
& {
    $ErrorActionPreference = "Stop"
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot read candidate." }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "No passing release report for this commit." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Verify the final commit first." }
    git push -u origin feat/authorization-route-register-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\AUTHORIZATION_ROUTE_REGISTER_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in AUTHORIZATION_ROUTE_REGISTER_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

## 4. Merge, synchronize and start

After merging the PR:

```powershell
& {
    $ErrorActionPreference = "Stop"
    git switch main
    if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
    docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
    if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
    git status --short
    Start-Process "http://localhost:3000"
}
```

No migration or dependency change is required. Existing frozen migration assets remain untouched. The API automatically applies any pending registered migrations via Node; do not invoke npm/npx inside the hardened container or reset the database.

No manual persona checklist is required for this batch. The existing accepted onboarding, trade, passkey, operations and browser suites remain part of the full release.

Report “release checks passed and merge/pull completed” after completion. Broader security/resource and hosted gates remain partial. The next work extends paired authorized/foreign-resource and role-union/suspension evidence; this batch does not introduce new public routes or grant roles.

## Author verification and limits

Passed: 1,013 API unit tests in 97 files; six register regression cases; nine release-runner tests; workspace/browser type checks; strict native-suite compilation; API/web production builds; quality, migration integrity and three backlog consistency tests; whitespace validation. The existing web chunk-size warning remains. No Docker/PostgreSQL or full browser execution is claimed here.

179 new API cases check the actual Express registration set plus each of 178 protected routes with missing and invalid credentials, including HEAD for protected GETs. The native suite supplies 155 live-session permission cases plus three targeted review/nondisclosure/audit controls. No credentials are granted by the tests. The source checker has six adversarial/canonical regression cases, and the release runner verifies the new gate is required before application/infrastructure acceptance.

Docker/PostgreSQL runtime and full browser execution are unavailable here. Run the normal full release above and require GitHub CI before merge. Full resource/foreign-ID/role-union/suspension and deployment acceptance remain open; this is not a penetration-test certification. If a gate fails, send only the first specific failure and retain local logs. Do not reset data or stage logs/Compose overrides/the preserved stash.
