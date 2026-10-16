# Supply/demand native fixture correction

The release exposed three test defects: a listing INSERT omitted required origin/destination fields; a fake audit actor assumed a foreign-key constraint that audit_events intentionally does not have; repeated scenarios exhausted the real actor mutation budget before the concurrency test. Corrections supply real locations, inject a target-scoped PostgreSQL audit failure trigger through the HTTP handler and remove it in finally, and reset only disposable rate counters between scenarios with a database-name safety guard. The concurrent requests still share their normal budget. Application authorization, rate limits, migrations and business behavior are unchanged.

Download bettertrade-supply-demand-fixture-fix.bundle to Downloads. Apply only the tip on the existing branch; preserve stash/local Compose files/logs. Do not reapply after success. Keep the existing PR title/body and add the final passing SHA/CI evidence after release.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/supply-demand-lifecycle-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-supply-demand-fixture-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle missing from Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/supply-demand-fixture-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/supply-demand-fixture-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status; do not select whole-file ours/theirs.' }
    foreach ($suite in @('listingExpiry.integration.test.ts','sourcingLifecycle.integration.test.ts')) {
        $log = "$suite-output.txt"
        cmd.exe /d /c "npm run test:integration:docker --workspace=api -- $suite > $log 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content $log -Tail 120
            throw "$suite failed. Stop here and send the failure."
        }
        "$suite passed."
    }
}
```

Only after both focused suites pass:

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

Required GitHub CI must pass before merging the same PR. Then use the original handoff main pull/start instructions; no database reset or new dependency required. Native runtime cannot be executed on the author host. Author strict native compilation and quality checks pass; founder focused/full release remains required.
