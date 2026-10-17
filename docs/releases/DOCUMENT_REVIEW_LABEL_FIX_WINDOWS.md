# Document review accessible-name correction

The group and dropdown shared Document decision as an accessible name. The group now has a distinct name, and the real journey selects the named combobox explicitly. Decision behavior and authorization are unchanged.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch feat/document-review-history-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-document-review-label-fix.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 $candidate = (git rev-parse HEAD).Trim()
 if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
 cmd.exe /d /c "npm run verify:release > document-review-release-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Select-String -Path '.\document-review-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,25
  throw 'Release failed. Stop before push/merge.'
 }
 $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
 if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No exact-commit release pass.' }
 if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
 if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
 git push -u origin feat/document-review-history-v1
 if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
 "Release passed and pushed: $candidate"
}
```

Use the existing PR description, including submitted-status handling and the accessible-name correction in Change summary. Record actual verification results. Browser runtime remains required.
