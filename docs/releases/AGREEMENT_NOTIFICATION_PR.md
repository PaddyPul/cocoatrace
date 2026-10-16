# PR title

feat: record versioned trade acknowledgements and private current notifications

# PR body

## Outcome

Buyers and sellers can review the base commercial record and explicitly acknowledge the same hashed agreement version, seeing each party’s timestamp. Users can read current trade notices, identify who needs to act and open the relevant workflow, with private read/unread receipts.

## Tracking

- Backlog ID(s): TRD-015, PRD-007 closure targets; accepted PRD-013/015 reconciled.
- Issue/ADR: docs/runbooks/AGREEMENT_NOTIFICATION.md.
- Target phase/environment: local/CI workflow acceptance; hosted pilot acceptance remains separate.

## Change summary

- Add immutable schema-v1 commercial snapshots and explicit buyer/seller acknowledgement receipts, current-hash conflicts, idempotent retries and atomic audit attribution.
- Add on-demand agreement review in Contract detail and Deal Room; show unaccepted parties honestly. Payment-protection terms retain their separate confirmation flow. Acknowledgements carry no legal signature claim and do not change dispatch or settlement gates.
- Add current trade notifications from existing action policy, private per-user/workspace receipts, snapshot-bound pagination, responsible-party labels and allowlisted deep links.
- Bound source SQL before enrichment and receipt reads to current fingerprints; oversized/error states remain unavailable rather than silently incomplete.
- Add native/browser definitions, policy/source tests, route inventory, migration hashes, English/French navigation, runbook and founder handoff.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Current contract parties only, including wildcard users; transactional live session/grant checks and mutation assurance. Snapshot changes invalidate old acknowledgements. Private notice receipts cannot alter business state. No outbound email or external URL input.

## Database and deployment

- Migration required: yes, forward044/045.
- Backfill/lock implications: New tables; no historical acceptance inferred. Contract lock serializes version/receipt changes. Immutable acknowledgement tables preserve history.
- Rollback or compensation: Review application compatibility before rollback; retain history. Never reset volumes or edit frozen migrations.
- Configuration/secrets changed: None; dependencies unchanged. Normal Node startup migrates; hardened API runtime has no npm/npx.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: API suite1201 passed; added bounded-source test suite5 passed afterward. Workspace types, strict native test compilation, builds, quality, migrations,218-route inventory and policy guards passed. Initial gzip73346bytes/92160 budget. Docker/native/browser/full release runtime not executed on author host. Add exact passing founder release SHA/date and check runtime boxes after verification; required GitHub CI before merge.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Semantic labels and keyboard controls implemented; rendered runtime review pending. Notices are current state, not a historical inbox or email delivery guarantee. First version review materializes snapshot metadata only.

## Follow-up work

- PRD-008: Remaining lifecycle email coverage and delivery acceptance.
- QLT-002/SEC-006: Complete authorization matrix and independent review.
- ARC-024/PER-001: Larger-volume durable notification architecture/performance acceptance; current feed refuses scopes above its bound.
- ENV-004/005/006: Hosted isolation and staging acceptance.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted progress129/343 (37.6%); after these two closure targets131/343 (38.2%). Core11/28 and provider-inclusive11/40 unchanged. These are backlog counts, not a valuation or launch-safety score.
