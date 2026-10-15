# Pilot integrity closure: Windows handoff

This batch covers eight backlog rows: three already implemented/accepted rows (LOG-002 milestone authority, LOG-004 predecessor/skip policy and LOG-011 safe optional tracking) are reconciled complete; five new outcomes target LOG-003 departure readiness, DAT-005 validity boundary evidence, DAT-006 duplicate active-scope prevention, GOV-004 seven architecture decisions and GOV-008 maintained risk register.

Your six offer/customer/policy closures are now accepted. After reconciliation:101/343 (29.4%). Accepting the five new outcomes yields106/343 (30.9%). Core11/28 and provider-inclusive11/40 remain unchanged; real corridor/hosted approval remains separate.

No dependency installation, migration, secrets or provider setup. Preserve stash, local Compose overrides and logs. Download bettertrade-pilot-integrity-closure-v1.bundle into Downloads. Apply only the bundle tip and run one full release with the blocks below.

## 1. Apply on a new feature branch

Download `bettertrade-pilot-integrity-closure-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/pilot-integrity-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-pilot-integrity-closure-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/pilot-integrity-closure-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/pilot-integrity-closure-v1
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
    cmd.exe /d /c "npm run verify:release > pilot-integrity-closure-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content pilot-integrity-closure-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. One release runs new certificate validity/duplicate tests, the departure gate and corrected successful transport/payment fixtures, plus all existing journeys and restore rehearsal. The new Pilot risk register gate checks ownership, references and source/view consistency; a due review is reported without automatically failing or closing risk. On failure send only the first specific failure/code. No extra manual persona loop or migration is required.

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
    git push -u origin feat/pilot-integrity-closure-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\PILOT_INTEGRITY_CLOSURE_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in PILOT_INTEGRITY_CLOSURE_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

No migration or dependency change is required. Existing frozen migration assets remain untouched. The API automatically applies any pending registered migrations via Node; do not invoke npm/npx inside the hardened container or reset the database.

No manual persona checklist is required for this batch. The existing accepted onboarding, trade, passkey, operations and browser suites remain part of the full release.

Report “release checks passed and merge/pull completed” once done. The five targets close in the next backlog update; the three reconciled logistics rows are already recorded complete.

## Review the publication outcomes

Review docs/adr/README.md and docs/RISK_REGISTER.md in the PR. Hosting stays synthetic-only at zero budget until secure resources are proven; no paid activation or hosted deployment is introduced. The risk register identifies Albert M. Pul as coordinating founder/maintainer and next review2026-10-22; this is not independent staffing or automatic risk acceptance. Run npm run risk:report to see whether review is due. After changing risk-register.json, regenerate the view with node scripts/risk-register.mjs --write. No meeting/reminder was scheduled.

LOG-003 checks actual departure only. Complete provider name OR booking reference, known mode, origin and destination through the authorized arrangement form. Draft/loading and later containment/recovery reporting remain possible. Certificate guards prevent new conflicting app writes, not independent-issuer reviews or historical data cleanup. Current limitations copy2026-10-14.1 remains accurate.

## Author verification

Passed1,087 API cases, quality, all workspace/browser types, API/web builds, checked authorization, risk-register and backlog checks. Strict compilation covers certificateValidity, certificateDuplicates, transportResponsibilities and paymentWorkflow integration suites. Native Docker/full browser and hosted/staging/independent review are not claimed. Existing web build chunk warning remains.
