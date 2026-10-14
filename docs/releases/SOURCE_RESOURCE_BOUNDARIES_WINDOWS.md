# Paired private source-resource boundaries: Windows handoff

This batch groups farm/plot, batch, certificate and holding read security. Foreign and absent resource IDs return the same 404 response per endpoint. Farm/batch/certificate checks happen before private hydration, and policy/details/collections/trust share one bounded read snapshot. UUID validation follows authentication and permission checks. Session-bound responses and denials default to Cache-Control:no-store. Existing relationship/network permissions and holder-only holding scope are retained.

The founder's authorization-register release/merge/pull report at 13:58 UTC on 2026-10-14 is recorded as accepted. This candidate adds no migration, dependency or secret. Keep your preserved stash and local Compose/log files. Full-roadmap completion remains 88/343 (25.7%); core 11/28 (39.3%), provider-inclusive 11/40 (27.5%). The remaining resource/action/field and deployed security matrix stays partial.

## 1. Apply on a new feature branch

Download `bettertrade-source-resource-boundaries-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/source-resource-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-source-resource-boundaries-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/source-resource-boundaries-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/source-resource-boundaries-v1
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
    cmd.exe /d /c "npm run verify:release > source-resource-boundaries-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content source-resource-boundaries-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The new 34-case native suite covers paired owner/foreign/absent reads, exact foreign search and full scoped totals, ordinary role unions, explicit network access, malformed-ID guard ordering, current role removal/suspension/revocation, and snapshot consistency during reassignment. Existing expected statuses are updated for these private read classes. All tests run in the normal release; no manual persona loop is needed.

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
    git push -u origin feat/source-resource-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\SOURCE_RESOURCE_BOUNDARIES_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in SOURCE_RESOURCE_BOUNDARIES_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” after completion. Broader security/resource and hosted gates remain partial. The next work extends these paired controls to trade, payment, transport and evidence actions; relationship-specific field projections and hosted security remain open.

## Author verification and limitations

Passed: 1,034 API unit tests in 98 files, including 21 new focused resource cases and the expanded no-store credential-boundary assertions; workspace/browser types; strict compilation of the new native suite and four affected existing native suites; API/web builds; quality; authorization-register regression checks; migration integrity; backlog consistency and whitespace checks. The existing web chunk-size warning remains. The full suite first identified one old plot assertion expecting 403; it was updated to the new documented 404 contract and the full rerun passed.

Thirty-four new PostgreSQL cases are supplied and compiled, not claimed as executed here. Docker/PostgreSQL and full browser execution require the founder's release and required GitHub CI. No additional manual persona checklist is required. If a gate fails, send only its first specific failure; do not push/merge or reset data. Preserve original untracked Compose overrides, local logs and the preservation stash.

No mutation policy, commercial quantity, outbox, session signature or frozen migration is rewritten. A read is consistent as of its snapshot; this does not cancel a request already authorized before suspension/reassignment. These tests cover unrelated organizations and the named source/inventory/certificate classes, not every legitimate relationship's returned-field policy or every other trade/financial/evidence action. Read security details in docs/security/SOURCE_RESOURCE_BOUNDARIES_2026-10-14.md. Broader SEC-006/QLT-002/ARC-011 and hosted acceptance remain IN PROGRESS.
