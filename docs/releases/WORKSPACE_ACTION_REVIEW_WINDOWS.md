# Workspace action review and status — Windows handoff

Download `bettertrade-workspace-action-review-v1.bundle` into Downloads. This is a new branch from the accepted draft coverage work. Apply the tip once; do not re-import old bundles. Preserve all local Compose files, logs and untracked files. No database reset is needed.

Run from the existing repository:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/workspace-action-review-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import; send git status.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-workspace-action-review-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve conflicts for review.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > workspace-action-review-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Select-String -Path '.\workspace-action-review-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,20
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/workspace-action-review-v1
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

Acceptance focus: certificate Cancel causes no write, failed decision retains review; transfer lists exact custody context and writes only after confirmation; invitation resend explains invalidation of the old link and revoke distinguishes membership; offer withdrawal opens a named native dialog, focuses Cancel and Escape performs no write. Goods-paid, shipment-delivered and trade-settled badges remain distinct. Existing API checks still decide each action.

Author quality, workspace/browser types, frontend boundary tests, backlog/risk checks and production build/budget passed. Actual browser and full release execution were unavailable in the author environment. No native backend/schema change. UX-006/007 remain partial; UX-011 accepted count156/343 (45.5%).
