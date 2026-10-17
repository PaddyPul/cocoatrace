# PR title

feat: track reviewed transport delays and exceptional-dispatch acknowledgement

# PR body

## Outcome

Transport coordinators can update estimated arrival with reviewed revisions and a delay explanation. Current parties see overdue arrival in their private notices. Buyers can explicitly acknowledge a seller’s recorded exceptional dispatch, while both parties see whether that awareness receipt exists.

## Tracking

- Backlog ID(s): LOG-008, LOG-010 closure targets; accepted TRD-015/PRD-007 reconciled.
- Issue/ADR: docs/runbooks/TRANSPORT_AWARENESS.md.
- Target phase/environment: application workflow/local and CI acceptance; hosted operational delivery remains separate.

## Change summary

- Add immutable ETA revision history, optimistic conflict checks, current coordinator authority and atomic audit attribution.
- Preserve initial ETA compatibility through the existing arrangement endpoint; subsequent changes share the reviewed reason/revision policy. Move customer ETA entry to explicit timing review.
- Add explicit buyer awareness receipts for a specific dispatch-exception fingerprint, idempotent retries, stale-review conflicts and immutable history. Awareness is not a waiver, inspection acceptance or settlement permission.
- Add current overdue-arrival and unacknowledged-exception producers to the private inbox with bounded SQL, scoped permissions and complete-or-error combined limits.
- Add on-demand shipment panels, policy/source/native/browser regressions, route register, migration hashes, runbook and Windows handoff.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Current contract parties only, including wildcard actors; live transactional session/grant checks and mutation assurance. Buyer cannot edit seller-assigned arrangements, seller cannot acknowledge for buyer. No arbitrary link input, outbound mail or relaxed payment/recall/milestone guards.

## Database and deployment

- Migration required: yes, forward046/047.
- Backfill/lock implications: New history/receipt tables and timing revision; historical exceptions remain unacknowledged. Existing ETA is a baseline, not invented history. Contract then shipment locking serializes writes.
- Rollback or compensation: Retain immutable history; review application compatibility before rollback. No volume reset or changes to frozen migration assets.
- Configuration/secrets changed: None; dependencies unchanged. Normal Node startup migrates without npm/npx in the hardened API.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1216 API unit tests passed, API/web/browser types and strict native test compilation passed; API/web builds, quality,222-route inventory, frozen migration integrity, backlog/risk/branding, workspace-tools5, locale6, transport9 and runner14 passed. Initial entry73355 gzipbytes within92160 budget. Native/browser runtime and exact-commit full release must pass on founder Docker plus required CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: ETA is a party estimate; overdue means that UTC arrival date ended with no arrival report. No invented deadlines for unspecified milestones, external delivery guarantee, verified-carrier claim or legal risk-transfer change. Rendered keyboard/responsive acceptance remains pending.

## Follow-up work

- PRD-008: Remaining outbound lifecycle email coverage/external delivery acceptance.
- GEO-001/LOG-012: Regional transport policy/provider adapters.
- QLT-002/SEC-006: Full authorization matrix and independent review.
- ARC-024/PER-001: Larger-volume feed architecture and capacity acceptance.
- ENV-004/005/006: Hosted isolation and staging acceptance.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted131/343 (38.2%); after these two targets133/343 (38.8%). Core11/28 and provider-inclusive11/40 unchanged. Counts are not a valuation or pilot-safety probability.
