# Vite Windows advisory correction

Author validation: clean npm ci, all Vite consumers resolved to6.4.4, production/full dependency gate passed (existing braces exception retained), workspace/browser types passed,1483 API unit tests passed, web build and JavaScript budget passed. Full Docker/browser release was not run author-side.

Upstream advisory: https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv

Apply once on the existing README feature branch after its dependency gate failure. This bundle contains a single tip commit to cherry-pick; do not replay its full history. Existing untracked local files are preserved.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch docs/platform-readme-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-vite-advisory-fix.bundle'
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status and conflicted diff.' }
    cmd.exe /d /c "npm ci > vite-advisory-install-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { Get-Content vite-advisory-install-output.txt -Tail 40; throw 'Install failed.' }
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > vite-advisory-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content vite-advisory-release-output.txt -Tail 70
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin docs/platform-readme-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Keep the existing README PR body and mention the Vite6.4.4 security patch under Changes and Validation. After review and GitHub merge, switch to main and pull with `git pull --ff-only origin main`, checking each command's exit code. Do not seed/reset a database as part of this documentation update.
