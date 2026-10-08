# PR title

Bound certificate register reads and preserve scoped search and full counts

# PR description

## Outcome

Certificate readers can browse and search histories beyond 1,000 records without downloading the entire register. Failed reads offer retry and do not claim an empty history. Counts describe recorded certificate states, not accredited issuers or reviewed supply.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/CERTIFICATE_PAGES.md
- Target phase/environment: local pilot rehearsal; native candidate acceptance pending

## Change summary

- Add max-100 UUID-keyset pages with literal search, farm/status filters and scope-bound cursors under existing SQL/read deadlines.
- Preserve issuer/farmer/trade-party visibility and explicit read-all boundaries; keep issuance, details and status mutations authoritative.
- Add full visible recorded-state totals and explicit legacy overflow refusal above 1,000 records.
- Extract certificate register from DataPages into a focused component with page navigation, filter reset, focus refresh and failed/malformed response retry.
- Add nine unit cases, three PostgreSQL cases with 1,005 records/query plans and three browser definitions.
- Record accepted workspace aggregates release and both corrections; keep broad performance work open.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: read-only snapshots, parameterized literal search and explicit query bounds. Pages recheck relationship grants; no provider or generic analytics expansion. Existing audit-bearing mutation use cases remain unchanged. No file bytes or new public certificate access.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; existing bounded read-only snapshots
- Rollback or compensation: revert API/UI together; no data transformation
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 572 API units/70 files, code quality, workspace/browser types, native source compilation, builds and migration/backlog checks pass. Docker/PostgreSQL/browser execution unavailable in author environment. Attach exact tested SHA and native release report/CI link, then check integration/browser boxes after pass. Frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named search/filter/paging controls; no certification requirement introduced for buyer/supplier trades. Recorded active status is not current-validity proof.

## Follow-up work

- PER-001 / ARC-024: embedded farm/batch certificate collections, product/recall collections and exports.
- PER-003 / PER-004: hosted query-plan/index and concurrent-load acceptance.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: candidate native release/merge acceptance pending. Broad items remain open.
