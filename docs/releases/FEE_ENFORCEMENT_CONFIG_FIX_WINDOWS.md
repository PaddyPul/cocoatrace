# Fee enforcement isolated configuration fixture correction

Production parseConfig returns a frozen configuration. The native test attempted Reflect.set and ignored its false result, leaving the legacy fixture flag enabled. This suite now receives its own mutable copy of validated configuration through a Vitest module mock, and asserts the switch succeeds. Production config and enforcement are unchanged.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch feat/fee-collection-enforcement-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-enforcement-config-fixture-fix.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 cmd.exe /d /c "npm run test:integration:docker --workspace=api -- feeEnforcement.integration.test.ts > fee-enforcement-focused-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Get-Content fee-enforcement-focused-output.txt -Tail 120
  throw 'Focused integration failed. Stop here.'
 }
 'Focused integration passed. Continue with full release verification only, then push after an exact-commit pass.'
}
```

Do not repeat original branch creation or feature bundle import. Keep the full feature PR description and add these disposable-runner/configuration fixture corrections to Change summary; record actual verification.
