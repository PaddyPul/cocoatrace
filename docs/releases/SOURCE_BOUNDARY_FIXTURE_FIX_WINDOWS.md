# Source boundary fixture correction

Stay on `feat/source-resource-boundaries-v1`. This correction changes tests only: MFA authorization probes use the bounded organization page, and foreign farm cursor reads expect the private-resource 404 convention. Farm ownership is restored in finally. Production authorization and list limits remain unchanged.

Download bettertrade-source-boundary-fixture-fix.bundle into Downloads. Run from your project folder:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/source-resource-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-source-boundary-fixture-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/source-boundary-fixture-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/source-boundary-fixture-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status.' }
    foreach ($suite in @('mfa.integration.test.ts', 'sourceDetailCollections.integration.test.ts')) {
        $log = "$suite-output.txt"
        cmd.exe /d /c "npm run test:integration:docker --workspace=api -- $suite > $log 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content $log -Tail 70
            throw "$suite failed. Stop here."
        }
    }
    'Focused tests passed.'
}
```

No new dependencies or migrations. Keep local Compose overrides and logs untracked. Run the full release next:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > source-resource-boundaries-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content source-resource-boundaries-release-output.txt -Tail 80
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    git push -u origin feat/source-resource-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use SOURCE_RESOURCE_BOUNDARIES_PR.md for the existing PR title/body. Record your passing commit/date and required CI evidence; mark integration/browser verification only after those pass. Merge when required CI passes. Then:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git status
}
```

Author verification covers static compilation and code quality. Native PostgreSQL and full browser execution require your release run; they are not claimed passed here.
