# Repeated browser Back review correction

The Stay/Escape handlers previously closed the native dialog before React committed the blocker reset. The repeated Back test also triggered another history traversal without first asserting that reset and browser URL restoration completed. React now owns closing through unmount; the test checks three separate Back/Stay cycles, retained draft and restored URL, then explicitly verifies a fourth review before Leave. No timeout increase or relaxed assertion.

The supplied screenshot shows PostgreSQL and other CI jobs passing, with browser identity failing. It does not provide additional browser state beyond the pasted failure. Author types, web build and unchanged startup-size budget passed; browser execution remains pending.

Apply once on the existing branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/workspace-error-draft-safety-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-unsaved-back-review-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    cmd.exe /d /c "npm run build --workspace=web > unsaved-review-build-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content unsaved-review-build-output.txt -Tail 60; throw 'Web build failed.' }
}
```

For a quick repeated check without Docker/database, start this frontend-only preview in terminal A. The test mocks all API requests and uses only disposable browser context:

```powershell
npm run preview --workspace=web -- --host 127.0.0.1 --port 13009 --strictPort
```

While that preview runs, open terminal B in the repository and run:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $previousBase = $env:COCOATRACE_BROWSER_BASE_URL
    try {
        $env:COCOATRACE_BROWSER_BASE_URL = 'http://127.0.0.1:13009'
        cmd.exe /d /c "npm run test:browser -- unsavedChanges.spec.ts --repeat-each=10 > unsaved-review-repeat-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content unsaved-review-repeat-output.txt -Tail 100
            throw 'Repeated browser check failed. Stop before push/merge.'
        }
        'All repeated unsaved-change checks passed. Stop preview with Ctrl+C in terminal A, then run guarded full release.'
    } finally {
        $env:COCOATRACE_BROWSER_BASE_URL = $previousBase
    }
}
```

Then run the original exact-commit guarded full release and push. Existing PR126 updates when this branch is pushed; wait for all required CI jobs to pass before merge. Never bypass the failing browser gate or reset application data.
