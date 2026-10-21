# Durable invitation delivery: Windows handoff

Base: merged main PR #139, `8337f4dc66b58d8d3723438667742535b856555f`.
Branch: `feat/durable-invitation-delivery-v1`.
Download `bettertrade-durable-invitation-delivery-v1.bundle` directly to Downloads. No ZIP or extraction.

This candidate adds migration 052 and a private, generation-scoped invitation outbox. Existing ordinary demo email stays disabled. A dedicated `INVITATION_DELIVERY_KEY` is required if identity SMTP is enabled; the block below preserves an existing valid key and generates a local random key only when absent/blank. Never print or share it; retain it with private recovery material while encrypted deliveries remain. Synthetic release-browser tests use their own independent key. See runbooks/INVITATION_DELIVERY.md for rotation, SMTP duplicate and recovery limitations.

Author validation: 1,613 API unit cases passed; workspace/API/web/browser types, API/web builds, quality/controller boundaries, migration integrity, authorization/backlog/register checks and web entry budget passed. Native delivery/operations suites compile; Docker/native/browser/full release and real staging inbox verification remain pending. CT-00 prior accepted inspection is reconciled: 170/362 (47.0%), 57 partial, 135 open. This candidate does not close ARC-013/IDN-021.

Keep Docker Desktop running. Paste the whole block in PowerShell. Stop on any error and send it; do not import twice or force/reset. The migration collision guard stops if newer main has already allocated 052.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location 'C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt'
    $branch = 'feat/durable-invitation-delivery-v1'
    $bundle = Join-Path $env:USERPROFILE 'Downloads\bettertrade-durable-invitation-delivery-v1.bundle'
    if (-not (Test-Path $bundle)) { throw "Bundle not found: $bundle" }
    $changes = git status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0 -or $changes) { throw 'Preserve tracked changes before importing.' }
    git show-ref --verify --quiet "refs/heads/$branch"
    if ($LASTEXITCODE -eq 0) { throw 'Branch already exists; do not import twice. Send git status.' }
    if ($LASTEXITCODE -ne 1) { throw 'Cannot check candidate branch.' }
    git fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Main update failed; do not reset.' }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
    git merge-base --is-ancestor 8337f4dc66b58d8d3723438667742535b856555f HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Expected merged baseline is missing.' }
    if (Get-ChildItem '.\api\src\migrations\052_*.ts') { throw 'Main already has migration 052; stop for an updated bundle.' }
    git switch -c $branch
    if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed.' }
    git fetch "$bundle" refs/heads/feat/durable-invitation-delivery-v1
    if ($LASTEXITCODE -ne 0) { throw 'Bundle fetch failed.' }
    git cherry-pick FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cherry-pick failed. Stop and send git status.' }

    # Preserve an existing encryption key. Never print its value.
    if ($env:INVITATION_DELIVERY_KEY) {
        if ($env:INVITATION_DELIVERY_KEY -notmatch '^[a-fA-F0-9]{64}$') { throw 'Existing environment invitation key has invalid format; preserve it and review.' }
    } else {
        $keyPath = Join-Path (Get-Location).Path '.env'
        $keyText = if (Test-Path $keyPath) { [System.IO.File]::ReadAllText($keyPath) } else { '' }
        $keyEntries = [regex]::Matches($keyText, '(?m)^[ \t]*INVITATION_DELIVERY_KEY[ \t]*=([^\r\n]*)')
        if ($keyEntries.Count -gt 1) { throw 'Duplicate invitation key entries; review without sharing their values.' }
        $existingKey = if ($keyEntries.Count -eq 1) { $keyEntries[0].Groups[1].Value.Trim() } else { '' }
        if ($existingKey -and $existingKey -notmatch '^[a-fA-F0-9]{64}$') { throw 'Existing .env invitation key has invalid format; do not overwrite it.' }
        if (-not $existingKey) {
            $keyBytes = New-Object byte[] 32
            $keyGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            try { $keyGenerator.GetBytes($keyBytes) } finally { $keyGenerator.Dispose() }
            $newKey = [BitConverter]::ToString($keyBytes).Replace('-', '').ToLowerInvariant()
            if ($keyEntries.Count -eq 1) { $keyText = $keyText.Replace($keyEntries[0].Value, 'INVITATION_DELIVERY_KEY=' + $newKey) }
            else { $keyText += "`r`nINVITATION_DELIVERY_KEY=$newKey`r`n" }
            [System.IO.File]::WriteAllText($keyPath, $keyText, [System.Text.UTF8Encoding]::new($false))
            Write-Host 'Dedicated invitation key saved locally; value not displayed.'
        }
    }

    # Capture the committed candidate BEFORE full verification.
    $candidate = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot capture candidate.' }
    $candidate = "$candidate".Trim()
    Write-Host "Candidate: $candidate"
    git show --stat --oneline HEAD
    $logFile = Join-Path $env:TEMP ('bettertrade-invitation-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
    $summary = '.\release-test-results\summary.json'
    if (Test-Path $summary) { Remove-Item $summary -Force }
    Write-Host "Running full release. Log: $logFile"
    cmd.exe /d /c "npm run verify:release > `"$logFile`" 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content $logFile -Tail 100
        throw "Full release failed. Nothing pushed. Log: $logFile"
    }
    if (-not (Test-Path $summary)) { throw 'Release summary missing; do not push.' }
    $report = Get-Content $summary -Raw | ConvertFrom-Json
    if ($report.status -ne 'passed' -or $report.commit -ne $candidate) { throw 'No passing full release for this candidate.' }
    $current = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or "$current".Trim() -ne $candidate) { throw 'HEAD changed; reverify.' }
    $currentBranch = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or "$currentBranch".Trim() -ne $branch) { throw 'Branch changed.' }
    $changes = git status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0 -or $changes) { throw 'Tracked tree changed; do not push.' }
    git push -u origin $branch
    if ($LASTEXITCODE -ne 0) { throw 'Release passed but push failed; send the error.' }
    Write-Host "RELEASE PASSED AND PUSHED: $candidate"
}
```

After success, open https://github.com/PaddyPul/cocoatrace/compare/main...feat/durable-invitation-delivery-v1?expand=1

PR title: **Make invitation delivery durable and recoverable**

The complete body follows the required template:

```powershell
Get-Content .\docs\releases\DURABLE_INVITATION_DELIVERY_V1_PR.md -Raw
```

Add the actual passing SHA/date and CI results; check native/browser boxes only after their runs pass. Review and wait for required CI before merging in GitHub.

After merge, pull and start through the normal hardened startup (which applies migration 052):

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Set-Location 'C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt'
    if (git status --porcelain --untracked-files=no) { throw 'Preserve tracked changes first.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'Switch failed.' }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Pull failed.' }
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw 'Startup failed.' }
    docker compose ps
    Start-Process 'http://localhost:3000'
}
```

Targeted smoke: use a synthetic test email, confirm invitation pending/sent/suppressed status is honest, resend invalidates the original link and revoke blocks acceptance; inspect the new invitation job/queue in Operations with a current platform administrator. The default demo remains email-disabled and uses its existing test links. Do not enable real SMTP or send real invitations merely to repeat the automated checks. No full manual trade walkthrough or volume reset is required.

If the release fails or the branch already exists, stop and send the displayed error and `git status`; do not replay import or change migration numbers by hand. A corrected commit needs a fresh full release before push.
