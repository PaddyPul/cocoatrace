# Candidate-bound release evidence

`npm run verify:release` now removes its previous summary, captures the full HEAD and branch before any check, and requires a clean tracked/untracked worktree (Git-ignored runtime reports remain allowed). Detached HEAD or unreadable Git state fails before checks. This works with the current branch-based Windows bundle workflow.

After the ordered fail-fast gates finish, the runner rechecks commit, branch and worktree. A changed commit/branch or pending tracked/untracked file forces failed status. The summary always identifies the original candidate, never the new HEAD. A failed preflight overwrites stale passing evidence with failed/null-candidate evidence. Started/completed timestamps and safe candidate failure reason are retained. Runtime failures remain failures even if Git stays unchanged. This does not monitor transient changes that are later reverted; do not edit or switch branches during verification.

Existing consumer fields status/commit/checks remain compatible. The Windows handoff must still capture HEAD before testing, require exit0, matching passed summary and unchanged clean branch, and only then push. CI/review remains required before merge. Commit any correction as a new candidate and rerun; never copy old summaries or edit evidence to match. The runner does not push or deploy anything.

Regression coverage uses real temporary Git repositories for passing evidence, commit/branch changes, tracked/untracked mutations, stale passing-summary replacement and failed runtime. Existing gate-order/fail-fast regressions remain in place.
