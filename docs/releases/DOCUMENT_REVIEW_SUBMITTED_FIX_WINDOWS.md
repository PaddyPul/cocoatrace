# Submitted document review correction

Real uploads use submitted status. Pending reviewer queues now include submitted documents, and replacement accepts a new submitted upload then explicitly leaves it pending. Approval, independence and source checks remain intact. Native regression cases now use submitted documents for queue visibility and replacement.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-document-review-submitted-fix.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 cmd.exe /d /c "npm run test:integration:docker --workspace=api -- documentReview.integration.test.ts > document-review-submitted-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Get-Content document-review-submitted-output.txt -Tail 100
  throw 'Focused test failed. Stop here.'
 }
 'Focused test passed. Run full release with the original guarded commands before push/merge.'
}
```

Stay on the current feature branch. Add to PR Change summary: Submitted uploads appear in the pending reviewer queue and replacement accepts the real upload state without inherited approval. Record actual full release results in Verification.
