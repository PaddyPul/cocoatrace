# Fee billing migration UUID correction

Migration 051 failed before native tests loaded because uuid_generate_v4() requires an extension absent from the disposable database. Use PostgreSQL gen_random_uuid(), consistent with migration 050. This corrects the unreleased candidate migration and its manifest entry; no historical released migration changes. No extension installation, database reset or volume removal is needed. A failed transactional migration rolls back and can rerun normally.

Apply this follow-up once on the existing feature branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/fee-billing-recovery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-billing-uuid-fix.bundle'
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
    'Focused tests passed. Use the original guarded full release commands before push/merge.'
}
```

Author migration-integrity tests and API types passed. Native database/browser runtime remains pending in the founder environment.
