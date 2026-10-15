# Windows risk register comparison correction

The risk view was compared byte-for-byte with LF output while Git can materialize CRLF on Windows. This correction normalizes CRLF to LF only for comparison and pins the generated view to LF in .gitattributes. It does not trim whitespace, change risk data or regenerate/accept stale content. Tests prove a CRLF checkout passes and changed wording or spacing still fails.

No migration, dependencies, business data or API change. Do not manually regenerate the risk register as a workaround or merge the failed release. Keep your current feature branch and apply only this correction tip.

Download bettertrade-risk-register-windows-fix.bundle into Downloads. From the project directory, paste:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch feat/pilot-integrity-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Feature switch failed.' }
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-risk-register-windows-fix.bundle'
    if (-not (Test-Path $bundle)) { throw 'Bundle not found.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git fetch "$bundle" 'HEAD:refs/remotes/bundle/risk-register-windows-fix'
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick bundle/risk-register-windows-fix
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Send git status.' }
}
```

Apply only the tip. No npm ci or migration is needed. Run one full release and push only its passing exact commit:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
    cmd.exe /d /c "npm run verify:release > pilot-integrity-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content pilot-integrity-closure-release-output.txt -Tail 80
        throw 'Release failed. Stop before push/merge.'
    }
    $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
    if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No passing report for this commit.' }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
    if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
    git push -u origin feat/pilot-integrity-closure-v1
    if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
    "Release passed and pushed: $candidate"
}
```

Use the updated PILOT_INTEGRITY_CLOSURE_PR.md for the existing PR. Record passing SHA/date and required CI before merge. Five new closure targets remain pending until accepted. After required CI passes and you merge:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Main switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Main update failed.' }
    git status --short
}
```

Author verification: three risk-register tests, including actual CRLF fixture and genuine content/spacing drift, code quality and eleven release-runner tests. Full Docker/browser release runtime remains your/CI acceptance; no native/browser execution is claimed on the author host. Preserve local logs, Compose overrides and stash.
