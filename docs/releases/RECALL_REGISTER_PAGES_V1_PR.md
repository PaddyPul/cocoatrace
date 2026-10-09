# PR title

Page recall notices with scoped totals and preserve recipient response access

# PR description

## Outcome

Large recall histories can be searched and paged without downloading every notice and nested affected record. Recipients can still respond to their notices without investigation or manager rights. Failed loads do not claim an empty or safe workspace; resolution does not imply safety holds were released.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — IN PROGRESS
- Issue/ADR: docs/runbooks/RECALL_REGISTER_PAGES.md
- Target phase/environment: local pilot rehearsal; native candidate acceptance pending

## Change summary

- Add max-100 recall pages with literal server search, status/severity filters, scope-bound UUID cursors and per-notice linked counts.
- Share issuer/participant/explicit manager scope and full workspace totals across register/dashboard reads.
- Bound legacy notices and combined linked references to 1,000; overflow rejects before nested arrays load.
- Extract RecallRegister with full totals, explicit retry, unknown totals on failure and closed stale response context on page/filter changes. Activation, recovery and resolution transactions remain unchanged.
- Preserve open recovery drafts during same-page background reads; failed reads clear stale notice actions, and page/filter/user changes still reset context. Narrow totals assertions to the register heading instead of notice headings. Give affected-holding, recovery-note and resolution-reason controls explicit accessible names; test exact role/name selection so changing field values does not affect lookup.
- Preflight legacy inventory and transfer IDs before recall projection, rejecting over 1,000 scoped rows without expensive per-row safety decoration. Small histories retain recall state and tenant scope in the same repeatable-read snapshot; production deadlines remain unchanged.
- Add ten recall-register unit cases plus three legacy overflow/detail regression cases, four database definitions and seven browser definitions; update existing response/trace mock contracts. Record accepted product register release and corrections.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: authenticated issuer/participant access or explicit recall.manage.all, current membership on every read, literal parameterized filters and bounded repeatable-read snapshots. Participant access does not grant manager controls. No audit/outbox mutation or new file download access.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; bounded read-only reads
- Rollback or compensation: revert API/UI together; no data transformation. Reverting restores unbounded register/nested arrays.
- Configuration/secrets changed: none
- Compatibility: paged rows return linked counts; legacy overflow returns 422; register order is deterministic UUID, not initiation timestamp.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 601 API units/73 files, quality, workspace/browser types, strict native-source compilation and builds pass. Native Docker/PostgreSQL/browser execution unavailable here. Attach exact tested candidate SHA and release/CI results before checking native/browser boxes. Frontend chunk warning remains open.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: named search/filter/paging/retry and scoped alert controls. Totals count accessible notices; resolved/draft status and zero active notices establish no safety clearance. Existing response/recovery and safety regressions remain release requirements.

## Follow-up work

- PER-001 / ARC-024: recall response detail collections, public product histories and exports.
- PER-003 / PER-004: hosted plans/index tuning and concurrent-load acceptance.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: product register accepted; this recall register slice pending native acceptance. No broad completion credit.
