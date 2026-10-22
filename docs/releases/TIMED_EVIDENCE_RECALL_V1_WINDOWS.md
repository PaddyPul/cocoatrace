# Three-outcome timed evidence and recall bundle: Windows handoff

Base: main PR #141, `b5f790dc49911f332f8048dc99b4cd7440ce60ce`.
Direct file: `bettertrade-timed-evidence-recall-v1.bundle` (no ZIP).
Source/new branch: `feat/time-bound-evidence-recall-v1`.
PR title: `Complete expiring downloads, renewal reminders and recall deadlines`.
PR body: `docs/releases/TIMED_EVIDENCE_RECALL_V1_PR.md` (required full template).

1. Start Docker Desktop and save the bundle to Downloads. Require a clean tracked worktree; switch to main and pull with `--ff-only`.
2. Require the accepted base above to be an ancestor. Verify/fetch `refs/heads/feat/time-bound-evidence-recall-v1`, create the new branch from current main and cherry-pick only the fetched tip.
3. Capture `git rev-parse HEAD` before testing. Dependency versions/lockfile are unchanged, so the previous accepted installation is sufficient.
4. Delete only the previous `release-test-results/summary.json`. Run the full `npm run verify:release` once; it already includes fresh/upgrade migration053, all native suites, browser journeys, image scans and restore. Do not repeat an additional focused Docker run unless diagnosing a failure. Use a single PowerShell `& { ... }` script block so a thrown guard stops before later commands.
5. Require exit zero, summary status passed, summary commit equal to the captured candidate, unchanged HEAD/branch and a clean tracked worktree. Only then push. Require CI/review before merge and update runtime evidence in the prepared PR body.

The bundle contains11 native scenarios in `timedEvidenceRecall.integration.test.ts`; they do not depend on demo roles. Author strict compilation is separate from PostgreSQL execution.13 affected Chromium scenarios pass on a production web build with mocked APIs; real backend/browser acceptance remains in the full release. No staging claim is made.

Accepted171/362 (47.2%) includes UPL-014 from the previous merged release. This bundle targets three closures: UPL-010, UPL-012, RCL-004. After accepting all three:174/362 (48.1%). Core/provider-inclusive gates remain11/28 and11/40. Do not mark these three complete from author checks alone.

Migration053 preserves historical unknown dates as null and does not reset data or invent expiry/deadlines. New recalls default to24-hour acknowledgement targets, with an explicit1–168h manager choice. Renewal reminders are private in-app current tasks; external email and hosted acceptance remain separate.
