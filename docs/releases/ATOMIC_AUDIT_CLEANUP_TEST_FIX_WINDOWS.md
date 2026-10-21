# Evidence cleanup audit regression correction

Apply once on the existing atomic-business-audits feature branch. No branch creation or original bundle re-import is needed.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-atomic-audit-cleanup-test-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- evidenceCleanup.integration.test.ts > atomic-cleanup-focused-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content atomic-cleanup-focused-output.txt -Tail 70; throw 'Focused test failed.' }
    'Focused test passed. Run the full release section of the original handoff, capturing the new candidate commit before verification. Push only after that commit passes.'
}
```

The obsolete post-commit best-effort audit fault test is replaced with transaction-bound completion failure rollback and successful retry/retention assertions, including exactly one completion audit. No production change. Native runtime execution requires the founder Docker environment.
