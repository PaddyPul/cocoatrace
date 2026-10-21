# Recall response browser startup and revocation preconditions

Apply once on the existing controller-workflow feature branch after its browser gate failure. Do not re-import the original74-file bundle. This bundle contains a single tip commit to cherry-pick; do not replay its full history. Existing untracked local files are preserved.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/controller-workflow-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-recall-response-startup-fix.bundle'
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

Keep the original controller-workflow PR body; add the recall fixture/readiness correction to Changes and Validation. After review and GitHub merge, switch to main and pull with `git pull --ff-only origin main`, checking each command's exit code. Do not seed/reset a customer database. The full release owns isolated test infrastructure. Native and browser release gates are mandatory for this refactor.

## Evidence and limits

The reported timeout occurs at the initial Open response click, before the access-revocation assertion. This test-only update supplies complete mock organization identity, gates opening on a successful recall-list response and rendered card, scopes the button to that card, and uses a mutable authorization fixture with an observed404 before asserting controls disappear. Global timeouts and production authorization are unchanged.

Author validation: browser TypeScript and Prettier checks passed; all5 tests are discoverable. Chromium installation failed with upstream download errors, so browser behavior was not reproduced or verified author-side. This is a startup/precondition correction, not evidence of an API authorization defect. Required browser/full release validation remains pending.

If the release still fails, send the first FAILED block. The new preconditions distinguish fixture/network startup, recall rendering and actual revoked-access failure.
