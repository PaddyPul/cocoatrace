# Fee statement lease fixture UUID correction

Replace the remaining extension-dependent UUID call in the expired-lease native fixture with gen_random_uuid(). No production code or migration changes. A scan of api, e2e and scripts found no remaining uuid_generate_v4 calls.

Apply once on the existing branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/fee-billing-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-statement-lease-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    foreach ($suite in @(
        'feeStatementDelivery.integration.test.ts',
        'operationsEmailRecovery.integration.test.ts'
    )) {
        $log = "$suite-output.txt"
        cmd.exe /d /c "npm run test:integration:docker --workspace=api -- $suite > $log 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content $log -Tail 100
            throw "$suite failed. Stop before full release."
        }
        "$suite passed."
    }
    'Focused tests passed. Run original guarded full release before push/merge.'
}
```

Author formatting and strict native-suite compilation passed. Native runtime remains pending in the founder environment.
