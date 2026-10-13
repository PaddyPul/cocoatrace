# Backlog grooming — Windows instructions

Download **bettertrade-backlog-grooming-2026-10-13.bundle** into Downloads. This changes backlog/gates/planning documents and the backlog consistency test. It records your accepted operations correction, closes ten missed outcomes and retains unfinished scope. The application is unchanged.

## Apply on a new documentation branch

```powershell
cd "C:\Users\Albert\Documents\Organic Farming\cocoatrace-final\cocoatrace - Chatgpt"
if (git status --porcelain --untracked-files=no) { throw "Tracked changes exist. Preserve them before continuing." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git switch -c docs/backlog-reconciliation-2026-10-13 origin/main
if ($LASTEXITCODE -ne 0) { throw "Documentation branch creation failed. Stop and send git status." }
$bundle = Join-Path $env:USERPROFILE "Downloads\bettertrade-backlog-grooming-2026-10-13.bundle"
if (-not (Test-Path $bundle)) { throw "Bundle not found in Downloads." }
git bundle verify "$bundle"
if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed." }
git fetch "$bundle" "HEAD:refs/remotes/bundle/backlog-grooming-2026-10-13"
if ($LASTEXITCODE -ne 0) { throw "Bundle fetch failed." }
git cherry-pick bundle/backlog-grooming-2026-10-13
if ($LASTEXITCODE -ne 0) { throw "Cherry-pick failed. Send git status; do not choose whole-file ours/theirs." }
git status
```

Only cherry-pick the tip. Preserve untracked local Compose and browser output files; exclude them from this PR.

## Run the focused validation

Keep the existing installed dependencies. This documentation/test change needs the focused checks below; the implementation's accepted Docker release is recorded separately. Required GitHub CI remains mandatory, so you do not need another local manual trade/identity journey or full Docker rehearsal for this grooming commit.

```powershell
npm run test:backlog
if ($LASTEXITCODE -ne 0) { throw "Backlog consistency failed. Send output." }
npm run check:quality
if ($LASTEXITCODE -ne 0) { throw "Quality checks failed. Send output." }
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Progress recount failed." }
```

Expected: roadmap 88/343 = 25.7%; core pilot 11/28 = 39.3%; provider launch including core 11/40 = 27.5%. The twelve additional provider gates remain open. Three backlog tests must pass. Partial work receives no completion credit.

## Push, PR and merge

```powershell
git push -u origin docs/backlog-reconciliation-2026-10-13
if ($LASTEXITCODE -ne 0) { throw "Documentation push failed." }
Start-Process "https://github.com/PaddyPul/cocoatrace/compare/main...docs/backlog-reconciliation-2026-10-13"
```

Use **BACKLOG_GROOMING_2026_10_13_PR.md** for the exact title and body. Review the ten closure rows and their retained follow-up IDs in **BACKLOG_GROOMING_2026-10-13.md**. Wait for all required CI checks before merging. The PR does not assert hosted acceptance or check broad unfinished operations/provider items complete.

After merge:

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Main switch failed." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Main update failed." }
git status
npm run backlog:progress
if ($LASTEXITCODE -ne 0) { throw "Merged progress recount failed." }
```

This handoff needs no migration or application restart. Next implementation is reviewed terminal-email recovery/worker monitoring, followed by the pilot security evidence matrix and BetterTrade compatibility/branding work.
