# Queue backlog and incident visibility: Windows handoff

This batch adds platform-admin queue observations to the Operations monitor: cleanup and notification backlog, terminal work, overdue attempts, expired/missing sending leases and capped observations. It carries forward the founder's terminal-email release/merge acknowledgement and fixes PowerShell logging instructions. No manual persona journey is required.

The observations are bounded and read-only. Counts show a lower bound when capped; retries/expired leases are observed subsets. Unknown monitoring does not mean zero work. Job status plus queue observations inform the monitor, without claiming inbox delivery or hosted safety. Scanner/DB/HTTP/abuse signals, external alerts, ownership and hosted drills remain open. Backlog completion stays 25.7% (88/343 fully closed); no partial credit is added.

## 1. Apply on a new feature branch

Download `bettertrade-operations-backlog-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/operations-backlog-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-operations-backlog-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/operations-backlog-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/operations-backlog-v1
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

Full output stays in the local file. Native additions cover permission denial, lower-bound counts, unchanged queue state, notification retry/lease visibility and unavailable/recovered reads. Browser additions cover capped/expired/overdue displays, invalid envelopes and a recovery explanation retained during failed monitoring. All are included in the normal full release; no separate manual test loop is needed.

## 3. Push and create the PR

Only after the exact-commit release passes:

```powershell
& {
    $ErrorActionPreference = "Stop"
    git push -u origin feat/operations-backlog-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\OPERATIONS_BACKLOG_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in OPERATIONS_BACKLOG_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Migration 037 adds four partial indexes only. The hardened API startup applies it via Node; do not invoke npm/npx inside that container or reset the database. Standard index builds can block queue writes while running: use a controlled API/worker restart, with no competing instances doing maintenance. The normal release tests fresh/upgrade migrations and restore integrity.

Optional observation: sign in as platform admin with passkey assurance and open Operations. The Queue backlog table is separate from terminal-record review controls. This is optional and does not replace automated release evidence.

Report “release checks passed and merge/pull completed” after completion. Broader operations gates remain partial; this batch does not configure an alert service or close hosted requirements.

## Author validation

Passed here: 807 API unit tests in 94 files; 13 signal cases checked again against the final probe SQL; the client backlog contract test; API/web/browser type checks; strict compilation of both affected native integration suites; API/web production builds; code quality; migration integrity; 3 backlog tests; whitespace validation. The web build retains its existing bundle-size warning. The client contract case does not launch a browser and is not a full browser journey pass. No Docker/PostgreSQL runtime or full browser journey execution is available in the author environment. Native integration additions require founder-side release verification.
