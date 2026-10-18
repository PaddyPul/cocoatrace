# Versioned platform fee collection enforcement

Import only this bundle tip after the prior delivery/fee/register correction is merged and main updated. No historical fees change. Migration049 is required. New local/deployed trades default to v3; do not set TEST_LEGACY_FEE_POLICY outside disposable regression tests. No payment provider/bank instructions are invented or enabled.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch main
 if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
 git pull --ff-only origin main
 if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
 git switch -c feat/fee-collection-enforcement-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed. Do not import again onto an existing branch.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-collection-enforcement-v1.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status; preserve both audit histories.' }
 cmd.exe /d /c "npm run test:integration:docker --workspace=api -- feeEnforcement.integration.test.ts > fee-enforcement-focused-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Get-Content fee-enforcement-focused-output.txt -Tail 120
  throw 'Focused fee integration failed. Stop before full release.'
 }
 $candidate = (git rev-parse HEAD).Trim()
 if ($LASTEXITCODE -ne 0) { throw 'Cannot read candidate.' }
 cmd.exe /d /c "npm run verify:release > fee-enforcement-release-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Select-String -Path '.\fee-enforcement-release-output.txt' -Pattern 'FAILED:|FAIL |Error:' -Context 0,25
  throw 'Release failed. Stop before push/merge.'
 }
 $release = Get-Content '.\release-test-results\summary.json' -Raw | ConvertFrom-Json
 if ($release.status -ne 'passed' -or $release.commit -ne $candidate) { throw 'No exact-commit release pass.' }
 if ((git rev-parse HEAD).Trim() -ne $candidate) { throw 'Commit changed.' }
 if (git status --porcelain --untracked-files=no) { throw 'Tracked changes appeared.' }
 git push -u origin feat/fee-collection-enforcement-v1
 if ($LASTEXITCODE -ne 0) { throw 'Push failed.' }
 "Release passed and pushed: $candidate"
}
```

Use FEE_COLLECTION_ENFORCEMENT_PR.md, record actual verification and wait for required CI/review before merge. Preserve local overrides/logs. After merge/pull rebuild the stack; hardened API startup runs migrations through Node, not npm exec.

Author cannot run Docker/native/browser runtime. The complete release on the actual candidate remains required. PAY-011/PAY-012 remain partial because payment channel/tax/outbound invoices and paid-trade compensation are separate outstanding work. Accepted completion153/343 (44.6%).

Author verification:1,450 API unit tests passed, workspace/browser types, both builds, quality,229-route authorization inventory, migration integrity, web budgets, backlog/risk checks and strict native compilation passed. Full Docker/native/browser runtime remains pending.
