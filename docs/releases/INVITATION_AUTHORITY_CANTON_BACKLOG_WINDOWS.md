# Invitation authority + Canton backlog: Windows handoff

Based on merged main `1c9afc564c1ea3013f5c6a2dd1c33c956c65a86f` (PR #138). Import the bundle once. Stop if any command throws; send the error/output instead of continuing. Keep Docker Desktop running. No database reset, paid service, new dependency, migration or environment change is needed.

Delivered: live transactional invitation resend/revoke authority, 16 new unit cases, six native regression definitions, Canton requirements/import and repository integration map, 19 tracked Canton tasks, and an explicit remaining invitation outbox plan. Author's 1,588 unit cases, focused 28-case invitation run, types, API build, quality, backlog and native test compilation passed. Native/full release still require your machine.

## 1. Download and extract

Extract the ZIP into `C:\Users\Albert\Downloads\bettertrade-next-bundle`. That folder should contain `bettertrade-invitation-authority-canton-backlog.bundle` plus this handoff, the PR text and a SHA-256 checksum file. Do not import the old atomic-audit correction again.

## 2. Apply once, capture candidate, run full release, then push

Paste the whole block into PowerShell. Test output goes to a timestamped folder under Windows TEMP; the final lines show its path. Run only this block initially; it pushes only after an exact-commit pass and does not merge.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location 'C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt'
    $branch = 'feat/invitation-authority-canton-backlog'
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-next-bundle\bettertrade-invitation-authority-canton-backlog.bundle'
    if (-not (Test-Path $bundle)) { throw "Bundle not found: $bundle" }
    $changes = git status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0) { throw 'Cannot check working tree.' }
    if ($changes) { git status --short; throw 'Preserve tracked changes before importing.' }
    git show-ref --verify --quiet "refs/heads/$branch"
    if ($LASTEXITCODE -eq 0) { throw 'Candidate branch already exists. Do not import twice; use the resume section.' }
    if ($LASTEXITCODE -ne 1) { throw 'Cannot check candidate branch.' }
    git fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch to main failed.' }
    git merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Main update failed; do not force or reset.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git merge-base --is-ancestor 1c9afc564c1ea3013f5c6a2dd1c33c956c65a86f HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Merged atomic-audit baseline is missing from main.' }
    git switch -c $branch
    if ($LASTEXITCODE -ne 0) { throw 'Candidate branch creation failed.' }
    git fetch "$bundle" refs/heads/feat/invitation-authority-canton-backlog
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Stop and send git status; do not repeat import.' }
    $candidate = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot capture candidate.' }
    $candidate = "$candidate".Trim()
    Write-Host "Candidate before verification: $candidate"
    git show --stat --oneline HEAD
    $logDir = Join-Path $env:TEMP ('bettertrade-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $logDir | Out-Null
    $logFile = Join-Path $logDir 'release-output.txt'
    $summary = '.\release-test-results\summary.json'
    if (Test-Path $summary) { Remove-Item $summary -Force }
    Write-Host "Running full release. Log: $logFile"
    cmd.exe /d /c "npm run verify:release > `"$logFile`" 2>&1"
    $releaseExit = $LASTEXITCODE
    if ($releaseExit -ne 0) {
        Get-Content $logFile -Tail 100
        throw "Full release failed. Nothing pushed. Log: $logFile"
    }
    if (-not (Test-Path $summary)) { throw 'Missing release summary; do not push.' }
    $report = Get-Content $summary -Raw | ConvertFrom-Json
    if ($report.status -ne 'passed' -or $report.commit -ne $candidate) { throw 'No full release pass for this candidate.' }
    $current = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or "$current".Trim() -ne $candidate) { throw 'HEAD changed; reverify.' }
    $currentBranch = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or "$currentBranch".Trim() -ne $branch) { throw 'Branch changed.' }
    $changes = git status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0 -or $changes) { throw 'Tracked tree changed or could not be checked; do not push.' }
    git push -u origin $branch
    if ($LASTEXITCODE -ne 0) { throw 'Release passed but push failed; send the error.' }
    Write-Host "RELEASE PASSED AND PUSHED: $candidate"
    Write-Host "Log: $logFile"
}
```

PowerShell 7 users: if your profile sets `$PSNativeCommandUseErrorActionPreference`, a nonzero native exit may stop before the custom error tail. The failed command still prevents push. Read the printed log path or use the resume procedure after fixing the underlying problem.

## 3. Resume verification without importing again

If the branch already exists or a prior release failed, do not import again. Use the standalone `VERIFY_AND_PUSH.ps1` included in the ZIP:

```powershell
& "$env:USERPROFILE\Downloads\bettertrade-next-bundle\VERIFY_AND_PUSH.ps1"
```

It checks the branch and tracked tree, captures HEAD before the full release, checks its report and pushes only on success. After any correction, commit it first, then rerun this verifier. If a cherry-pick is still in progress, stop and send `git status` instead.

## 4. PR, merge, pull and start

After `RELEASE PASSED AND PUSHED`, open:

https://github.com/PaddyPul/cocoatrace/compare/main...feat/invitation-authority-canton-backlog?expand=1

Use title/body from `INVITATION_AUTHORITY_CANTON_BACKLOG_PR.md`. Add your passing candidate SHA/date and required CI evidence. Review the diff and wait for required checks before merging in GitHub. Do not bypass failed checks or claim Docker results from author-only compilation.

After GitHub reports merged:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location 'C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed; do not reset.' }
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw 'Application startup failed.' }
    docker compose ps
    Start-Process 'http://localhost:3000'
}
```

One targeted smoke check: use an existing authorized team administrator and fresh passkey verification to resend/revoke a disposable pending invitation. Confirm revoked links are invalid. Do not send to real people unless you intend to invite them. Automated release covers the existing broader journeys; no full manual trade walkthrough is needed for this slice.

## Next bundle

Durable invitation delivery across approval and team invitation producers, safe token recovery, bounded worker retries and operational status; initial-issuance authority review; then remaining write/audit inventory. See `docs/engineering/INVITATION_DELIVERY_NEXT.md`.

Canton stays optional P2: review CT-00, resolve CT-01 ADRs, then isolated ledger/JWT/party/Daml proof. The current bundle contains no Canton services, wallets, ledger writes, payment custody or deployment.
