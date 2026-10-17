# Combined delivery acceptance and platform fee correction

Use this one bundle instead of the unapplied delivery-acceptance-guidance bundle. It includes both fixes in a single tip commit.

Fee policy: estimate at offer acceptance; fee due from recorded payer (normally seller) when the trade completes. Payment is external and separate from goods payment. A payer reference is not proof of collection; platform finance verifies the receipt. No automatic debit/deduction is implemented. Obtain confirmed instructions from platform finance before transferring.

Immediate delivery workaround: enter actual inspection findings in Inspection note (at least10characters).

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch main
 if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
 git pull --ff-only origin main
 if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
 git switch -c fix/delivery-fee-closeout-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed. Do not re-import an existing branch.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-delivery-fee-closeout-v1.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 $candidate = (git rev-parse HEAD).Trim()
 if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
 cmd.exe /d /c "npm run verify:release > delivery-fee-closeout-release-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Select-String -Path '.\delivery-fee-closeout-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,25
  throw 'Release failed. Stop before push/merge.'
 }
 $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
 if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No exact-commit release pass.' }
 if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
 if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
 git push -u origin fix/delivery-fee-closeout-v1
 if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
 "Release passed and pushed: $candidate"
}
```

Use DELIVERY_FEE_CLOSEOUT_PR.md, record actual verification and merge after required CI/review. Pull main afterward and rebuild the local stack to view changes. No migration. Preserve local overrides/logs. Author has no Docker/browser runtime; full release acceptance remains pending.
