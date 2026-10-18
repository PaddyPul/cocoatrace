# Error-envelope nondisclosure assertion correction

Different HTTP requests legitimately have different correlation IDs. A shared assertion now checks each requestId matches its own response header, then compares every other body field exactly. Status404 and NOT_FOUND are required for both responses. Source, payment, transport and recall authorization nondisclosure checks use the helper; two direct farm-denial assertions include the new code/requestId fields. No production authorization or error policy changes. Successful forgot-password response equality remains unchanged.

Apply once on the existing branch, preserving logs/overrides:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/workspace-error-draft-safety-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-error-envelope-denial-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    foreach ($suite in @(
        'sourceResourceBoundary.integration.test.ts',
        'paymentWorkflow.integration.test.ts',
        'transportResponsibilities.integration.test.ts',
        'authorizationRoutes.integration.test.ts',
        'multiTenantApi.integration.test.ts'
    )) {
        $log = "$suite-output.txt"
        cmd.exe /d /c "npm run test:integration:docker --workspace=api -- $suite > $log 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content $log -Tail 100
            throw "$suite failed. Stop before full release."
        }
        "$suite passed."
    }
    'Focused tests passed. Run the original guarded full release before push/merge.'
}
```

Author strict TypeScript compilation of all five affected native suites passed. Native runtime remains pending in the founder environment. No database/schema or runtime changes.
