# Trade resource boundaries: Windows handoff

This batch combines private contract/payment/shipment detail reads and buyer/seller payment-action regressions. Foreign and absent direct reads share 404, even with wildcard permission. Parent and linked details use one bounded snapshot, direct UUID validation follows entry guards, and oversized child collections fail explicitly. All eleven existing Incoterm write rules and protected-document release conditions remain in place.

Your source-boundary full release passed at f74f290f and was pulled into main at 606da5bd0; that slice is recorded as accepted. No migration, dependency or secret changes are required. Preserve your stash, Compose overrides and logs. Completion remains roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%): remaining resource/field and hosted criteria are still partial.

Download bettertrade-trade-resource-boundaries-v1.bundle into Downloads. Run the full blocks below in order; one full release run is required.

## 1. Apply on a new feature branch

Download `bettertrade-trade-resource-boundaries-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/trade-resource-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-trade-resource-boundaries-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/trade-resource-boundaries-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/trade-resource-boundaries-v1
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
    cmd.exe /d /c "npm run verify:release > trade-resource-boundaries-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content trade-resource-boundaries-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The normal release runs the expanded paymentWorkflow, transportResponsibilities and paymentPages suites, existing protected-document release/concurrency cases, and browser journeys. No extra manual persona loop is needed. If a native test fails, send only its first specific failure and response code. The focused runner accepts one filename at a time; do not combine suite names in one invocation.

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
    git push -u origin feat/trade-resource-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\TRADE_RESOURCE_BOUNDARIES_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in TRADE_RESOURCE_BOUNDARIES_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” after completion. Broader security/resource and hosted gates remain partial. Remaining work includes relationship-specific evidence/fee field projections, other action families and hosted security evidence.


## Author verification

Passed: 1,045 API unit cases in 101 files, code quality, workspace/browser type checks, API/web production builds, authorization register checks, backlog consistency and strict compilation of the three affected native suites. Native PostgreSQL and full browser runtime are not available on the author host; your exact-commit release and required CI remain acceptance gates. No hosted capacity or staging acceptance is claimed.
