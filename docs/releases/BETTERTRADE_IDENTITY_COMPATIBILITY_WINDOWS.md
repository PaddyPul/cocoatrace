# BetterTrade identity and compatibility: Windows handoff

The corrected workspace release is accepted: PRD-002/005/009/012 close,119/343 (34.7%). This coherent batch targets BRD-001 customer branding, BRD-002 compatibility inventory and TRD-016 unsigned agreement presentation. Acceptance yields122/343 (35.6%). Core11/28 and provider-inclusive11/40 are unchanged.

Download bettertrade-identity-compatibility-v1.bundle to Downloads. Use the existing checkout directory and Compose project. Do not rename the folder, database, volumes, bucket, sender/domain, Git remote or storage keys. No dependency install, migration, reset, paid service or provider signup is required. Preserve your stash, Compose overrides and logs; apply only the bundle tip.

## 1. Apply on a new feature branch

Download `bettertrade-identity-compatibility-v1.bundle` into Downloads. Keep the existing preservation stash; do not pop it. Original Compose files and local output logs remain untracked and must not be staged.

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
    git switch -c feat/bettertrade-identity-compatibility-v1
    if ($LASTEXITCODE -ne 0) { throw "Feature branch creation failed. Stop here." }
    $bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-identity-compatibility-v1.bundle"
    if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
    git bundle verify "$bundle"
    if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
    git fetch "$bundle" "HEAD:refs/remotes/bundle/bettertrade-identity-compatibility-v1"
    if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
    git cherry-pick bundle/bettertrade-identity-compatibility-v1
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
    cmd.exe /d /c "npm run verify:release > bettertrade-identity-compatibility-release-output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Get-Content bettertrade-identity-compatibility-release-output.txt -Tail 80
        throw "Release failed. Stop before push/merge; send only the first specific failure."
    }
    $release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
    if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for this commit." }
    if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
    if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
    "Release passed for $candidate"
}
```

Full output stays in the local file. The release includes the branding/compatibility guard, brand/agreement browser regressions and all existing identity/trade, migration and backup/restore gates. No reset, manual persona checklist, dependency install or migration is required. On failure send only the first specific failure and its response code.

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
    git push -u origin feat/bettertrade-identity-compatibility-v1
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
    Get-Content ".\docs\releases\BETTERTRADE_IDENTITY_COMPATIBILITY_PR.md" -Raw
}
```

Open a PR into main with the complete title/body in BETTERTRADE_IDENTITY_COMPATIBILITY_PR.md. Add the passing release SHA/date; check the integration/browser boxes after the pass. Required GitHub CI must pass before merge. Do not stage logs, local Compose overrides or the old preservation stash.

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

Report “release checks passed and merge/pull completed” once done. Three branding/compatibility/agreement targets close after review/release/merge acceptance; internal identifier and domain/legal approval remain separate.




## Scope and operational boundaries

Customers see BetterTrade in current web identity, browser metadata and identity/reminder/recall email templates. English/French navigation branding is covered. Full translated workflows/human language review remain separate; the proper name is the same in both locales.

The unsigned trade agreement record preserves agreed commercial terms and says signatures are not captured here. Its legal effect depends on applicable terms and law. This does not introduce a signature service or invalidate existing external agreements.

Read docs/branding/BETTERTRADE_COMPATIBILITY.md and compatibility-v1.json. The required guard checks23 compatibility anchors: existing database/volumes, session issuer/audience and cookie, preferences, evidence keys, routes/links, package/image identities and export filenames. Existing native identity/passkey, fresh/upgrade and recovery gates remain mandatory. Source checks do not prove real hosted resource retention.

Keep the existing folder and exact Compose command. Changing the implicit Compose project can create empty replacement volumes. Never use down -v, seed or reset to make a renamed app appear healthy. Existing configured EMAIL_FROM and authenticated sender remain; no new BetterTrade domain is owned/configured by this bundle. Historical evidence/audits/captured emails and old download filenames remain unchanged. Terminal npm output can still say cocoatrace because internal identifiers are intentionally retained.

BRD-003 internal migration and BRD-004 name/domain/legal approval remain open. No corporate identity, trademark, regulatory, independent-verification, provider-marketplace or hosted-readiness claim is introduced.

Author checks:1,142 API cases, five branding tests, frontend HTTP/environment/locale tests, release gate contracts, code quality, workspace/browser types, API/web builds, JavaScript budget and register/backlog/risk/migration checks. Native Docker/Chromium are unavailable here; full exact-commit release and required CI remain necessary. No extra manual persona checklist is required.
