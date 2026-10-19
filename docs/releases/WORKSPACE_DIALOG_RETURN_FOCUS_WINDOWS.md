# Shared dialog focus restoration correction

Focus containment and source tests passed in the founder focused run. Remaining search/mobile navigation failures concern return focus after Escape. Explicitly remember the initiating button (or keyboard-shortcut focus) before opening, then restore it after React removes the dialog. Skip disconnected/hidden targets or a newer open modal. Keep the original focus assertions and business behavior. Actual focused browser verification remains required; no backend/schema change.

Download `bettertrade-workspace-dialog-return-focus-fix.bundle` into Downloads. Stop preview with Ctrl+C first, then apply on the existing branch and rebuild:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/workspace-resilience-sprint-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-dialog-return-focus-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    cmd.exe /d /c "npm run build --workspace=web > resilience-focus-build-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content resilience-focus-build-output.txt -Tail 60; throw 'Build failed.' }
}
```

Restart preview in terminal A:

```powershell
npm run preview --workspace=web -- --host 127.0.0.1 --port 13009 --strictPort
```

Run focused checks in terminal B from the repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $previousOrigin = $env:COCOATRACE_BROWSER_BASE_URL
    try {
        $env:COCOATRACE_BROWSER_BASE_URL = 'http://127.0.0.1:13009'
        cmd.exe /d /c "npm run test:browser -- detailReadRecovery.spec.ts sourceDetailFailures.spec.ts sharedAccessibility.spec.ts productProfilePages.spec.ts --repeat-each=2 > workspace-resilience-focused-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Select-String -Path '.\workspace-resilience-focused-output.txt' -Pattern 'FAILED:' -Context 0,25
            throw 'Focused tests failed. Stop before full release.'
        }
        'Focused checks passed. Stop preview with Ctrl+C, then run the original guarded full-release block from candidate capture.'
    } finally { $env:COCOATRACE_BROWSER_BASE_URL = $previousOrigin }
}
```

Do not re-import the original bundle or recreate the branch. Use the existing WORKSPACE_RESILIENCE_SPRINT_WINDOWS full-release block only after focused success. Current-commit release pass, required CI and review remain necessary before merge. Completion remains164/343; this correction does not add closure credit.
