# Transport state-machine and cookie-write security boundaries: Windows handoff

Pilot evidence/fixture wave is accepted:136/343 (39.7%). This bundle targets ARC-007 typed modular transport transitions and SEC-007 complete registered cookie-write origin regressions. Acceptance yields138/343 (40.2%). Core11/28 and provider-inclusive11/40 unchanged.

Download bettertrade-transport-security-boundaries-v1.bundle into Downloads. Preserve existing stash, local Compose files and logs; cherry-pick only the tip. No migrations, dependencies, secrets or intended customer behavior change. Normal startup remains Node-based; no database reset or npm inside hardened API.

## 1. Apply on a new feature branch

Download `bettertrade-transport-security-boundaries-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

Paste this entire block:

```powershell
& {
    $ErrorActionPreference = "Stop"
    cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them first." }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
    git switch -c feat/transport-security-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-transport-security-boundaries-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/transport-security-boundaries-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/transport-security-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
    git log -2 --oneline
    git status --short
}
```

The bundle contains complete history for portability. Apply only the tip as above. Dependencies are unchanged; reuse the installation from the release that just passed.

## 2. Run one full release gate

Start Docker Desktop. Stop other test/build runs. Redirection happens inside cmd.exe, so ordinary Docker/Vite stderr progress does not trigger PowerShell NativeCommandError. Native exit codes are still checked. Paste the entire block; the success message is inside its guards.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot read candidate commit." }
    cmd.exe /d /c "npm run verify:release > transport-security-boundaries-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content transport-security-boundaries-release-output.txt -Tail 180
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The release includes transport/domain architecture and cookie-origin regressions and all existing migration and backup/restore gates. No new migrations, reset or dependency install are required. On failure send only the first specific failure and its response code.

## 3. Push and create the PR

Only after the exact-commit release passes:

```powershell
& {
    $ErrorActionPreference = "Stop"
    $candidate = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Cannot read candidate." }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "No passing release report for this commit." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Verify the final commit first." }
    git push -u origin feat/transport-security-boundaries-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\TRANSPORT_SECURITY_BOUNDARIES_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in TRANSPORT_SECURITY_BOUNDARIES_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

## 4. Merge, synchronize and start

After merging the PR:

```powershell
& {
    $ErrorActionPreference = "Stop"
    git switch main
    if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
    docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
    if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
    git status --short
    Start-Process "http://localhost:3000"
}
```

No new migrations or dependencies are required. Existing frozen migration assets remain untouched. The API automatically applies any pending registered migrations via Node; do not invoke npm/npx inside the hardened container or reset the database.

No manual persona checklist is required for this batch. The existing accepted onboarding, trade, passkey, operations and browser suites remain part of the full release.

Report “release checks passed and merge/pull completed” once done. Two transport/security targets close after review/release/merge acceptance; hosted operations and independent review exercises remain separate.





Author validation results are recorded in the PR description. Full native and browser runtime acceptance remains the guarded release command above. See docs/runbooks/TRANSPORT_SECURITY_BOUNDARIES.md for transport transition ownership and cookie-write coverage.




Author validation:1325 API unit tests passed, including97 write routes ×8 origin/header rejection requests and selected AST boundary guards. API/web/browser types, strict compilation of5 affected native suites, API/web builds, quality,222-route register, migration integrity, evidence/backlog/risk/branding/budget, workspace5/locale6/HTTP9 and runner15 passed. Initial compressed entry73352bytes within92160 budget. Docker/native/browser/full release runtime remains required on founder environment.
