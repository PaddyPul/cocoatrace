# Listing-summary correction: Windows instructions

The release failed at `/listings/summary`. The final printed pass line was unconditional after interactive PowerShell continued past earlier throws; it was not a valid release result. Do not push or merge that failed candidate.

The summary previously applied the recall predicate to each listing. This correction groups eligible listings by physical batch, evaluates the unchanged active/retained/disposed recall predicate once per batch, and then sums full marketplace count, quantity and own count. It retains stock/owner checks, complete totals, snapshot consistency and the existing 2-second statement / 5-second read limits. No migration, timeout increase or security bypass is introduced. The integration test now checks that recalling a batch removes all 1,005 listings from totals and includes safe API-code diagnostics on failure. Actual Windows timeout elimination still requires the runtime tests below.

## 1. Apply the correction on your current feature branch

Download `bettertrade-listing-summary-read-fix.bundle` into Downloads. This is a correction-only tip; your terminal-email implementation and preservation stash remain in place. Paste each entire PowerShell block, including its opening and closing braces. A throw stops that block before any success message can execute.

```powershell
& {
    $ErrorActionPreference = "Stop"
    cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
    if ((git branch --show-current).Trim() -ne "feat/operations-terminal-email-recovery") { throw "Unexpected branch. Stop and send git status." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before applying." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-listing-summary-read-fix.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/listing-summary-read-fix"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/listing-summary-read-fix
    if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
    git log -2 --oneline
}
```

No stash pop, database reset, dependency changes or removal of your original Compose/log files is needed.

## 2. Check the affected integration suite first

Docker Desktop must be running. Keep other builds/test runs stopped. Dependencies from the prior handoff are unchanged.

```powershell
& {
    $ErrorActionPreference = "Stop"
    npm run test:integration:docker --workspace=api -- catalogPagination.integration.test.ts *> listing-summary-integration-output.txt
    if ($LASTEXITCODE -ne 0) {
        Get-Content listing-summary-integration-output.txt -Tail 60
        throw "Focused integration failed. Send the first failure and API code; do not run the full release yet."
    }
    "Catalog pagination integration passed."
}
```

## 3. Run the full release with a guarded success message

```powershell
& {
    $ErrorActionPreference = "Stop"
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot read candidate commit." }
    npm run verify:release *> terminal-email-release-output.txt
    if ($LASTEXITCODE -ne 0) {
        Get-Content terminal-email-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in files; paste only the first failure. The report must pass for the current commit. A success message from an older interactive command is not evidence.

## 4. Push, PR, merge and synchronize

After step 3 passes, use the updated title/body in `docs/releases/TERMINAL_EMAIL_RECOVERY_PR.md`; add the passing SHA/date and check the integration/browser verification boxes. Required GitHub CI must pass before merge. This is the same terminal-email feature PR, with the catalog correction explained in its change summary.

```powershell
& {
    $ErrorActionPreference = "Stop"
    git push -u origin feat/operations-terminal-email-recovery
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\TERMINAL_EMAIL_RECOVERY_PR.md" -Raw
}
```

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

## Author validation

Passed here: 10 catalog repository unit cases; code quality (lint, formatting, script contracts and 10 policy/contract tests); API build/typecheck; strict compilation of the affected integration suite; whitespace validation. Docker/PostgreSQL execution is unavailable here; the native test additions require founder-side verification. No runtime performance measurement or hosted acceptance is claimed.
