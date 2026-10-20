# Metrics session fixture correction

The cleanup security test intentionally revokes the shared administrator session. The new metrics test incorrectly reused that token. Metrics now uses an independently enrolled administrator; a separate independently revoked identity still asserts401. Ordinary403 and anonymous401 checks remain. Production code/authorization unchanged. Native suite strictly compiles; Docker execution remains required.

Download `bettertrade-workspace-metrics-fixture-fix.bundle` into Downloads. Apply once on the current branch and repeat the focused native suite:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/workspace-state-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-metrics-fixture-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- operationsWorkers.integration.test.ts > workspace-state-native-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content workspace-state-native-output.txt -Tail 80
        throw 'Focused native check failed. Stop before full release.'
    }
    'Focused native passed. Continue the original handoff with focused browser checks, then guarded full release on the current commit.'
}
```

Do not recreate the branch or re-import the original bundle. No database reset/session revival. Use the existing WORKSPACE_STATE_CLOSURE_WINDOWS guide after this native step. Required full release/current commit checks, CI and review remain before merge. No extra progress credit for a fixture correction.
