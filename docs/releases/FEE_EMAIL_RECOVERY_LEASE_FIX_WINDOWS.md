# Fee email recovery lease fixture correction

Fee email outbox requires lease token and expiry together. The shared native fixture previously constructed a lone field, so PostgreSQL rejected the fixture before recovery was called. Use paired lease fields for the fee queue; retain lone-field recovery coverage for older queues. Production constraints and recovery guards are unchanged.

Apply once on the existing branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/fee-billing-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-email-recovery-lease-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- operationsEmailRecovery.integration.test.ts > fee-email-recovery-focused-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content fee-email-recovery-focused-output.txt -Tail 100
        throw 'Focused recovery failed. Stop before full release.'
    }
    'Focused recovery passed. Run original guarded full release before push/merge.'
}
```

Author formatting and strict native-suite compilation passed. Native runtime remains pending in the founder environment.
