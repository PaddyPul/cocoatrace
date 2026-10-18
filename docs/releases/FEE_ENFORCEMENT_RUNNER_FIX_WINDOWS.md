# Fee enforcement disposable-runner correction

The integration runner configured TEST_DATABASE_URL but inherited the normal application DATABASE_URL during storage preflight. It now sets both to its own disposable Docker database. The configuration isolation guard is unchanged; no application database is reset or migrated by this correction.

Apply this tip once on the current fee enforcement feature branch. Do not re-import the original feature bundle.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch feat/fee-collection-enforcement-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch switch failed.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-fee-enforcement-runner-fix.bundle'
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
 'Focused integration passed. Run full release verification only, then push after an exact-commit pass.'
}
```

Use the verification portion of the original handoff starting with candidate=git rev-parse HEAD. Do not repeat branch creation or bundle import. Keep existing full PR description; note disposable runner isolation correction under Change summary and actual verification results.
