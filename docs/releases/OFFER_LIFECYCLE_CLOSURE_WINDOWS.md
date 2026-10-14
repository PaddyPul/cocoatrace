# Pending-offer and pilot closure bundle: Windows handoff

Six target closures: TRD-010 buyer withdrawal, TRD-011 seller rejection reasons/history, TRD-012 explicitly external negotiation, GOV-009 customer limitations, GOV-007 release naming/changelog and GOV-010 deprecation policy.

The prior four security/architecture items are now marked complete following your 20:25 UTC acceptance: 92/343 (26.8%). After this integrated release/CI and founder review/merge, six closures yield 98/343 (28.6%). Pilot gate counts remain 11/28 (39.3%) and 11/40 (27.5%); hosted requirements remain separate.

No migration, dependency or secrets changes. Preserve your stash, Compose overrides and logs. Download bettertrade-offer-lifecycle-closure-v1.bundle into Downloads and follow the full blocks below. Seller rejection now requires a reason; the UI/client is included and older empty-body submissions receive controlled 400. Existing cancelled status is reused for withdrawal; accepted contract cancellation is separate.

## 1. Apply on a new feature branch

Download `bettertrade-offer-lifecycle-closure-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/offer-lifecycle-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-offer-lifecycle-closure-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/offer-lifecycle-closure-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/offer-lifecycle-closure-v1
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
    cmd.exe /d /c "npm run verify:release > offer-lifecycle-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content offer-lifecycle-closure-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. One release runs the new buyer withdrawal and expanded seller rejection native cases, confirmation/history/form-retention and limitations browser scenarios, plus existing payment/inventory/passkey journeys. No extra manual UI loop is required. On failure send only the first specific failure and response code. The focused runner accepts only one suite filename per command if troubleshooting is needed.

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
    git push -u origin feat/offer-lifecycle-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\OFFER_LIFECYCLE_CLOSURE_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in OFFER_LIFECYCLE_CLOSURE_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” once done. The next backlog update closes the six targets; no manual checkbox editing is required.

## Review the customer and release policies

Open Known pilot limitations from the sidebar or /pilot/limitations. Its version is2026-10-14.1. Read docs/governance/RELEASE_AND_COMPATIBILITY_POLICY.md and CHANGELOG.md as part of PR review. These publication items establish the rules; they do not create a public version tag, deploy a host or guarantee legal/commercial terms. Negotiation is explicitly external; external messages cannot amend the recorded offer or accepted trade. Registered/verified logistics selection remains future work.

## Author verification

Passed: 1,080 API unit cases, six shared HTTP regressions, code quality, workspace/browser types, API/web builds, authorization register and backlog consistency. Withdrawal and trading-integrity native suites compile strictly. Native Docker and actual browser scenarios require your full release and required CI; no hosted/staging or independent security acceptance is claimed. Existing web chunk-size warning remains.
