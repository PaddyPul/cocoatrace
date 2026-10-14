# Durable operator alerts: Windows handoff

This batch adds opt-in alert episodes, a durable operator-email outbox, finite retries and private delivery status. Alert recipients must be existing verified platform-admin accounts and remain eligible when sending. Alerts default off. No paid service or real outgoing mailbox is configured. The prior bounded queue-monitoring workflow is recorded as founder accepted.

Migration 038 adds three empty operations tables and their indexes. Startup applies migrations automatically. Do not reset the database or run npm inside the hardened API image. Dependencies are unchanged. Complete-item progress remains 88/343 (25.7%); core gates 11/28 (39.3%), provider-inclusive gates 11/40 (27.5%). Real inbox receipt, incident ownership, independent monitoring and hosted drills remain open.

## 1. Apply on a new feature branch

Download `bettertrade-operations-alerts-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/operations-alerts-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-operations-alerts-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/operations-alerts-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/operations-alerts-v1
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
    cmd.exe /d /c "npm run verify:release > operations-alerts-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content operations-alerts-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. Twelve new native cases cover private reads, incident concurrency/recurrence, recipient authority, suppression, retries, terminal states, SMTP health failure, coordination cooldown and expired claims. Browser additions cover alert status and retained recovery drafts on failed/malformed observations. All are included in the normal full release; no extra manual persona test loop is needed.

## 3. Push and create the PR

Only after the exact-commit release passes:

```powershell
& {
    $ErrorActionPreference = "Stop"
    git push -u origin feat/operations-alerts-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\OPERATIONS_ALERTS_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in OPERATIONS_ALERTS_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Migration 038 adds three empty operational tables and indexes without rewriting existing domain records. Hardened API startup applies it via Node; do not invoke npm/npx inside the container or reset the database. Use a controlled API/worker restart. The normal release tests fresh/upgrade migrations and restore integrity.

Optional observation: sign in as platform admin with passkey assurance and open Operations. The Operator alert delivery region is disabled by default and separate from queue observations and terminal-record review controls. This is optional and does not replace automated release evidence.

Report “release checks passed and merge/pull completed” after completion. Alerts remain off after the standard startup. Optional local Mailpit capture is below. Broader operations gates remain partial; this batch does not configure real external recipients or close hosted requirements.

## Optional: capture operator alerts locally after merge

This is an optional local capture check; automated release coverage is already supplied. Keep public demo sharing stopped. Mailpit stores messages locally and sends nothing to Gmail or other external inboxes. The local account email is used as a capture address. Do not change APP_ENV or evidence namespaces.

List currently eligible registered operators from the running standard stack:

```powershell
& {
    $ErrorActionPreference = "Stop"
    docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml exec api node --import tsx api/scripts/operations-alerts.ts --operators
    if ($LASTEXITCODE -ne 0) { throw "Operator lookup failed. Stop here." }
}
```

Select your own confirmed platform-admin account ID from that private output. Do not paste addresses or IDs into the PR. Enable only the local capture override:

```powershell
& {
    $ErrorActionPreference = "Stop"
    $operatorId = Read-Host "Paste your confirmed platform-admin user UUID"
    $parsedOperator = [guid]::Empty
    if (-not [guid]::TryParse($operatorId, [ref]$parsedOperator)) { throw "A user UUID is required." }
    $oldAlertFlag = $env:OPERATIONS_ALERTS_ENABLED
    $oldAlertTargets = $env:OPERATIONS_ALERT_RECIPIENT_USER_IDS
    try {
        $env:OPERATIONS_ALERTS_ENABLED = "true"
        $env:OPERATIONS_ALERT_RECIPIENT_USER_IDS = $parsedOperator.ToString()
        cmd.exe /d /c "docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml -f docker-compose.operations-alerts.local.yml up -d > operations-alerts-local-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content operations-alerts-local-output.txt -Tail 40
            throw "Local capture startup failed."
        }
    } finally {
        $env:OPERATIONS_ALERTS_ENABLED = $oldAlertFlag
        $env:OPERATIONS_ALERT_RECIPIENT_USER_IDS = $oldAlertTargets
    }
    Start-Process "http://localhost:3000"
    Start-Process "http://localhost:8025"
}
```

The API reads its configured values when recreated; restoring the terminal variables does not disable the already running container. Open Operations as platform admin. After the first minute, it shows current alert checks. A healthy system may have no incident and therefore no email. Do not manufacture failures in business/recall data to force a message. If an existing monitored incident is present, Mailpit should capture its generic signal email. SMTP submission/capture is not proof of real external inbox delivery. Four messages maximum per cycle means a larger queue can stay pending across cycles.

If needed, a one-cycle maintenance run uses the same lock and cooldown (and can actually send to the configured Mailpit adapter):

```powershell
& {
    $ErrorActionPreference = "Stop"
    docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml exec api node --import tsx api/scripts/operations-alerts.ts --once
    if ($LASTEXITCODE -ne 0) { throw "Alert cycle needs investigation. Inspect Operations status." }
}
```

`busy` means another worker owns the cycle or the one-minute cooldown; it is not a delivered-message claim. The exec command uses the running container's configuration even without the opt-in override arguments. Future up/recreate commands using only the standard stack remove the opt-in override and disable alerts. Repeat the explicit enable block if local capture is still desired; do not commit personal recipient IDs.

To return to default-off operation, run the standard startup again:

```powershell
& {
    $ErrorActionPreference = "Stop"
    cmd.exe /d /c "docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d > operations-alerts-disable-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content operations-alerts-disable-output.txt -Tail 40; throw "Standard startup failed." }
}
```

Preserve history. Terminal operator alerts and ambiguous SMTP acceptance require investigation; this slice does not expose a retry action for that new queue. The migration down refuses unresolved queued/sending/retryable/terminal work. Revert code/disable workers before considering schema rollback, preserve records and review retention rather than deleting them.

## Author verification

Passed: 820 API unit tests in 95 files; the pure Operations backlog client-contract test; API/web/browser type checks; strict compilation of the new native suite and maintenance CLI; API/web production builds; quality checks; migration integrity; backlog consistency and whitespace checks. The existing web bundle-size warning remains. The pure contract test launches no browser. Twelve native integration cases and two browser cases are supplied, not claimed as executed here: this author environment has no Docker or browser binary. Founder full release and required GitHub CI must pass for the candidate before merge. No real external email, hosted load, incident-owner or inbox acceptance is claimed.
