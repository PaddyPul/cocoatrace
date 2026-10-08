# PR title

Replace control-tower histories with scoped workspace aggregates

# PR description

## Outcome

The workspace overview remains usable beyond 1,000 records without downloading every source, product, lot, shipment or evidence row. Failed totals pause recommendations and provide retry. Counts reflect account access and no longer claim that all evidence is approved or an entire corridor is ready/safe.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/WORKSPACE_AGGREGATES.md
- Target phase/environment: local pilot rehearsal; hosted performance acceptance remains open

## Change summary

- Add authenticated, fixed-shape aggregate overview under read-only SQL deadlines. Groups require their own read permissions and existing resource scope; unavailable groups are null.
- Use shared reviewed-organic SQL for batch counts and shared recall safety predicates for product holds, including retained holds after resolution.
- Replace ControlTowerPage array reads and retire unused duplicate persona dashboard; validate responses, refresh on focus and provide accessible metric links/retry.
- Remove hard-coded corridor/readiness percentage and healthy-network claim; distinguish recorded evidence/source volume from approved files/available inventory.
- Replace readiness full-history trust hydration with a bounded SQL reviewed count; retain existing advice scope/policy.
- Add five unit cases, four PostgreSQL definitions with 1,005 records and four browser definitions. Record accepted payment release.
- Assess marketplace recall/organic eligibility once per distinct candidate batch before the page limit, preserving scope, literal filters, numeric ordering and SQL deadlines. Add a real query-plan assertion and response-code diagnostics for quantity paging.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: read-only tenant/party rechecks under existing deadlines; parameterized literal search. Cursors are scope-bound, not grants. No new provider/party visibility; explicit resource read-all behavior retained, mutation-policy change or new audit/outbox action. Existing mutation transactions remain authoritative.

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
- Evidence/results: author 563 units/69 files, quality, workspace/browser types, strict native-source compilation, builds, migration integrity/backlog pass. Correction: repository unit tests and API build pass; native quantity-page plan and release confirmation remain pending. Docker/PostgreSQL/browser unavailable here. Run verify:release on exact candidate, attach SHA/report or CI URL and check native/browser boxes after pass. Large frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named controls and keyboard-accessible record buttons; missing totals remain unavailable. Evidence totals are metadata, not approvals. Source volume is not free stock. Held products remain visible after notice resolution. No hosted capacity claim.

## Follow-up work

- PER-001 / ARC-024: comparisons, remaining detail collections/exports.
- PER-003 / PER-004: hosted plans and concurrent-load SLO acceptance.
- SVC work: provider service-market authorization remains separately designed; no provider grant introduced here.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: broad items remain open; this slice's native release/merge acceptance pending.
