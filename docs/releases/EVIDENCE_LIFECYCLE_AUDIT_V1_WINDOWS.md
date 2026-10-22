# Evidence lifecycle audit: Windows handoff

Base: main PR #140, `aa0ed06b8cab2c3783b4ddfd84c2461bc0cab4de`.
Bundle: `bettertrade-evidence-lifecycle-audit-v1.bundle` (direct file, no ZIP).
Source/new work branch: `feat/evidence-lifecycle-audit-v1`.
PR title: `Audit private evidence access, scan decisions and cleanup recovery`.
PR body: `docs/releases/EVIDENCE_LIFECYCLE_AUDIT_V1_PR.md` (required full template).

1. Start Docker Desktop. Save the bundle to Downloads. Keep the existing environment/secrets and volumes.
2. Require a clean tracked worktree; switch to main and pull with `--ff-only`. Require the base above to be an ancestor.
3. Verify/fetch the bundle ref `refs/heads/feat/evidence-lifecycle-audit-v1`. Create the new work branch from current main and cherry-pick only the fetched tip (not the entire bundle history).
4. Capture `git rev-parse HEAD` before verification. No dependency install is required when using the accepted previous release installation; the bundle changes no dependency versions or lockfile.
5. Run `npm run test:integration:docker -- evidenceCleanup.integration.test.ts`. Require all cases to pass; seven new cases are added to the existing suite. Capture output with `cmd.exe /d /c` internal redirection to avoid PowerShell 5 treating expected native stderr as a terminating exception.
6. Delete only the previous `release-test-results/summary.json`, then run `npm run verify:release`. Require exit zero, summary status `passed`, summary commit equal to the captured candidate, unchanged HEAD/branch and a clean tracked worktree.
7. Only then push the branch. Open the PR using the prepared body. Require CI and review before merge. Record native/browser evidence in the PR checkboxes; never mark staging accepted from local execution.

Author evidence: 1,615 API unit tests; API types/build; web production build; quality; authorization register/tests; mutation-inventory/release-runner tests; strict compilation of the final native suite. Native PostgreSQL/Docker/browser runtime is not available on the author host. The founder runs focused/full release checks before push.

Accepted completion stays 170/362 (47.0%). This bundle targets UPL-014 closure after the lifecycle matrix and runtime acceptance, yielding171/362 (47.2%). ARC-013/QLT-002 remain partial. Do not count 106 inventoried routes or 97 remaining review dispositions as backlog closures or confirmed defects. Real inbox, retention policy, private restore, hosted security/ownership and optional Canton work remain separate.
