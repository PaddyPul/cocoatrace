> Superseded before application: use DELIVERY_FEE_CLOSEOUT_WINDOWS.md to apply delivery guidance and fee status together.

# Delivery acceptance guidance correction

Immediate workaround: enter your actual inspection findings in Inspection note (at least10characters). The screenshot showed this field empty. Full quantity and checked confirmation alone do not satisfy the existing requirements.

The correction makes these requirements visible. Import only the bundle tip after updating main; preserve local overrides/logs.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch main
 if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
 git pull --ff-only origin main
 if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
 git switch -c fix/delivery-acceptance-guidance-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed. Do not re-import an existing branch.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-delivery-acceptance-guidance-v1.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 $candidate = (git rev-parse HEAD).Trim()
 if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
 cmd.exe /d /c "npm run verify:release > delivery-acceptance-guidance-release-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Select-String -Path '.\delivery-acceptance-guidance-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,25
  throw 'Release failed. Stop before push/merge.'
 }
 $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
 if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No exact-commit release pass.' }
 if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
 if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
 git push -u origin fix/delivery-acceptance-guidance-v1
 if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
 "Release passed and pushed: $candidate"
}
```

Use DELIVERY_ACCEPTANCE_GUIDANCE_PR.md for the PR, update actual verification, wait for required CI/review and merge. No migration required. Rebuild the local stack after pulling the merged change to see updated UI. Author has no Docker/browser runtime; full release remains required.
