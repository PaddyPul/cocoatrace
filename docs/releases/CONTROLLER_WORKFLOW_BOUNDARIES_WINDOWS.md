# Controller workflow boundaries

Apply once from the repository root after the API type-safety release has been merged and pulled. This bundle contains a single tip commit to cherry-pick; do not replay its full history. Existing untracked local files are preserved.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/controller-workflow-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-controller-workflow-boundaries-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status and conflicted diff.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > controller-workflow-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content controller-workflow-release-output.txt -Tail 70
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/controller-workflow-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Open the PR using CONTROLLER_WORKFLOW_BOUNDARIES_PR.md. After review and GitHub merge, switch to main and pull with `git pull --ff-only origin main`, checking each command's exit code. Do not seed/reset a customer database. The full release owns isolated test infrastructure. Native and browser release gates are mandatory for this refactor.
