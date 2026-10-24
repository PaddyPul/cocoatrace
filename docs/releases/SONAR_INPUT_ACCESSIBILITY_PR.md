## Outcome

Visible labels identify the intended form fields and composite selectors. Async refresh/startup failures have explicit handling, email and scanner parsing avoid ambiguous regex backtracking, and parser failures cannot expose a raw non-Error rejection. Existing trade confirmation, permission and mutation boundaries remain authoritative.

## Tracking

- Backlog ID(s): SEC-006, QLT-002; UX-002 targeted label/keyboard regression
- Issue/ADR: Founder-authorized SonarCloud cleanup; individual IDs in docs/quality/sonar-triage-2026-10-24.json
- Target phase/environment: Phase 0 local investor rehearsal and release/CI; deployment on hold

## Change summary

- Address 58 additional baseline findings: 28 form labels, 19 promise calls/error boundaries, three email/scanner regex sites, two Number.NaN references, one cursor regex alternative, one repeated offer title, one parser rejection and three Bash conditionals.
- Associate labels with exact controls, preserve existing aria-labels, and use fieldset/legend for composite farm/certificate selectors. Price labels target the amount rather than its neighboring currency selector.
- Mark existing internally handled async boundaries explicitly; handle Home summary rejection and migration/seed startup failure. Present unexpected action rejection without replaying the action.
- Share index-based envelope validation while preserving the previous acceptance policy, retain stricter support-link restrictions, and remove trailing scanner NUL bytes in one backwards pass.
- Preserve all 211 baseline issue IDs and report pending verification honestly; no Sonar exclusions, status changes or threshold reductions.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No authorization scope, audit/outbox mutation or hash/signature ordering changes. No automatic action retry. Envelope validation preserves the existing basic SMTP policy and rejects header whitespace; support links retain punctuation restrictions. Non-Error parser rejection becomes a generic Error without raw parser detail. Existing Errors retain their identity/status. The optional decimal cursor format retains its exact old language.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert this commit; no data compensation required
- Configuration/secrets changed: none; Bash setup is syntax-checked but not executed against user resources

## Defect regression

- Defect severity: P2
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: emailAddress.test.ts covers malformed addresses, header injection, support-link punctuation and long ambiguous inputs; evidenceContent.test.ts covers non-Error parser rejection, capacity release and refusal to complete the intent. Browser regressions use visible labels for certificate issuance, off-page attestation and insurance document notes; label activation must focus the control without sending a write.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author passed all 1,690 API unit tests in 176 files, 86 production-build Chromium cases across 18 mocked-API suites, API/web/browser typechecks, API build, web build and unchanged 90 KiB initial JavaScript budget, code quality, backlog checks and both dependency audits without exceptions. The email policy was also compared against the previous expressions over 30,941 generated strings in both modes. Bash setup passed syntax checking; it was not executed. The sourcing-entry fixture requires Docker and was not run here; it remains in the mandatory full release. Full exact-candidate Windows release, CI and SonarCloud rescan remain required. Docker/PostgreSQL and hosted staging are unavailable in the author environment.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Label association improvements are targeted evidence, not full accessibility certification. Native dialog semantics and keyboard behavior in legacy custom overlays remain a follow-up.

## Follow-up work

- SEC-006/QLT-002: reconcile 89 source-corrected findings against SonarCloud, explicitly review 25 Moto-only findings and address the remaining 97 open-review findings. No count is claimed as closed without scan evidence.
- UX-002: legacy modal keyboard/focus semantics and interactive listing cards remain; this slice fixes label association.
- SEC-006: four sourcing-parser regex findings, deterministic ordering compatibility, installation/PATH/credential findings and the eight dependency-risk details remain open.
- INV-003: founder completes the full buyer/supplier/admin rehearsal before deployment.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
