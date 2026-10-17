# Load fixture isolation correction

The recorded load measurements passed, but1,005active fixture listings affected later suites' assumptions about global marketplace size. The load suite now retires only its own seller/holding listings after measurement, including failure paths. It preserves audit/history and closes connections in nested finally blocks. Other marketplace assertions use exact paged IDs or the explicit complete/overflow legacy contract. Production caps and timeouts are unchanged.

Download bettertrade-load-fixture-isolation-fix.bundle into Downloads. Apply only the tip to your existing capacity branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    if ((git branch --show-current).Trim() -ne 'feat/pilot-capacity-evidence-v1') { throw 'Switch to feat/pilot-capacity-evidence-v1 first.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-load-fixture-isolation-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/load-fixture-isolation-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/load-fixture-isolation-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > pilot-capacity-evidence-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content pilot-capacity-evidence-release-output.txt -Tail 180
        if (Test-Path '.\pilot-load-test-results\summary.json') {
            $load = Get-Content '.\pilot-load-test-results\summary.json' -Raw | ConvertFrom-Json
            if ($load.commit -eq $candidate) {
                $load.workloads | Select-Object name, sampleCount, errors, p95Ms, p99Ms, invariantsPassed | Format-Table
            }
        }
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    'Release passed. Continue with the existing capacity push/PR instructions.'
}
```

Keep the existing PR title/body. Add this sentence to Change summary: “Retire scoped load listings after every run and make marketplace regressions independent of unrelated public inventory, preserving explicit legacy overflow.” Update Verification with the final passing SHA/date. Do not mark the full release passed from the earlier load-only measurements.

Author: strict compilation of the load/catalog/trading integration suites passed. Docker/native runtime remains pending. Preserve local Compose overrides, logs and stashes; no reset or data deletion is needed.
