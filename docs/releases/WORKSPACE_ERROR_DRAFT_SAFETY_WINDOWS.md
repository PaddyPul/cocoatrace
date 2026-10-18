# Workspace errors and draft navigation safety

Import once on a new branch from updated main. Preserve local logs, overrides and original files. Existing feature branch means resume verification, not re-import. No migrations or dependencies changed.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/workspace-error-draft-safety-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-error-draft-safety-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve both histories.' }
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- errorEnvelope.integration.test.ts > workspace-error-focused-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content workspace-error-focused-output.txt -Tail 100
        throw 'Focused integration failed. Stop before full release.'
    }
    'Focused integration passed. Continue with full release.'
}
```

Run full verification and push only within its successful guard:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if ((git branch --show-current).Trim() -ne 'feat/workspace-error-draft-safety-v1') { throw 'Wrong branch.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > workspace-error-draft-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content workspace-error-draft-release-output.txt -Tail 100
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/workspace-error-draft-safety-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use WORKSPACE_ERROR_DRAFT_SAFETY_PR.md for the PR title/body. Wait for required review/CI, merge the PR, then:

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

Native database/browser/full release execution remains pending in the author environment. Browser reload/tab-close warnings are best effort; draft persistence and recovery after crashes are not supplied. See the explicit adoption inventory for remaining forms.

Author validation: 1,479 API unit tests passed; 12 shared frontend transport/environment tests passed. API/web/browser types, strict native regression compilation, API/web production builds, code quality, authorization inventory, migration integrity, backlog and risk checks passed. Initial entry JavaScript is 92,052 gzip bytes against the unchanged 92,160-byte budget. Five mocked browser scenarios are supplied, including failed save, back navigation, security bypass and unavailable review chunk; browser/native runtime is not claimed.

Accepted completion:154/343 (44.9%). ARC-023 acceptance after this release/merge would make155/343 (45.2%). UX-011 remains partial because financial/admin forms and same-page modal-close warnings still require adoption.
