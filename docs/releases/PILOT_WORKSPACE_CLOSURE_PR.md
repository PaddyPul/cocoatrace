# PR title

feat: complete saved sourcing, trade filters and customer deal activity

# PR body

## Outcome

Buyers can reopen a saved sourcing brief, review and save changes to the same record, then return to matching with an explicit request link. Buyers and suppliers can focus on their required actions or overdue payments. Both contract parties can read paged customer activity without access to raw administrative audit data. Public and authenticated pages visibly identify the server environment or show that it is unconfirmed.

## Tracking

- Backlog ID(s): PRD-002, PRD-005, PRD-009, PRD-012.
- Reconciled acceptance: ENV-012 and ENV-018 from the founder-reported merged release.
- Issue/ADR: runbooks/PILOT_WORKSPACE_PRODUCTIVITY.md; security/route-authorization.json.
- Target phase/environment: pilot workspace engineering/CI acceptance; no hosted provisioning or live customer claim.

## Change summary

- Add canonical saved-brief edit links, exact own-record loading and validated owner/mutable-state PATCH with atomic audit; preserve unrepresented quality/assurance keys and support clearing dates.
- Filter the full loaded next-action set by all/action-required/overdue payment, retaining choice through refresh. Overdue comes from durable installment deadlines and the server clock.
- Add no-store contract activity pages with current-party checks, scope-bound precise cursors, a fixed action allowlist and safe buyer/seller/platform attribution. Exclude raw metadata, individual IDs, hashes and administrative events.
- Show activity on demand in guided and contract views, with explicit failure/retry and historical coverage limitations.
- Add English/French environment notices using the existing public liveness endpoint, bounded credential-free requests and unknown fallback.
- Reconcile previously accepted deployment policies and add native/browser regression definitions for the combined batch.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: sourcing ownership is fixed server-side; terminal briefs cannot be edited. Changes audit in the same database transaction. Existing accepted offers/contracts are not rewritten. Activity checks current contract-party scope on every page; read-all is not a bypass. Customer history is an explicit projection, not the audit endpoint. Environment probing omits workspace credentials and never infers production or synthetic data from a hostname. Concurrent sourcing edits do not gain a multi-editor merge mechanism; review before saving.

## Database and deployment

- Migration required: no; frozen assets unchanged.
- Backfill/lock implications: none; existing audit and deadline fields are read. No old events are synthesized.
- Rollback or compensation: revert feature code together; retained sourcing changes and audit rows remain valid under the existing schema. No reset or destructive compensation.
- Configuration/secrets changed: none; no dependencies, provider signup, paid service or hosting configuration added.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 1,142 API cases, nine frontend transport/environment tests, locale tests, types/builds, initial JS budget, quality and authorization/backlog/risk checks passed. Native productivity suite strictly compiles; runtime native/browser and exact-commit full release remain required on founder/CI. Enter passing SHA/date and check runtime boxes after verification. No extra manual persona loop is required.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: action-required remains actor-specific; waiting overdue payments do not authorize sellers to submit buyer payments. Failed activity is not empty history. An environment label does not prove isolation, synthetic records or production safety. UI language coverage is limited to the new environment notices; complete translated trade journeys remain separate. Initial JS budget is not a hosted mobile latency result.

## Follow-up work

- ENV-014 and hosted ENV/OPS/SAF gates: stamped deployment readback, ingress/private-resource and operator evidence.
- LNG-001/002/003 and UX-001/002/PER-005: complete reviewed language, keyboard/mobile and measured hosted performance evidence.
- PRD-007/008/010: notification centre, complete lifecycle emails and route-specific document checklists.
- SEC-010/PER-004: broader admission/edge enforcement and representative hosted load.
- No logistics-provider qualification, service award, legal corridor or fundraising valuation claim is introduced.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Founder acceptance of prior ENV-012/018 yields115/343 (33.5%). Four closure targets yield119/343 (34.7%) after review/release/merge. Core11/28 and provider-inclusive11/40 remain unchanged; percentages are backlog closure, not safety probability or valuation.
