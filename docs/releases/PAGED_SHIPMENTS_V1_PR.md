# PR title

Page transport workspaces while preserving party and Incoterm action boundaries

# PR description

## Outcome

Buyers and suppliers can search older transport records and browse bounded pages. Full transport totals remain independent of pages; read failures show retry/unavailable states. Transport visibility does not grant authority to perform the other party's actions.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/SHIPMENT_PAGING.md
- Target phase/environment: local pilot rehearsal; hosted capacity remains open

## Change summary

- Add max-100 keyset shipment pages with literal search, direction/state/milestone filters and scoped cursors.
- Preserve seller/buyer scope and payment fields; add recorded Incoterm display. Logistics/read-all does not broaden list visibility.
- Extract ShipmentRecordsPage with independent aggregate totals, explicit retries and accessible detail navigation.
- Refuse legacy >1,000 rows explicitly; existing detail/mutation rules remain unchanged.
- Add nine unit cases, fourteen native definitions including 1,005 workspaces and all eleven Incoterm wrong-party denials, and four browser definitions. Record accepted contracts release.

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
- Rollback or compensation: revert API/UI together; no data transformation
- Configuration/secrets changed: none

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 549 units/67 files, quality, workspace/browser types, strict native-source compilation, builds, migration integrity/backlog pass. Docker/PostgreSQL/browser unavailable here. Run verify:release on exact candidate, attach SHA/report or CI URL and check native/browser boxes after pass. Large frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named controls and keyboard-accessible record buttons; missing totals remain unavailable. Delivered count is a transport report, not trade acceptance/payment confirmation. No hosted capacity claim.

## Follow-up work

- PER-001 / ARC-024: payment pages, legacy persona/control-tower aggregates, comparisons, detail collections/exports.
- PER-003 / PER-004: hosted plans and concurrent-load SLO acceptance.
- SVC work: provider service-market authorization remains separately designed; no provider grant introduced here.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: broad items remain open; this slice's native release/merge acceptance pending.
