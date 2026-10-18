# Long-form draft coverage — Windows handoff

Import once on a new branch after the previous error/draft PR is merged. Preserve original files, local overrides and logs. If the branch exists, resume its verification instead of importing again. No migration or dependency change.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/workspace-draft-coverage-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-draft-coverage-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve both audit histories.' }
    cmd.exe /d /c "npm run build --workspace=web > workspace-draft-build-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content workspace-draft-build-output.txt -Tail 80; throw 'Web build failed.' }
}
```

Start a frontend-only preview in terminal A (the following focused suites mock all API requests):

```powershell
npm run preview --workspace=web -- --host 127.0.0.1 --port 13009 --strictPort
```

In terminal B, in the same repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $previousBase = $env:COCOATRACE_BROWSER_BASE_URL
    try {
        $env:COCOATRACE_BROWSER_BASE_URL = 'http://127.0.0.1:13009'
        cmd.exe /d /c "npm run test:browser -- unsavedChanges.spec.ts recordDrafts.spec.ts recoveryDrafts.spec.ts --repeat-each=3 > workspace-draft-focused-output.txt 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Get-Content workspace-draft-focused-output.txt -Tail 100
            throw 'Focused browser checks failed. Stop before full release.'
        }
        'Focused browser checks passed. Stop preview with Ctrl+C in terminal A, then run full release.'
    } finally {
        $env:COCOATRACE_BROWSER_BASE_URL = $previousBase
    }
}
```

Then full release and push only after an exact-commit pass:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if ((git branch --show-current).Trim() -ne 'feat/workspace-draft-coverage-v1') { throw 'Wrong branch.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > workspace-draft-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content workspace-draft-release-output.txt -Tail 100
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/workspace-draft-coverage-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use WORKSPACE_DRAFT_COVERAGE_PR.md for the title/body, wait for required CI/review and merge. After merge:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git status
}
```

Browser/native/full release execution remains pending in the author environment. Accepted progress155/343 (45.2%); after accepted UX-011 closure156/343 (45.5%). Credential persistence, crash recovery and universal mobile accessibility are not supplied.

Author verification: API/web/browser types, production web build, code quality, 12 shared transport/environment tests, backlog/risk checks and startup budget passed. Entry JavaScript92,089 gzip bytes remains below the unchanged92,160-byte limit. This bundle changes no API/database behavior, so no new native integration suite is supplied; the full release still runs existing native and actual financial journeys. Mocked and native browser execution remain pending.
