# PR title

refactor: separate recall workflows and document operation authority

# PR body

## Outcome

Recall activation, notifications and response mutations now have explicit typed repository owners. An operation matrix and regressions distinguish investigation/activation entry permissions, recall management and participant physical responsibility using the existing permission model.

## Tracking

- Backlog ID(s): ARC-008, RCL-010 closure targets; accepted ARC-004/006 reconciled.
- Issue/ADR: docs/runbooks/RECALL_WORKFLOW_BOUNDARIES.md and docs/security/RECALL_OPERATION_AUTHORITY.md.
- Target phase/environment: Phase 2 recall architecture/authority; exact-commit runtime acceptance remains required.

## Change summary

- Extract activation/stock-protection SQL, participant/outbox persistence and response reads/mutations into typed repositories.
- Keep bounded trace orchestration, advisory/row locks, proof preflight/current revalidation, physical accounting and critical audit/outbox writes in their existing transaction boundaries.
- Centralize current manager/network decisions in pure policy. Document that recall.manage.all alone does not satisfy investigation/activation route entry; manager/network authority cannot acknowledge another organization or override current holding ownership.
- Add activation failure, worker connection/rollback/submission, permission policy and architecture regressions, plus native role-boundary coverage.
- Preserve existing conditional hold release for fully accounted corrected/released inventory, retained returned/destroyed stock holds and explicit republishing.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No new permission, recipient, public endpoint or role grant. Existing proof availability checks, seed scope, stock holds, queue lease tokens, inactive-recipient suppression and retry limits remain. SMTP submission is not proof of inbox delivery. No investigator role, second approver or legal recall mandate is claimed.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None; existing recall lock order, query limits, stock writes and transaction semantics retained.
- Rollback or compensation: Revert code if required; no data migration or compensation.
- Configuration/secrets changed: None; dependencies unchanged. Hardened API startup remains Node-based without npm/npx.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1386 API unit tests passed; workspace API/web/browser types, strict compilation of5 affected native suites, API/web builds, quality,222-route register, pilot evidence/backlog/risk/branding checks and migration integrity passed. Workspace5/locale6/HTTP9/runner15 also passed. Initial entry73352 gzipbytes within92160 budget. Source review confirms existing activation7, notification13 and response13 SQL statements retained, with the formerly optional response lock specialized to its sole transactional caller. Full exact-commit Docker/native/browser/evidence-stress release and required CI remain pending; no runtime pass is claimed from compilation. Update integration/browser boxes with the passing release SHA/date after acceptance.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: Existing HTTP/UI/error behavior retained. No UI redesign or new accessibility claim. Operator responsibilities and current authorization limits are documented; independent security and operational exercises remain open.

## Follow-up work

- ARC-003/011/019/020/023: Remaining broad controller/query/type/error-envelope adoption.
- SEC-006/QLT-002: Complete resource/role/field matrix and independent review.
- CORE-performance: Hosted representative capacity acceptance.
- Remaining recall exercises and policy work retain their existing backlog status; this bundle does not claim pilot readiness.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted140/343 (40.8%); after two targets142/343 (41.4%). Core11/28 and provider-inclusive11/40 unchanged. Completion counts do not imply valuation or launch safety.
