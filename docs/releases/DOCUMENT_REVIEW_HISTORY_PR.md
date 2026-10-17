# Title
feat: review private evidence and retain replacement history

## Outcome
Independent platform reviewers can approve or reject a specific retained document with a reason. Uploaders can replace proof without inheriting approval; historical versions remain attributable. Generic document review does not certify organic, origin or EUDR claims.

## Tracking
- Backlog IDs: UPL-009, UPL-011 (in progress until acceptance)
- Issue/ADR: existing evidence authorization and availability policy
- Target phase/environment: pilot candidate; Windows full release required

## Change summary
- Bounded reviewer queue, source fingerprint confirmation, immutable decision receipts and atomic audit.
- Owner replacement with current entity authorization, live session/role checks and immutable established lineage.
- Superseded proof excluded from current workflow and public selectors; authorized historical downloads retained.

## Security and data review
- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: independent wildcard reviewers require live fresh assurance. No trust claim is created by generic approval. Native tests require runtime verification.

## Database and deployment
- Migration required: yes,048 adds lineage/revision and immutable review decisions.
- Backfill/lock implications: nullable lineage, revision default0; coordinate ALTER TABLE/index creation with operator.
- Rollback or compensation: prefer forward correction; down removes review records and lineage, so preserve evidence before any rollback.
- Configuration/secrets changed: none.

## Verification
- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 1,430 API unit tests passed; workspace/browser types, API/web builds, quality, migration integrity,226-route authorization inventory, web budgets, backlog/risk checks and strict native test compilation passed. Database/browser runtime and full release remain pending.

## Product and operations
- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work
DAT-003/DAT-010 claim-specific assessment,UPL-010 sharing and hosted pilot gates remain open.

## Backlog update
- [x] Item remains open and is marked IN PROGRESS
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
