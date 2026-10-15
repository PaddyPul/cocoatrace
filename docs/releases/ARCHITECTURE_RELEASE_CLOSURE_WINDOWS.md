# Architecture and release closure: Windows handoff

This batch covers seven backlog rows: four technical decision rows DEC-002/003/004/006 reconcile to your accepted ADRs, and three new complete-outcome targets are UX-009 route splitting/budget, ARC-009 public handler ownership and ENV-016 safe explicit demo reset. ENV-014 private diagnostics is also supplied but remains partial pending actual stamped deployment readback.

Your five integrity closures are accepted. With four decision reconciliations, progress is110/343 (32.1%). Accepting this batch's three target closures yields113/343 (32.9%). Core11/28 and provider-inclusive11/40 remain unchanged; hosted/business decisions remain separate.

No dependency installation, migration, data reset, secrets or provider signup. Preserve stash, local Compose overrides and logs. Download bettertrade-architecture-release-closure-v1.bundle into Downloads, apply only its tip, then run one full release using the blocks below.

## 1. Apply on a new feature branch

Download `bettertrade-architecture-release-closure-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/architecture-release-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-architecture-release-closure-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/architecture-release-closure-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/architecture-release-closure-v1
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
    cmd.exe /d /c "npm run verify:release > architecture-release-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content architecture-release-closure-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. One release covers all existing browser journeys through lazy routes, the separated public handlers, private diagnostics boundaries and demo guard regression tests. The new JavaScript budget gate runs after production web build; it includes transitive static imports and excludes deferred route chunks. No manual reset, extra UI checklist or provider signup is needed. On failure send the first specific failure and response code only.

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
    git push -u origin feat/architecture-release-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\ARCHITECTURE_RELEASE_CLOSURE_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in ARCHITECTURE_RELEASE_CLOSURE_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” once done. Three target rows close in the next backlog update; the four reconciled technical decisions are already accepted.

## Operational limits

Do not run demo:reset during this handoff. Its existing explicit maintenance job is tightened to simple recognized local PostgreSQL URLs, with unconditional staging/production denial. The legacy remote override no longer bypasses local-target checks. Query/fragment driver overrides are refused. See DEMO_RESET_SAFETY.md before any deliberate future synthetic reset; npm/npx remain absent in the hardened API.

Normal unstamped Compose reports deployment metadata incomplete honestly. Do not add a guessed SHA or claim ENV-014 complete from this release alone. Supplying full BUILD_GIT_SHA through a reviewed build and reading the deployed protected endpoint are separate acceptance steps in DEPLOYMENT_DIAGNOSTICS.md. No paid setup or host provisioning is performed here.

Current customer limitations copy2026-10-14.1 remains accurate. Measured initial JavaScript72,214 gzip bytes is below the90KiB budget; this is not a mobile speed or accessibility result.

## Author verification

Passed1,114 API cases, six HTTP regressions, three budget cases, two temporary-build metadata cases, release/container contract tests, code quality, workspace/browser types, API/web builds, register/backlog/risk checks and strict compilation of deploymentDiagnostics/publicNoticePages/publicJourneyPages/publicEvidencePages/productProfilePages integration suites. Native Docker/full browser and actual hosted diagnostics remain founder/CI acceptance. No reset or real data operation was run.
