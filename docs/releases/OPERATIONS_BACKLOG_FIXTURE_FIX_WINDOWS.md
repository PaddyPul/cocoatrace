# Queue backlog fixture isolation correction

The preceding recovery security test intentionally revoked the shared administrator session. The new backlog tests incorrectly reused that token, so authentication returned 401 before any backlog query ran. This correction uses a separate administrator created and enrolled through the existing real passkey fixture helper. The old session stays revoked, and the backlog negative test explicitly checks that it still receives 401. No production authentication, timeout, queue or migration code is changed.

## 1. Apply on the current feature branch

Download `bettertrade-operations-backlog-fixture-fix.bundle` into Downloads. Paste the whole block:

```powershell
& {
    $ErrorActionPreference = "Stop"
    if ((git branch --show-current).Trim() -ne "feat/operations-backlog-v1") { throw "Unexpected branch. Send git status." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them first." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-operations-backlog-fixture-fix.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/operations-backlog-fixture-fix"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/operations-backlog-fixture-fix
    if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
    git log -2 --oneline
}
```

Only the tip is needed. Preserve the old stash, original Compose files and all local logs; do not pop the stash or stage those files. No dependency installation or database reset is required.

## 2. Check the affected suite before repeating the release

Docker Desktop must be running. Keep competing test/build runs stopped.

```powershell
& {
    $ErrorActionPreference = "Stop"
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- operationsWorkers.integration.test.ts > operations-backlog-fixture-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content operations-backlog-fixture-output.txt -Tail 60
        throw "Focused integration failed. Stop and send the first failure."
    }
    "Operations worker integration passed."
}
```

## 3. Run the full release on this corrected commit

```powershell
& {
    $ErrorActionPreference = "Stop"
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot read candidate commit." }
    cmd.exe /d /c "npm run verify:release > operations-backlog-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content operations-backlog-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

## 4. Push and continue the same PR

Only after step 3 passes:

```powershell
& {
    $ErrorActionPreference = "Stop"
    git push -u origin feat/operations-backlog-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\OPERATIONS_BACKLOG_PR.md" -Raw
}
```

Use the updated PR body, add the passing SHA/date and check integration/browser boxes only after full release passes. Required GitHub CI must pass before merge. After merge, follow step 4 in OPERATIONS_BACKLOG_WINDOWS.md to switch/pull main and start the application. Migration 037 remains unchanged and is applied by hardened API startup; no npm/npx command inside that image is needed.

## Author verification

Passed here: strict TypeScript compilation of the affected integration suite, code quality (lint, formatting, script contracts and 10 policy/contract tests), and whitespace validation. Native PostgreSQL execution remains unavailable here. Strict compilation and quality checks do not establish a native pass; steps 2–3 provide that evidence on the founder PC.
