# Atomic business audits Windows handoff

Start from merged main. Import this new bundle once; do not re-import an existing branch. Preserve untracked local files.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    git switch -c feat/atomic-business-audits-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch exists or creation failed. Do not re-import.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-atomic-business-audits-v1.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve conflicts.' }
    cmd.exe /d /c "npm run test:integration:docker --workspace=api -- businessAuditAtomicity.integration.test.ts > atomic-audit-focused-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content atomic-audit-focused-output.txt -Tail 70; throw 'Focused integration failed.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > atomic-audit-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content atomic-audit-release-output.txt -Tail 80; throw 'Release failed. Stop before push/merge.' }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/atomic-business-audits-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Open the pull request using ATOMIC_BUSINESS_AUDITS_PR.md. After GitHub merge, switch main and pull with `git pull --ff-only origin main`.

Author environment has no Docker; native runtime acceptance remains pending.

Author validation: all 1,572 API unit tests passed; workspace/browser type checks, API build and strict standalone compilation of the native rollback suite passed. Code quality, controller boundary and backlog regression checks passed.
