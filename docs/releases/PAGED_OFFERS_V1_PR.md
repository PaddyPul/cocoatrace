# PR title

Page offer histories and use party-specific aggregate dashboard totals

# PR description

## Outcome

Buyers and suppliers can search older offers and browse bounded pages without downloading the full history. Received/sent counts and home pending totals remain accurate beyond page one; failed reads show unavailable/retry states instead of zero or an empty workspace.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/OFFER_PAGING.md
- Target phase/environment: local pilot rehearsal; hosted capacity acceptance open

## Change summary

- Add max-100 keyset offer pages with literal search, status/direction filters and scoped cursors.
- Preserve seller/buyer row boundaries, fee estimates and currency precision.
- Add independent aggregate counts; switch offers UI and home offer counts to bounded/aggregate reads.
- Refuse legacy arrays beyond 1,000 explicitly; preserve existing accept/reject workflow.
- Correct the browser fixture identity response and completed-onboarding state; scope the supply failure assertion to its own alert, assert destination URLs before testing controls, and locate the supplier action card by its accessible title while verifying navigation to Offers.
- Add eight unit cases, a 1,005-offer native scenario and five browser definitions. Record founder acceptance of the previous evidence slice.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: read-only tenant/party rechecks under existing deadlines; parameterized literal search. Cursors are scope-bound, not grants. No broader admin/logistics visibility, mutation-policy change or new audit/outbox action. Existing mutation transactions remain authoritative.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; existing bounded read-only snapshots
- Rollback or compensation: revert API/UI together; no business data transformation
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 531 unit tests/65 files, quality checks, workspace/browser types, strict native-source compilation, production builds, migration integrity and backlog tests pass. Docker/PostgreSQL/browser execution unavailable here. Founder first browser run exposed incorrect fixture onboarding/identity shapes and an ambiguous alert locator; these are corrected without relaxing app guards. Browser types/quality pass after correction. Before merge run verify:release, record exact tested SHA and passing report/CI URL, then check native/browser boxes. Existing large web chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: controls use accessible names and partial page labels; focus/retry refresh reads. Missing counts stay unavailable. No hosted performance claim.

## Follow-up work

- PER-001 / ARC-024: contract/shipment/payment lists, compare-offer consumers, control-tower aggregates and embedded detail collections/exports.
- PER-003 / PER-004: representative hosted query plans and concurrent-load SLO validation.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: broad items remain open after this slice; native release/merge acknowledgment pending.
