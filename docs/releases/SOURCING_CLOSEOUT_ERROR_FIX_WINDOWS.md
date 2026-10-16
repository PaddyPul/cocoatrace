# Sourcing closeout browser error-envelope correction

The mocked400 response used message, while the production API and shared client use error. This caused the correct error state to show HTTP400 instead of the intended explanation. The mock now follows the real error envelope. Application transport, authorization and status handling remain unchanged; reason-preservation and terminal-reload assertions remain strict.

Download bettertrade-sourcing-closeout-error-fix.bundle to Downloads. Apply only the tip on the existing branch; preserve stash/local Compose files/logs. Do not reapply after success. Keep the existing PR title/body and add the final passing SHA/CI evidence after release.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/supply-demand-lifecycle-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-sourcing-closeout-error-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle missing from Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/sourcing-closeout-error-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/sourcing-closeout-error-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status; do not select whole-file ours/theirs.' }
    'Browser mock correction applied.'
}
```

Run the full release after applying:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > supply-demand-lifecycle-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content supply-demand-lifecycle-release-output.txt -Tail 180
        throw 'Release failed. Stop before push/merge; send the failure section.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    git push -u origin feat/supply-demand-lifecycle-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Required GitHub CI must pass before merging the same PR. Then use the original handoff main pull/start instructions; no database reset or new dependency required. Native runtime cannot be executed on the author host. Author browser compilation and quality checks pass; founder focused/full release remains required.
