# Pilot request and deployment guardrails: Windows handoff

Founder acceptance of the last bundle closes UX-009, ARC-009 and ENV-016:113/343 (32.9%). This batch combines request-size/query hardening with ENV-012 migration compatibility and ENV-018 environment-ingress policy. Accepting both policy targets yields115/343 (33.5%). Core11/28 and provider-inclusive11/40 are unchanged. These are roadmap closure counts, not a valuation or readiness probability.

Download the bundle to Downloads and use the complete blocks below. Preserve your stash, local Compose overrides and output logs; never stage them. Apply only the bundle tip. No dependency/schema/data change, paid service or new hosting setup is required.

## 1. Apply on a new feature branch

Download `bettertrade-pilot-request-deployment-guardrails-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/pilot-request-deployment-guardrails-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-pilot-request-deployment-guardrails-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/pilot-request-deployment-guardrails-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/pilot-request-deployment-guardrails-v1
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
    cmd.exe /d /c "npm run verify:release > pilot-request-deployment-guardrails-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content pilot-request-deployment-guardrails-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The release includes request-budget and existing upload/auth/tenant regressions. No reset, manual persona checklist, dependency install or migration is required. On failure send only the first specific failure and its response code.

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
    git push -u origin feat/pilot-request-deployment-guardrails-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\PILOT_REQUEST_DEPLOYMENT_GUARDRAILS_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in PILOT_REQUEST_DEPLOYMENT_GUARDRAILS_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” once done. Two policy targets close after review/release/merge acceptance. SEC-010 remains partial for general admission and deployed load evidence.


## What changes and what remains open

JSON bodies retain the existing100KiB ceiling explicitly. Generic overflow now returns413 REQUEST_BODY_TOO_LARGE; malformed JSON returns400 REQUEST_JSON_INVALID without submitted fields. Raw queries are capped at8,192 bytes,64 parameters,128-byte decoded keys,2,048-byte decoded values and four bracket levels. Ordinary Express parsing semantics remain; excess fields are rejected rather than truncated. Signed evidence content retains its own rate/capability/concurrency/raw-parser sequence and EVIDENCE_FILE_TOO_LARGE code.

Review docs/runbooks/MIGRATION_COMPATIBILITY.md: older images can refuse a newer migration ledger during normal startup. A rollback must be rehearsed; this bundle adds no migration bypass or rolling hosting system. Review docs/runbooks/ENVIRONMENT_INGRESS.md: default Compose exposes development ports and trust proxy remains false. Do not deploy local overrides publicly or enable blanket proxy trust. Real DNS/TLS/private upstream evidence remains required.

SEC-010 remains partial for general simultaneous-request admission, deployed edge enforcement and load evidence. ENV-014 still needs a stamped deployment readback. No hosted environment or customer data operation was run here.

## Author verification

1,126 API cases (including 12 ingress HTTP/limit cases) passed, along with workspace/browser types, API build, code quality, authorization/backlog/risk checks and frozen migration integrity. Docker/full browser runtime is unavailable on the author host and must pass for your exact candidate and required CI before merge. UI behavior is unchanged; one full release covers the batch.
