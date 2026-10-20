# Farm totals fixture correction

The newly added aggregate test missed the farm detail paged query parameters, so no farm batch panel could render. Match both the base pathname and query; assert the farm heading before aggregate state. Test-only correction, no production rebuild or database reset needed. Browser types and formatting passed; actual browser run remains required.

Download `bettertrade-farm-totals-fixture-fix.bundle` into Downloads. Keep the existing preview running on127.0.0.1:13009 (restart it if stopped: npm run preview --workspace=web -- --host 127.0.0.1 --port 13009 --strictPort).

Run from the existing repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/workspace-state-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-farm-totals-fixture-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    $previousOrigin = $env:COCOATRACE_BROWSER_BASE_URL
    try {
        $env:COCOATRACE_BROWSER_BASE_URL = 'http://127.0.0.1:13009'
        cmd.exe /d /c "npm run test:browser -- sourceDetailFailures.spec.ts --repeat-each=2 > farm-totals-focused-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Select-String -Path '.\farm-totals-focused-output.txt' -Pattern 'FAILED:' -Context 0,25
            throw 'Focused test failed. Stop here.'
        }
        'Source-detail checks passed. Stop preview, then run the original guarded full release from candidate capture on the current commit.'
    } finally { $env:COCOATRACE_BROWSER_BASE_URL = $previousOrigin }
}
```

Do not recreate the branch or re-import prior bundles. Earlier passing focused suites do not need repeating for this test-only correction. Full release/current-commit checks and CI/review remain required before merge.
