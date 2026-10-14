# Security and architecture closure bundle: Windows handoff

This single bundle supplies four complete engineering outcomes: SEC-009 outbound URL review/safe handling, SEC-015 six-scenario threat model, ARC-016 shared HTTP plus feature clients, and ARC-017 domain-owned frontend types. SEC-019 receives its policy/runbook but remains blocked on real private-intake verification.

The founder reported the prior trade-boundary release/merge complete at 19:38 UTC 2026-10-14; it is recorded as accepted. Current accepted roadmap completion is 88/343 (25.7%). After this integrated release/CI and merge are accepted, four target closures yield 92/343 (26.8%). Core 11/28 (39.3%) and provider-inclusive 11/40 (27.5%) remain unchanged because hosted gates are separate.

No new dependencies, migration, secrets or paid services. Keep current node_modules, the preserved stash and local Compose/log files. Download bettertrade-security-architecture-closure-v1.bundle into Downloads. Paste full blocks in order.

## 1. Apply on a new feature branch

Download `bettertrade-security-architecture-closure-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/security-architecture-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-security-architecture-closure-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/security-architecture-closure-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/security-architecture-closure-v1
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
    cmd.exe /d /c "npm run verify:release > security-architecture-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content security-architecture-closure-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. One normal release includes the new shared HTTP boundary gate, API URL validation, URL-policy parity and two shipment rendering scenarios, plus existing database, signed-passkey, identity and trade journeys. No separate focused suite or manual regression loop is needed. On failure, send only the first specific failure and response code.

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
    git push -u origin feat/security-architecture-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\SECURITY_ARCHITECTURE_CLOSURE_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in SECURITY_ARCHITECTURE_CLOSURE_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” once done. This acknowledgement closes the four engineering targets in the next backlog update; no additional manual code changes are required.

## Private vulnerability channel: separate blocker

SECURITY.md and docs/runbooks/SECURITY_REPORTS.md supply the process. SEC-019 remains partial: private reporting must actually be enabled and monitored, with an accepted primary/backup and a synthetic authorized private intake/acknowledgement test. Do not publish a guessed email or sensitive test report. This step is not required for applying the engineering bundle, and no channel is claimed active.

## Author verification

Passed: 1,062 API unit cases, six shared HTTP tests, one browserless URL parity scenario, code quality, workspace/browser type checks, API/web builds, authorization register, runner and backlog consistency checks. Existing web chunk-size warning remains. Actual browser scenarios and native Docker/full release runtime are pending founder/CI acceptance. No hosted/staging, inbox or independent-security acceptance is claimed.
