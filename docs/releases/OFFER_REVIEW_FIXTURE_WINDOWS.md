# Offer review regression follow-up

The full release reported a missing Accept action in the new mocked offer-review test. Its log did not distinguish initial loading from reopening after Escape. This correction explicitly selects received offers, waits for the exact buyer row, scopes Accept to that row and scopes the rejected-write error to its dialog. No production permissions or acceptance rules are changed. Browser types passed author-side; actual browser execution is required. Do not count this as a release pass.

Download `bettertrade-offer-review-fixture-followup.bundle` to Downloads. Apply once on the current feature branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/workspace-review-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-offer-review-fixture-followup.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    cmd.exe /d /c "npm run build --workspace=web > offer-review-build-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content offer-review-build-output.txt -Tail 60; throw 'Build failed.' }
}
```

Start frontend preview in terminal A:

```powershell
npm run preview --workspace=web -- --host 127.0.0.1 --port 13009 --strictPort
```

Run in terminal B from the repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $previousOrigin = $env:COCOATRACE_BROWSER_BASE_URL
    try {
        $env:COCOATRACE_BROWSER_BASE_URL = 'http://127.0.0.1:13009'
        cmd.exe /d /c "npm run test:browser -- offerPages.spec.ts --repeat-each=3 > offer-review-focused-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Select-String -Path '.\offer-review-focused-output.txt' -Pattern 'FAILED:' -Context 0,30
            throw 'Focused browser test failed. Stop before full release.'
        }
        'Focused browser checks passed. Stop preview with Ctrl+C, then rerun the original guarded full release on the current commit.'
    } finally {
        $env:COCOATRACE_BROWSER_BASE_URL = $previousOrigin
    }
}
```

After focused success stop preview, then use the existing WORKSPACE_REVIEW_CLOSURE_WINDOWS release block starting with candidate capture. Do not recreate the branch or re-import the original bundle. Full release must pass for the new commit before push/merge.
