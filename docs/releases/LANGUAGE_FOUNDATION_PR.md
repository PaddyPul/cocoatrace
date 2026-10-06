PR title: Add English/French workspace navigation and patch dependency advisories

## Outcome

Buyers and suppliers can choose English or French for workspace navigation and search, with a remembered device preference and an explicit notice that trade forms remain English. Switching accounts does not inherit another user's language choice.

## Tracking

- Backlog ID(s): SEC-014, LNG-001, LNG-002, LNG-003 — partial implementation; remain IN PROGRESS
- Issue/ADR: docs/runbooks/LANGUAGE_FOUNDATION.md
- Target phase/environment: Phase 2; development/test and controlled pilot preparation

## Change summary

- Extract workspace headers, navigation, account links and command search into stable English/French catalogs with English fallback.
- Add accessible language selection, account-separated device persistence and visible storage-failure feedback.
- Add pure locale formatting helpers that preserve currency precision and ISO calendar dates; no localized money parsing or currency conversion.
- Add six language unit tests, three real-identity browser regressions and a mandatory language release gate.

- Patch proxy-addr to 2.0.8, fast-copy to 4.1.2, postcss-selector-parser to 7.1.6 and source-map-js to 1.2.2 with pinned overrides and a synchronized lock. Add an Express dependency regression for spoofed forwarded-IP trust. Security exceptions/gate severity remain unchanged.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Existing route permissions remain unchanged. Local preferences contain only a supported language code, separated by account UUID. No new API, audit mutation, upload, external translation service or email delivery. Catalog strings render as text. Storage failure cannot copy another account's in-memory preference.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none
- Rollback or compensation: revert frontend commit and rebuild; preference keys can remain.
- Configuration/secrets changed: no secrets or services; four transitive dependency versions pinned. Run npm ci after applying the correction.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Authoring: six language tests, quality checks, workspace/browser types, web production build and seven release-runner tests pass. Correction validation: clean npm ci, production/full advisory gates, 294 API unit tests, nine dependency tests, six locale tests, API/web builds and workspace/browser types pass. CSS output compares byte-identical. Full native checks remain pending; see docs/RELEASE_EVIDENCE.md. Native Docker/browser/images/recovery unavailable in authoring environment. Before merging, run npm run verify:release and check the integration/E2E boxes only after success. Existing web bundle-size warning remains tracked.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Language selector identifies navigation-only scope. Screen reader page bodies remain marked English. Accessibility labels are implemented; native keyboard/responsive verification and human French review are pending. No sensitive preference logging introduced.

## Follow-up work

LNG-001: pilot language validation and cross-device server preference. LNG-002: full trade/identity/form/error translation with stable backend keys. LNG-003: recipient email localization, financial view integration and unambiguous localized numeric entry. LNG-004: document language authority. LNG-005: human review, long-text/accessibility/RTL coverage. SEC-014: remaining third-party images/digest promotion and expiry-controlled build-only braces exception remain open. ENV/OPS hosted pilot gates remain open.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
