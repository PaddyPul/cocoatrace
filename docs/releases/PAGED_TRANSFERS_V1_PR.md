# PR title

Page custody transfers and show acceptance only to the receiving party

# PR description

## Outcome

Inventory users can review incoming transfer requests and search their transfer history without downloading the full history. Outgoing requests do not offer receiving-party acceptance; failed reads remain visible with a retry action.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS; broader resource and hosted capacity scope remains.
- Issue/ADR: `docs/runbooks/TRANSFER_PAGINATION.md`
- Target phase/environment: local pilot rehearsal; native release execution required before merge.

## Change summary

- Add max-100-row, server-filtered transfer pages with scoped UUID cursors and read deadlines.
- Extract a focused transfer-records component from InventoryPage; default to incoming requests and expose outgoing/history filters, search, navigation and retry.
- Render acceptance only for a pending receiving-party request with acceptance permission; show and block recalled supply.
- Cap legacy arrays explicitly at 1,000 rows and use the schema's requested_at timestamp.
- Preserve existing transaction/locking/recall/audit rules; add SQL, native large-history and browser regressions.
- Record founder-reported acceptance of the inventory/marketplace release.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: authenticated transfer reads retain existing permission and restrict rows to sending/receiving organization. Cursor is not authorization. SQL inputs are parameterized, typed and bounded; filters apply before LIMIT. Receiving-party mutation authority and repeated acceptance handling are unchanged and covered by native regression. Read-only operations add no audit/outbox writes. File handling is unchanged.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none; bounded read-only snapshots use catalog deadlines. Existing acceptance locks unchanged.
- Rollback or compensation: revert API and web together; no persisted business-data change.
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 475 passing API unit tests, quality/type/build, strict native-test compilation, migration-integrity/backlog checks. Native PostgreSQL/browser execution unavailable author-side. Before merge run `npm run verify:release`, check integration/browser boxes only after success and record the tested SHA and CI/report evidence. New native case uses 1,005 transfer records; browser tests verify search/navigation, acceptance refresh, outgoing action exclusion and failed-read retry and recall-blocked acceptance. No hosted capacity evidence claimed.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: existing redacted logging retained. Named controls and labeled region included; native browser verification pending. Page count is clearly scoped. No entire-history count or chronological/global ranking claim.

## Follow-up work

- PER-001 / ARC-024: remaining list/export endpoints and their selection/aggregate consumers.
- PER-001 / PER-003 / PER-004: hosted plans, indexes and concurrent-load SLO acceptance.
- Existing pilot operations/security gates and logistics-provider marketplace remain separate work.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: this resource slice remains native-release pending until tested and merged; broader PER-001 / ARC-024 stay open afterward.
