## Outcome

Critical workspace dialogs have native modal/keyboard behavior while retaining busy and unsaved-change guards. Sourcing extraction no longer backtracks across arbitrary prose, deterministic ordering preserves existing hashes and lock order, and CI/setup avoid implicit dependency lifecycle execution. Local demo services are no longer published on every network interface.

## Tracking

- Backlog ID(s): SEC-006, QLT-002, UX-002, INV-003; all Sonar baseline IDs in docs/quality/sonar-triage-2026-10-24.json
- Issue/ADR: Founder-authorized remaining SonarCloud cleanup, 2026-10-24
- Target phase/environment: Phase 0 local investor rehearsal and disposable release/CI; deployment on hold

## Change summary

- Target 76 additional baseline findings: 34 sorting sites, 29 interactive-element sites, four sourcing regex sites and nine install-hook findings.
- Share native named dialogs across 14 legacy overlays, preserving business callbacks, busy guards, discard prompts, keyboard containment and focus return. Name icon-only close controls and keep payment-terms proposal failures inside the dialog with the draft retained. Replace clickable listing containers with an explicit supply link; renewal controls remain independent.
- Tokenize quantity/material/delivery grammar, retain arbitrary commodities and manual-review fields, and cover long nonmatching inputs, decimals and metric units.
- Use explicit UTF-16 ordinal comparisons for canonical hashes, signatures, cursors, migration ordering and lock acquisition; use exact membership for browser saved-filter keys.
- Use npm ci --ignore-scripts in CI and Bash setup; verify a clean install before builds/tests. No dependency-version changes.
- Bind legacy local Compose database/API/web ports to loopback and reject known development database passwords in staging/production, including percent-encoding.
- Consolidate base bilingual catalog keys to preserve all text/key order while staying within the existing JavaScript budget.
- Document 46 individual review recommendations without changing Sonar statuses, exclusions, exceptions or thresholds.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing tenant/permission checks, action confirmation, audit/outbox and idempotency remain authoritative. No automatic action retry, seed/reset or credential rotation is introduced. Canonical ordering intentionally remains locale-independent. Dialog close callbacks retain existing discard/busy restrictions. No parser claim substitutes for supplier evidence or buyer review. The legacy Compose file is still a local demo configuration, not an approved hosted deployment. Forty-six findings require explicit reviewer disposition; no blanket dismissal is made.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; explicit string comparators preserve previous lock acquisition order
- Rollback or compensation: revert this commit; no data compensation required. Reverting loopback bindings would restore broader local demo exposure and requires separate review.
- Configuration/secrets changed: no new secrets; legacy demo port bindings narrowed. Staging/production startup rejects the known local DB password. Dependency installation disables lifecycle scripts; explicit existing browser installation remains separate.

## Defect regression

- Defect severity: P2; no confirmed product P0 is inferred from scanner severity
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: canonical-order tests preserve numeric-looking/case/Unicode ordering and a pre-change audit hash. Saved-filter tests preserve key-order independence and reject unknown properties. Parser regressions retain commodity/quantity/delivery grammar and unresolved invalid fields under long input. Config tests reject plain/encoded local DB defaults in both deployed environments. Compose test enforces loopback-only published ports. Certificate browser regression exercises Escape, discard cancellation, retained draft and focus return without writes.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [x] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author passed 134 production-build Chromium cases across 26 mocked-API suites, 29 frontend/policy cases including two canonical-order regressions, six saved-filter/support cases, seven runner/Compose cases, six locale cases, API/web/browser typechecks, code quality, API build and production web build/budget. All 1,694 API unit cases in 176 files pass, including parser and deployed-password regressions. Authorization and branding checks and both dependency audits pass. The unchanged 90 KiB gate passes after consolidating base catalog structure; all base translation text, keys and order match the previous catalog exactly. Native identity/source-entry/database/scanner/recovery and hosted staging are not claimed as run. Clean npm ci --ignore-scripts succeeded. Full exact-candidate Windows release, required CI and SonarCloud rescan remain required; Docker/PostgreSQL and hosted staging are unavailable in the author environment.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [x] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No production readiness, RFC parsing, legal, accessibility certification or Sonar closure claim is introduced. Both locale catalogs retain exact keys, text and ordering.

## Follow-up work

- SEC-006/QLT-002: reconcile all 165 source-corrected baseline findings against a fresh Sonar scan and make explicit individual dispositions for the 46 reviewed contexts. Do not bulk-dismiss security findings.
- SEC-006: obtain the eight dependency-risk package/version/advisory details and reconcile them independently of the clean npm advisory gate.
- UX-002/INV-003: complete native release/CI and founder buyer/supplier/admin rehearsal, including modal keyboard/unsaved behavior, before hosted deployment.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
