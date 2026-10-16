# Notification read checkbox pending-state correction

The controlled checkbox restored the last server-confirmed value during the asynchronous write. Keep the requested value visible and disabled with “Saving read status…” until completion; failed writes restore the confirmed state and preserve counts. The regression explicitly holds each response until pending UI is asserted, checks failure rollback, then retries successfully. No server/database/migration changes.

Save bettertrade-notification-read-pending-fix.bundle in Downloads. Apply only this tip to the existing unmerged agreement/notification branch. Preserve all local logs, Compose overrides and stashes.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if ((git branch --show-current).Trim() -ne 'feat/agreement-notification-v1') { throw 'Switch to the existing agreement/notification feature branch first.' }
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes before continuing.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-notification-read-pending-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle missing from Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/notification-read-pending-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/notification-read-pending-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Stop and send git status.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > agreement-notification-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content agreement-notification-release-output.txt -Tail 180
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No passing report for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    git push -u origin feat/agreement-notification-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use docs/releases/AGREEMENT_NOTIFICATION_PR.md for the existing PR. Add: “Read receipt controls retain a visible disabled pending value, roll back on failed writes and support retry; the browser regression holds responses to verify both paths.” Add the passing release SHA/date after success. Required CI must pass before merge. Then follow section4 of AGREEMENT_NOTIFICATION_WINDOWS.md for main pull/start.

Author checks: workspace types and quality; no Chromium runtime is installed here, so browser/full release acceptance remains the command above. Accepted progress remains129/343 (37.6%) until this two-item wave passes review and merge.
