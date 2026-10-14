# Reviewed operator-alert recovery: Windows handoff

This batch adds safe, audited review/retry for failed operator alerts. It keeps the same outbox record, incident and recipient; it never sends directly. Fresh passkey assurance, current platform-admin authority, enabled alerts, current original-recipient eligibility and an open incident are required. Leases, recorded submission, inconsistent/unknown failure and non-terminal states are refused.

The previous operator-alert workflow is recorded as founder accepted. No real inbox or hosted acceptance is inferred. This batch adds no migration, dependency or secret. Backlog counts remain 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%); broader operations requirements remain partial.

## 1. Apply on a new feature branch

Download `bettertrade-operations-alert-recovery-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/operations-alert-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-operations-alert-recovery-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/operations-alert-recovery-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/operations-alert-recovery-v1
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
    cmd.exe /d /c "npm run verify:release > operations-alert-recovery-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content operations-alert-recovery-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. Twenty new native cases cover private reads/writes, strict input, concurrent reviews, unsafe states, original-recipient eligibility, fresh assurance, suspension during a lock wait, audit rollback and bounded redacted reads. Two additional browser scenarios cover reviewed operator-alert retry through conflicts/assurance/refresh and an unavailable terminal register without losing the explanation. All are included in the normal full release; no extra manual persona test loop is needed.

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
    git push -u origin feat/operations-alert-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\OPERATIONS_ALERT_RECOVERY_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in OPERATIONS_ALERT_RECOVERY_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

No new migration is needed. Migration 038 from the previous accepted batch remains unchanged. Hardened API startup applies any pending registered migrations via Node; do not invoke npm/npx inside the container or reset the database. Existing outbox/audit rows are preserved.

Optional observation: sign in as platform admin with passkey assurance and open Operations. Operator alert terminal email now appears alongside the other recovery queues. Default-off delivery remains disabled; eligible retry controls require the earlier opt-in capture configuration, an active incident and the original eligible operator. This is optional and does not replace automated release evidence.

Report “release checks passed and merge/pull completed” after completion. Alerts remain off after the standard startup. For optional local capture, use OPERATIONS_ALERTS_WINDOWS.md from the previous batch; no extra manual persona loop is required. Broader operations gates remain partial; this batch does not configure real external recipients or close hosted requirements.

## Author verification and limitations

Passed here: 834 API unit tests in 96 files, including fourteen new recovery cases; API/web/browser types; strict compilation of twenty new native PostgreSQL cases; API/web production builds; quality checks; pure browser backlog contract; migration integrity; backlog consistency; whitespace checks. The web build retains its existing chunk-size warning. Two additional browser scenarios are supplied. Native PostgreSQL/Docker/full browser execution remains for the founder release and required GitHub CI; compilation is not runtime acceptance. No real email is sent or external provider configured here.

The terminal register is capped at fifty records per observation, with an explicit more indicator; it exposes no recipient contacts, incident keys, lease credentials or message content. A disabled/resolved/withdrawn/ineligible alert remains investigation-only. Successful review queues work and records an actor-attributed audit atomically. Audit failure leaves work terminal. SMTP can duplicate a message after an ambiguous earlier acceptance; queued is not delivered or acknowledged.

If the release fails, send only its first specific failure. Do not push/merge or reset the database. Preserve local logs, Compose overrides and the old stash. After this candidate is accepted, the next engineering priority is the pilot authorization/resource evidence matrix. Actual external inbox delivery, incident ownership, independent monitoring and hosted drills remain separate requirements.
