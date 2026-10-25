## Outcome

Finish the remaining Sonar review scope without disguising accepted local-tooling risks as fixes. The onboarding feedback checkbox has a direct visible text label and description. All 47 current issues have an individual, auditable outcome, and external review changes are applied only through a separately invoked, scoped tool after release/merge.

## Tracking

- Backlog ID(s): SEC-006, QLT-002, UX-002
- Issue/ADR: Complete founder-supplied 47-item unresolved main export, 2026-10-25; individual IDs in docs/quality/sonar-closeout-2026-10-25.json
- Target phase/environment: Local investor rehearsal and disposable release/CI; hosted deployment remains on hold

## Change summary

- Correct the surviving onboarding label while retaining checkbox state and explicit save behavior. Add a browser regression for visible label activation, accessible description, keyboard toggling and no unintended writes.
- Reconcile every original 211-item baseline ID: 164 are absent from the new unresolved export; one source fix and 46 reviewed decisions remain pending confirmation/application.
- Record 35 fixture false-positive decisions and 11 accepted local-credential/PATH risks individually. Do not change Sonar exclusions, thresholds, rules or dependency exceptions.
- Add a closeout tool with local plan mode, read-only default, fixed project/issue scope, reviewed-source digests, all-issue identity preflight, per-issue concurrency recheck, review comments, confirmed transitions, redacted partial results and no write retries. Keep the source fix subject to scanner verification.
- Document the separate authenticated apply step and how to reopen decisions; expose no credential in arguments, reports or tracked files.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: The external tool targets only PaddyPul_cocoatrace and the reviewed issue IDs, uses a fixed HTTPS API with redirects refused, reads SONAR_TOKEN from the local process environment and never logs HTTP bodies/headers. It checks all identities before any write and rechecks state/update date immediately before each issue action. Unknown write outcomes stop; subsequent runs read live state and skip existing decisions/comments. Source digests tolerate CRLF checkout only. 11 accepted residual risks remain explicit under SEC-006. No customer authorization, financial, audit/outbox or data-custody behavior changes.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert source changes if needed; reopen individual Sonar issues to reverse external review decisions. Git revert does not undo Sonar state.
- Configuration/secrets changed: no application secret or deployed configuration changes; optional local SONAR_TOKEN needs Browse/Administer Issues permission and is not committed. Redacted local results are ignored.

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: onboarding pilot feedback has a visible associated label and description without submitting on toggle. Eight closeout tests cover reviewed source/identity scope, CRLF, read-only behavior, mismatch-before-write, exact decision counts, idempotent rerun, concurrency and unknown comment/transition outcomes without replay.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [ ] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 37 frontend/policy cases including eight closeout tests and five production-build mocked-API Chromium cases pass. Web/browser typechecks, code quality, production web build and the unchanged 90 KiB budget pass. No API change; API integration/full native release, real Sonar authentication/transitions and staging were not executed by the author. The exact-candidate Windows full release, required CI and scanner result remain gates. Unit tests simulate the external API and do not certify an authenticated server interaction.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

- SEC-006/QLT-002: after merged scan, apply/reconcile the 35 false-positive and 11 accepted decisions and confirm all 47 exact IDs. Do not count review decisions as code repairs or infer no new issues.
- SEC-006: retain the 11 local-development/toolchain assumptions; provision deployment-specific secrets and execution controls before hosting. The eight earlier dependency-risk details are outside the issue exports and remain unverified.
- UX-002: confirm the corrected label in the merged scan; complete native release and investor persona rehearsal.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
