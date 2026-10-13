# Terminal-email recovery: Windows handoff

## Outcome and validation

The Operations monitor can review and requeue terminal payment-reminder and recall emails. Only current platform administrators with fresh passkey assurance can retry terminal, unleased records without a recorded submission. The original recipient and business identity stay unchanged; an audit failure rolls back the retry. Reads return at most 50 redacted records with an explicit more indicator. Refreshes and rejected decisions preserve the explanation.

No database migration or new secret is required. Requeueing does not confirm inbox delivery, acknowledge a recall or release inventory. SMTP is at least once: a submission accepted before a crash may be duplicated by a reviewed retry.

The supplied IDE handoff reports 26 focused PostgreSQL integration cases and 6 mocked-browser cases passed. These are founder-side results, not independently reproduced here. Author validation is recorded below. Full exact-commit release verification and GitHub CI remain required before merge. OPS-006, OPS-010, ARC-014 and CORE-workers remain partial for broader monitoring, external alerts and hosted drills.

## 1. Preserve the unfinished IDE work and import the reviewed bundle

These instructions match the supplied status: uncommitted feature changes on `feat/operations-terminal-email-recovery`. Download `bettertrade-terminal-email-recovery-v1.bundle` into Downloads. Preserve the existing ZIP too.

The path-specific stash below preserves the unfinished implementation, including its three new files. It does not include your original Compose files or browser output. Keep the stash until the merged result is verified; do not pop it over the replacement implementation.

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
if ((git branch --show-current).Trim() -ne "feat/operations-terminal-email-recovery") { throw "Unexpected branch. Stop and send git status." }
$featureFiles = @(
    ".gitattributes",
    "api/src/modules/operations/recovery.ts",
    "api/src/routes/operations.ts",
    "api/test/integration/operationsEmailRecovery.integration.test.ts",
    "docs/BACKLOG_GROOMING_2026-10-13.md",
    "docs/DELIVERY_BACKLOG.md",
    "docs/pilot-gates.json",
    "docs/runbooks/OPERATIONS_JOBS.md",
    "e2e/operations.spec.ts",
    "scripts/quality-scope.mjs",
    "web/src/pages/OperationsPage.tsx",
    "docs/releases/TERMINAL_EMAIL_RECOVERY_PR.md",
    "docs/releases/TERMINAL_EMAIL_RECOVERY_WINDOWS.md"
)
$otherChanges = @(git diff --name-only HEAD | Where-Object { $_ -notin $featureFiles })
if ($LASTEXITCODE -ne 0 -or $otherChanges.Count -gt 0) { throw "Other tracked changes exist. Preserve them before continuing." }
git stash push --include-untracked -m "Preserve unfinished terminal email recovery before reviewed bundle" -- $featureFiles
if ($LASTEXITCODE -ne 0) { throw "Feature backup failed. Stop here." }
if (git status --porcelain --untracked-files=no) { throw "Tracked changes remain. Stop here." }
git stash list -n 1
git status --short

$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-terminal-email-recovery-v1.bundle"
if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/terminal-email-recovery-v1"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/terminal-email-recovery-v1
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not resolve with whole-file ours/theirs." }
git log -2 --oneline
git status --short
```

The bundle contains history for portability, but apply only its tip as above. It replaces the preserved unfinished feature with the reviewed implementation in one commit. If your feature has already been committed, stop before the stash/import step and send `git log -3 --oneline` and `git status --short` so the duplicate implementation is not cherry-picked.

## 2. Verify once, retaining full logs locally

Docker Desktop must be running. Use the project's Node 24 toolchain. Avoid concurrent test runs or image builds during this gate.

```powershell
node --version
docker version
if ($LASTEXITCODE -ne 0) { throw "Docker is not ready." }
npm ci *> terminal-email-install-output.txt
if ($LASTEXITCODE -ne 0) { Get-Content terminal-email-install-output.txt -Tail 40; throw "Installation failed." }
$candidate = (git rev-parse HEAD).Trim()
npm run verify:release *> terminal-email-release-output.txt
$releaseExit = $LASTEXITCODE
if ($releaseExit -ne 0) {
    Get-Content terminal-email-release-output.txt -Tail 80
    throw "Release failed. Send only the first specific failure; do not push or merge."
}
$release = Get-Content ".\release-test-results\summary.json" -Raw | ConvertFrom-Json
if ($release.status -ne "passed" -or $release.commit -ne $candidate) { throw "Release report is not a pass for the current commit." }
if ((git rev-parse HEAD).Trim() -ne $candidate) { throw "Commit changed during verification." }
if (git status --porcelain --untracked-files=no) { throw "Tracked changes appeared during verification." }
"Release passed for $candidate"
```

Do not run `npm audit fix --force` as part of this handoff. The dependency gate reports the project's accepted and blocking advisories. Full logs remain in the two text files; do not stage them.

## 3. Push and create the PR

Only after step 2 passes:

```powershell
git push -u origin feat/operations-terminal-email-recovery
if ($LASTEXITCODE -ne 0) { throw "Push failed." }
Get-Content ".\docs\releases\TERMINAL_EMAIL_RECOVERY_PR.md" -Raw
```

Create a PR into `main`. Use the title and complete body in `TERMINAL_EMAIL_RECOVERY_PR.md`. Add the exact passing release SHA and date to its verification evidence, and check the integration/browser boxes only after that release pass. Required GitHub CI must pass before merge. Do not use `git add .`; the original local files and output logs are excluded from this commit.

## 4. After merge, synchronize and start

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status --short
docker compose -f docker-compose.yml -f docker-compose.email-test.yml -f docker-compose.mfa-test.yml up -d --build
if ($LASTEXITCODE -ne 0) { throw "Application startup failed." }
Start-Process "http://localhost:3000"
```

No database reset or extra migration command is needed. The hardened API image does not contain npm/npx; follow the existing Node maintenance commands when needed. Retain the preservation stash as a backup without applying it to main. Report: “release checks passed and merge/pull completed.” That acknowledgement permits the backlog candidate to be recorded as accepted; broader operations gates remain partial.

## Author validation

Passed here: code quality (lint, formatting, script contracts and policy tests); API/web/browser workspace type checks; strict compilation of the new native integration suite; API and web production builds; 3 backlog tests; whitespace validation. The production web build retains its existing bundle-size warning.

API unit suite: **793 tests passed across 93 files**, run with file parallelism disabled after builds. This includes five added redaction cases. Strict native compilation also corrected the fixture request-body type; no runtime contract was changed. Docker/PostgreSQL and browser execution are unavailable in the author environment, so the supplied focused results and founder full-release verification are explicitly distinguished.
