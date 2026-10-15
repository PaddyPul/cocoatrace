# Offer rejection field correction

The failure is the exact accessible-name lookup after entering a reason. The label previously contained the textarea. This patch uses a separate explicit label/ID, so its accessible name remains Rejection reason as text changes. The regression checks the entered value before focus refresh, waits for the actual offer-page response, then checks it again before submission and history verification.

No server, authorization, audit, database or dependency behavior changes. Your prior candidate a5e87af600f9e1544a3b0aec45609b6feaa9de6a passed all gates through native integration and evidence stress. Browser journeys failed; backup/restore did not run. Do not merge that failed candidate.

Download bettertrade-offer-rejection-label-fix.bundle into Downloads. From the project directory, paste:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/offer-lifecycle-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Feature switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-offer-rejection-label-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle not found.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/offer-rejection-label-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/offer-rejection-label-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status.' }
}
```

Apply only the tip. No npm ci or migration is needed. Run one full release and push only its passing exact commit:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > offer-lifecycle-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content offer-lifecycle-closure-release-output.txt -Tail 80
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No passing report for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/offer-lifecycle-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use the updated OFFER_LIFECYCLE_CLOSURE_PR.md for the existing PR. Record passing SHA/date and required CI before merge. Six closure targets remain pending until accepted. After required CI passes and you merge:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Main switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Main update failed.' }
    git status --short
}
```

Author verification: workspace/browser types, code quality and web production build. Actual browser runtime and the corrected full release remain your/CI acceptance; no browser execution is claimed on the author host. Preserve local logs, Compose overrides and stash.
