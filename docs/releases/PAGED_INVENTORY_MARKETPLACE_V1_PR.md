# PR title

Page inventory and marketplace while preserving truthful supply totals

# PR description

## Outcome

Suppliers can find inventory beyond the first page and publish the holding they just created. Buyers can search and page available supply without losing listings to an old request filter. Dashboard supply totals come from aggregates, so page length is never presented as the total available stock.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — both remain IN PROGRESS.
- Issue/ADR: `docs/runbooks/CATALOG_PAGINATION.md`.
- Target phase/environment: local pilot rehearsal; hosted performance acceptance remains pending.

## Change summary

- Add bounded holdings/listings pages with server-side filters, stable keyset cursors, existing authorization and read-only snapshot transactions.
- Apply current availability and organic certificate predicates before pagination. Require a single currency for price ordering; preserve decimal sort keys.
- Add full supply aggregates and explicit failure states on dashboards.
- Extract InventoryPage from DataPages; add search and Previous/Next controls to inventory, publication, marketplace and own listings.
- Resolve newly created holdings and off-page published listings explicitly. Bound shortlists to 20 entries and scope them by account; comparison uses exact listing lookups.
- Reject oversized legacy list reads rather than silently truncating them. Bound linked proof reads and query duration.
- Add unit, PostgreSQL and browser regressions; record acceptance of the previous trace selector correction.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: holding reads remain organization-scoped; marketplace visibility retains the existing authenticated catalog boundary. Cursors are position hints, never authorization. Filters and cursor inputs are validated; SQL values are parameterized. Reads create no audit/outbox mutations. Late UI responses are ignored, and errors do not imply empty inventory. Cross-tenant and recalled inventory regressions require native release execution.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; read-only repeatable-read transactions, local two-second statement timeout and five-second elapsed-read budget.
- Rollback or compensation: revert API and web changes together; no persisted business data transformation.
- Configuration/secrets changed: none; no dependency changes.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author checks include 467 passing API unit tests, quality checks, workspace/browser type checks, native test-source compilation, API/web builds, migration integrity and backlog tests. Author environment has no Docker/PostgreSQL/browser runtime; native execution is pending. Before merge, run `npm run verify:release`, check the integration/browser boxes only after success, and record the candidate SHA and CI/report evidence. Added native coverage includes 1,005 holdings/listings, tenant isolation, cursor/filter/order agreement, recall exclusion and seven organic trust parity cases. Browser coverage includes paging, search, exact supply selection and failed summaries.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: existing logging policy is retained. Pagination controls and search inputs have accessible names; native browser acceptance remains pending. Match ranking is explicitly within the current page; aggregate stock is distinct from page count. No hosted capacity or global ranking claim is made.

## Follow-up work

- PER-001 / ARC-024: paginate remaining resource lists and exports, including transfer and other dashboard datasets; assess broader single-resource proof bounds.
- PER-001: capture hosted query plans, tune indexes from evidence and validate concurrent-load latency budgets.
- ARC-024: decide whether globally ranked request matching is needed; this slice labels page-level ranking honestly.
- Existing pilot operations/security and logistics-provider marketplace gates remain open; this slice does not close them.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: accept this inventory/marketplace slice only after the exact candidate passes native release checks and is merged; PER-001 / ARC-024 remain open for the broader scope.
