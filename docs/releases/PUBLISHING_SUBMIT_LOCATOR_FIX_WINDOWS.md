# Publishing submit locator correction

The two supplier journeys matched both navigation and submit buttons. The shared publish helper now scopes the submit button to main content. No product behavior change. The later waitForResponse message was a consequence of the aborted click, not a separate failure.

Download bettertrade-publishing-submit-locator-fix.bundle into Downloads and apply only its tip to the existing feature branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    if ((git branch --show-current).Trim() -ne 'feat/pilot-journey-contracts-v1') { throw 'Switch to feat/pilot-journey-contracts-v1 first.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-publishing-submit-locator-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/publishing-submit-locator-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/publishing-submit-locator-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > pilot-journey-contracts-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content pilot-journey-contracts-release-output.txt -Tail 180
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    'Release passed. Continue with the existing push/PR instructions.'
}
```

Existing PILOT_JOURNEY_CONTRACTS_PR.md title/body still applies; add the final passing SHA/date. Runtime browser verification remains required. Preserve all local logs, Compose overrides and stashes.
