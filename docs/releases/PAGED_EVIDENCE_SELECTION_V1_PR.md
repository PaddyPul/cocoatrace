# PR title

Page evidence record selection and preserve supporting context across searches

# PR description

## Outcome

Suppliers and buyers can select older source or trade records when attaching evidence without loading their entire workspace. Search/page changes retain the chosen record, explanation and file; selecting another record clears old context. Off-page direct links use an exact permitted lookup, and failed reads explain retry instead of claiming an empty workspace.

## Tracking

- Backlog ID(s): PER-001, ARC-024 — remain IN PROGRESS.
- Issue/ADR: `docs/runbooks/EVIDENCE_RECORD_SELECTION.md`
- Target phase/environment: local pilot rehearsal; hosted performance acceptance remains open.

## Change summary

- Add an option-only endpoint requiring evidence upload plus per-kind read permission, with maximum 100 rows and literal server search.
- Reuse farm/batch list scopes; restrict contract/shipment options to seller/buyer parties. Exact lookup retains those same boundaries.
- Introduce a focused picker with search, paging, retained selection, exact-link resolution, retries and clear missing/failed states.
- Keep upload resource authorization, file/scanner controls and payment-protected downloads intact.
- Add unit, large-workspace native and browser regressions; update the existing real-flow failed-read fixture and record acceptance of evidence-library paging.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: options expose only IDs/labels. Upload permission alone is insufficient; each kind's read permission is required. Cursors bind scope and never grant access. Every lookup/page rechecks row boundaries in bounded read-only snapshots. Logistics assignment and generic read-all do not broaden trade-party selection. Exact IDs and search/page inputs are validated and parameterized. Real selection changes clear old file/explanation context; stale lookup responses are discarded. Existing mutation authorization and audit behavior remain authoritative and unchanged.

## Database and deployment

- Migration required: no
- Backfill/lock implications: no backfill; existing bounded catalog read snapshots only.
- Rollback or compensation: revert API/web together; no business data transformation.
- Configuration/secrets changed: none; dependencies unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passes 522 API unit tests/64 files, quality policy checks, API/web/browser type checks, strict native test-source compilation and production builds. Six native definitions use 1,005 farms/batches/contracts/shipments for paging/search/exact links, option-only projection, foreign denial, seller/buyer vs logistics/read-all scope, relationship/permission rechecks and input validation. Five browser definitions cover retained selection and upload target, off-page link/kind reset, page retry, lookup retry/missing links and malformed response. Existing real source/evidence journeys remain included. Author has no native Docker/PostgreSQL/browser runtime. Before merge run `npm run verify:release`, check API/browser boxes only after success and attach the exact tested SHA/report or CI URL.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: existing redacted logging retained. Named search/select/page/retry controls; page counts are explicitly partial. Unavailable reads disable upload, while server authorization remains final. Selecting a record does not approve its claims. Existing bundle-size warning remains open debt; no hosted capacity claim.

## Follow-up work

- PER-001 / ARC-024: general offer/contract/shipment/payment lists, other selectors, control-tower aggregates, detail collections and exports.
- PER-001 / PER-003 / PER-004: hosted plans/index tuning and representative concurrent-load SLO acceptance.
- Request-specific evidence guidance and other pilot security/operations/provider-marketplace gates remain separate.

## Backlog update

- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Notes: exact-candidate native release/merge acceptance pending for this slice. Universal paging and hosted performance stay open afterward.
