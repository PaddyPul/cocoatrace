# Privileged review browser heading correction

The access-review browser assertion matched both the shared h1 page title and the h2 section title. It now selects the exact level2 heading. The strict locator remains enabled; no first()/nth() workaround, application behavior, authorization or migration changes. Your uploaded release output shows all three team member browser cases passed; the remaining reported failure is this ambiguous heading.

Apply this correction after both earlier fixture corrections on the existing feature branch. No dependency installation or reset is needed.

Download bettertrade-access-review-heading-fix.bundle to Downloads. Apply only the tip on the existing feature branch. Preserve local logs/Compose files/stash.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/team-access-review-v1
    if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-access-review-heading-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle missing from Downloads.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/access-review-heading-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/access-review-heading-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status; do not choose whole-file ours/theirs.' }
    'Heading correction applied. Continue with the full release below.'
}
```

Run the full release once:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes exist.' }
    cmd.exe /d /c "npm run verify:release > team-access-review-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content team-access-review-release-output.txt -Tail 80
        throw 'Release failed. Stop before push/merge; send the first specific failure.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No release pass for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed during verification.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared during verification.' }
    git push -u origin feat/team-access-review-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use the existing TEAM_ACCESS_REVIEW_PR.md full title/body and add the passing SHA/CI evidence. This correction belongs in that same PR. Required GitHub CI must pass before merge. After merge follow the existing main pull/start block. No backlog completion credit until the combined release is accepted.

Author validation: browser TypeScript compilation and quality checks passed. Browser runtime execution is not claimed on the author host; the guarded full release below remains required.
