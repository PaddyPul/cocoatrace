# Pilot sprint browser corrections

Two test defects: the QR batch mock did not match the production `?evidenceMode=paged` query; document review could match editor text before its asynchronous POST committed. Correct the URL mock and explicitly require the decision POST to return200 before the owner history read. Existing rejection/reload and cancel/no-write assertions remain. No production, API or migration change. Browser types and diff checks passed; actual browser/full release remains required.

Download `bettertrade-pilot-sprint-browser-fix.bundle` to Downloads. Run on the existing feature branch, not a new branch:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/pilot-review-evidence-sprint-v1
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-pilot-sprint-browser-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > pilot-review-evidence-sprint-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Select-String -Path '.\pilot-review-evidence-sprint-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,25
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/pilot-review-evidence-sprint-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use the existing sprint PR body, adding these browser-fixture corrections under Changes/Validation. Required CI/review/merge remain. Progress stays157/343 pending acceptance, target164/343.
