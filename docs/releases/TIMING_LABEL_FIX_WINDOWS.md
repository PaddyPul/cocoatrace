# Stable timing reason label after editing

The controlled textarea was nested inside its label. React updates textarea default text content with the edited value; an exact label-text lookup can then include that content and stop matching. Separate labels with useId/for/id associations keep the date and reason accessible names stable. The browser regression retains its exact label assertion, now checking the populated reason before submission as well as after conflict. Form state, server revisions, permissions and migrations are unchanged.

Save bettertrade-timing-label-fix.bundle in Downloads. Apply only this tip to the existing unmerged transport awareness branch. Preserve all local logs, Compose overrides and stashes.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if ((git branch --show-current).Trim() -ne 'feat/transport-awareness-v1') { throw 'Switch to the existing transport awareness feature branch first.' }
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes before continuing.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-timing-label-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle missing from Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/timing-label-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/timing-label-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Stop and send git status.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > transport-awareness-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content transport-awareness-release-output.txt -Tail 180
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No passing report for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    git push -u origin feat/transport-awareness-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use docs/releases/TRANSPORT_AWARENESS_PR.md for the existing PR. Add: “Timing controls use explicit label associations so exact accessible names remain stable after editing; regression checks the same populated reason before and after a conflict.” Add passing release SHA/date and require CI before merge. Then follow section4 of TRANSPORT_AWARENESS_WINDOWS.md for main pull/start.

Author browser types and quality checks pass. No Chromium runtime is installed here; full release/native/browser verification remains required above. Accepted progress131/343 (38.2%) until this two-item wave passes release/review/merge.
