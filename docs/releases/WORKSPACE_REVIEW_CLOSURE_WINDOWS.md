# Workspace review closure — Windows handoff

Download `bettertrade-workspace-review-closure-v1.bundle` into Downloads. This is a new branch from the accepted action review work. Apply the tip once; do not re-import old bundles. Preserve all local Compose files, logs and untracked files. No database reset is needed.

Run from the existing repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/workspace-review-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import; send git status.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-review-closure-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve conflicts for review.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > workspace-review-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Select-String -Path '.\workspace-review-closure-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,20
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/workspace-review-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Create the PR with the accompanying title/body. Wait for required CI, review and merge on GitHub. Only after merge:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git status --short
}
```

Acceptance focus: accepting an offer shows buyer/quantity/price and contract commitment; Cancel/Escape performs no write and rejected acceptance stays visible inside review. Recall activation and recovery snapshot review show the exact consequences before writing, preserve drafts on failure and never release retained safety holds. Same recorded action state has the same label/tone in home and deal views; physical delivery, payment and trade completion remain separate. Certificate, invitation and custody errors remain visible inside their review dialogs.

Author verification is listed in the PR body. Actual browser and full release execution require the founder environment. No backend or migration change. Accepted completion remains156/343 (45.5%); broader work is credited only after evidence supports closure.
