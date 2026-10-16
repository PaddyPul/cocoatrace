# Saved sourcing quality label correction

Apply this correction on your existing `feat/pilot-workspace-closure-v1` branch. The sprint remains open; do not merge a failed release. It fixes the explicit label/textarea association and a later over-escaped URL assertion in the same test. The browser regression now checks the stored note, clicking the visible label focuses the textarea, editing and reopening preserve the note, and navigation retains the correct request ID.

No dependency/schema/data change, reset or new PR is needed. Preserve stash, local Compose files and logs. Download `bettertrade-sourcing-quality-label-fix.bundle` into Downloads.

## Apply and verify

Paste the whole block:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist. Preserve them first.' }
    $branch = (git branch --show-current).Trim()
    if ($branch -ne 'feat/pilot-workspace-closure-v1') { throw "Expected feat/pilot-workspace-closure-v1; currently $branch. Stop and send the branch name." }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-sourcing-quality-label-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Correction bundle not found in Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/sourcing-quality-label-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/sourcing-quality-label-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick stopped. Send git status; do not select whole-file ours/theirs.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate commit.' }
    cmd.exe /d /c "npm run verify:release > sourcing-quality-label-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content sourcing-quality-label-release-output.txt -Tail 80
        throw 'Release failed. Stop before push/merge; send only the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'Release report is not a pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    "Release passed for $candidate"
}
```

The bundle contains complete history; cherry-pick only its tip. Do not reapply the original sprint bundle. The existing runner does not offer a reviewed single-browser-suite selection; one full release verifies the correction and all sprint outcomes.

## Push and update the existing PR

Only after the exact-commit pass:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No passing report for this commit.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    git push -u origin feat/pilot-workspace-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    Get-Content '.\docs\releases\PILOT_WORKSPACE_CLOSURE_PR.md' -Raw
}
```

Use the updated complete title/body from PILOT_WORKSPACE_CLOSURE_PR.md, add passing SHA/date and check the runtime verification boxes after the pass. Required GitHub CI must pass before merge. Keep the four closure targets open until acceptance; progress remains115/343 (33.5%), targeting119/343 (34.7%).

## After merging

```powershell
& {
    $ErrorActionPreference = 'Stop'
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Main switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Main update failed.' }
    docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
    if ($LASTEXITCODE -ne 0) { throw 'Application startup failed.' }
    git status --short
    Start-Process 'http://localhost:3000'
}
```

Author verification: web/browser type checks, production web build, initial JS budget and quality checks. Native/browser runtime is not available on the author host. No database or authorization behavior is changed by this correction.
