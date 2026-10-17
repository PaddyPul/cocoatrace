# Document review storage fixture correction

The approval test used an invalid private object key. This changes only the test fixture to the existing evidence/environment/UUID format; production storage validation remains intact. Native runtime must be rerun.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-document-review-fixture-fix.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 cmd.exe /d /c "npm run test:integration:docker --workspace=api -- documentReview.integration.test.ts > document-review-fixture-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Get-Content document-review-fixture-output.txt -Tail 100
  throw 'Focused test failed. Stop here.'
 }
 'Focused test passed. Run full release using the original handoff before pushing.'
}
```

Stay on the current document-review feature branch. Import only the tip commit. Keep the existing PR description; add the fixture correction and actual verification result to Verification.
