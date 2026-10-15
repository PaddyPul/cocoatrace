# Pilot workspace closure: Windows handoff

The previous request/deployment guardrails release is accepted: ENV-012/018 close,115/343 (33.5%). This bundle targets four whole outcomes: PRD-002 environment identity, PRD-005 saved sourcing edits, PRD-009 action/overdue filters and PRD-012 customer deal activity. Integrated acceptance yields119/343 (34.7%). Core11/28 and provider-inclusive11/40 are unchanged; hosted readiness is separate.

One apply/release/merge cycle covers the batch. Preserve stash, local Compose overrides and logs. No dependency, migration, reset, provider signup or paid service is required. Download the bundle to Downloads; apply only its tip.

## 1. Apply on a new feature branch

Download `bettertrade-pilot-workspace-closure-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/pilot-workspace-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-pilot-workspace-closure-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/pilot-workspace-closure-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/pilot-workspace-closure-v1
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
    cmd.exe /d /c "npm run verify:release > pilot-workspace-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content pilot-workspace-closure-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The release includes saved-brief editing, buyer/supplier filters, scoped activity and environment regressions together with all existing journeys. No reset, manual persona checklist, dependency install or migration is required. On failure send only the first specific failure and its response code.

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
    git push -u origin feat/pilot-workspace-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\PILOT_WORKSPACE_CLOSURE_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in PILOT_WORKSPACE_CLOSURE_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” once done. Four workspace targets close after review/release/merge acceptance; hosted gates remain separate.



## Scope and checks

Read docs/runbooks/PILOT_WORKSPACE_PRODUCTIVITY.md for behavior and limits. Saved draft/open briefs edit the same owner-scoped record and atomically audit changed field names. Unknown quality/assurance specifications are retained by the editor; accepted offers/contracts remain unchanged. Explicit request URLs drive matching. Terminal briefs stay immutable through this editor.

Trade filters operate over all loaded authoritative next actions; overdue uses the recorded installment deadline and server clock. A seller waiting for payment receives no buyer submit authority. No deadline is invented for transport tasks or submitted payments awaiting verification.

Deal history opens only when requested, uses bounded current-party pages, excludes raw audit metadata and individual identity, and explicitly warns that historical activity can be absent. A failed read never becomes an empty-history claim. Refresh/older-page controls do not mutate a trade.

The English/French environment notice reads the server environment with no session credentials and a bounded timeout. Unknown/error responses stay unconfirmed. This does not prove data is synthetic or resources isolated; keep real data out of nonproduction environments.

Author 1,142 API cases, nine frontend transport/environment tests, six locale tests, types/builds, JS budget, quality and register/backlog/risk checks passed; the new native productivity suite compiles strictly. Docker/browser runtime is unavailable on the author host. Run the full release and required GitHub CI for your exact candidate before merging; enter its SHA/date in the PR verification evidence. No extra manual persona checklist is required.
