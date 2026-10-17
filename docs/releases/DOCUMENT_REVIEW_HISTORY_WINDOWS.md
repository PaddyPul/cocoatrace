# Document review and replacement history

Import the bundle tip onto updated main. Preserve local overrides/logs; do not reset databases.

```powershell
& {
 $ErrorActionPreference = 'Stop'
 if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
 git switch main
 if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
 git pull --ff-only origin main
 if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
 git switch -c feat/document-review-history-v1
 if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed.' }
 $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-document-review-history-v1.bundle'
 git bundle verify "$bundle"
 if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
 git fetch "$bundle" HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
 git cherry-pick FETCH_HEAD
 if ($LASTEXITCODE -ne 0) { throw 'Stop and send git status.' }
 cmd.exe /d /c "npm ci > document-review-install-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) { throw 'Install failed.' }
 $candidate = (git rev-parse HEAD).Trim()
 cmd.exe /d /c "npm run verify:release > document-review-release-output.txt 2>&1"
 if ($LASTEXITCODE -ne 0) {
  Get-Content document-review-release-output.txt -Tail 180
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

Create the PR using DOCUMENT_REVIEW_HISTORY_PR.md; update validation checkboxes only from actual results. After required CI/review/merge, switch main and pull --ff-only. Migration048 is required. Hardened runtime migrates through Node startup, not npm exec. Author cannot run Docker/native/browser acceptance here.

Author verification:1,430 API unit tests passed; workspace/browser types, API/web builds, quality, migration integrity,226-route inventory, web budgets, backlog/risk checks and strict native test compilation passed. Database/browser runtime remains pending. Accepted completion151/343 (44.0%); two target closures153/343 (44.6%) only after acceptance.
