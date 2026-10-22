# Release recovery guards: Windows handoff

Direct bundle: bettertrade-release-recovery-guards-v1.bundle; no ZIP.
Base: accepted main PR #143, 0edad212d4b62159b34f9995e3bc4e792968e795.
Source/new branch: feat/release-recovery-guards-v1.
PR title: Verify private evidence recovery and bind release evidence to its candidate.
PR body: docs/releases/RELEASE_RECOVERY_GUARDS_V1_PR.md (required complete template).

Start Docker Desktop, save the bundle to Downloads, require a clean repository including untracked files, update main with --ff-only and verify the accepted base is an ancestor. Verify/fetch the source branch, create the new branch from current main, then cherry-pick only the bundle tip. Do not reset or reapply if that branch already exists. No dependency installation or database migration is introduced.

Capture the new Windows candidate SHA before running npm run verify:release. Use a single PowerShell & { ... } block with throw guards; redirect native stderr inside cmd.exe for Windows PowerShell5 compatibility. One full release already includes the secret scan and the extended PostgreSQL/private-object recovery. Do not run an extra focused Docker suite before it. The new runner requires a clean committed tree and records the original candidate even if Git state changes later. Missing/dirty/detached Git state fails preflight and invalidates prior evidence.

Require exit0, summary.status passed, summary.commit equal to the captured candidate, unchanged HEAD and branch, and clean tracked/untracked state. Only then push the branch. CI and review remain required before merge. Copy the prepared PR body with Get-Content -Raw | Set-Clipboard; fill actual passing SHA/results after runtime verification.

34 runner regressions, quality/backlog checks and actual native scanner/Moto object recovery pass on the author host. PostgreSQL/Docker orchestration and complete release remain founder runtime acceptance; no hosted backup claim. Application source/dependencies are unchanged.

Accepted backlog174/362 (48.1%) includes the prior three merged items. UPL-018 targets175/362 (48.3%) after acceptance. SEC-013 remains partial until repository settings are verified; OPS-002 remains a managed-provider/RPO/RTO gate. Core/provider-inclusive gates remain11/28 and11/40.

After CI passes, the owner should separately enable available repository secret scanning/push protection and require the secret-scan check through branch rules. Record a safe synthetic settings verification. Do not claim those remote settings were changed by a Git bundle.
