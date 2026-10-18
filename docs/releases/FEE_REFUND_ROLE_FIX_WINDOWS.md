# Refund capability assertion correction

The reject response belongs to independent finance, which cannot request a payer refund. Assert finance canRequest=false, then read as the payer and assert canRequest=true; the buyer still cannot request. Runtime permissions are unchanged.

Apply once on the current branch, then rerun the three focused suites:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/fee-billing-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-refund-role-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    foreach ($suite in @(
        'feeRefunds.integration.test.ts',
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

Author strict native-suite compilation and formatting passed; native runtime must run in the founder environment.
