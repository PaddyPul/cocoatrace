# PR title

refactor: isolate transport transitions and cover every registered cookie-write origin boundary

# PR body

## Outcome

Shipment progression and arrangement changes now run through readable typed domain use cases rather than a compressed HTTP controller. Every current mutating endpoint receives the same real-app cookie-origin regression coverage, including public identity and upload-capability entry points.

## Tracking

- Backlog ID(s): ARC-007, SEC-007 closure targets; accepted QLT-018/INV-004/INV-005 reconciled.
- Issue/ADR: docs/runbooks/TRANSPORT_SECURITY_BOUNDARIES.md and docs/security/COOKIE_WRITE_ROUTE_MATRIX.md.
- Target phase/environment: modular domain ownership and registered HTTP boundary acceptance; hosted ingress and complete resource matrix remain separate.

## Change summary

- Replace shipment controller logic with four typed HTTP adapters; extract schema-derived models, transaction use cases, SQL repository and pure transition/payment-exception policy.
- Retain existing delivery acceptance/discrepancy/resolution use cases outside HTTP. Preserve Incoterm authority, lock order, recall/payment/currency/issue gates, timing history, delivery installments/distribution, settlement and atomic auditing.
- Add AST architecture regressions preventing database/SQL coupling in shipment HTTP handlers and HTTP/persistence coupling in selected domain/policy seams.
- Enumerate all97 registered writes, verify actual runtime inventory parity, and run8 origin/header rejection scenarios per route (776 requests). Database probes prove requests are rejected before state processing.
- Preserve valid-origin invalid-credential and canonical Bearer machine-client semantics; retain real native/browser cookie-session regressions.
- Update architecture notes, current acceptance records and Windows handoff without new dependencies, migrations or UI behavior.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No new origin-policy exemption or transport power. Missing/foreign/null origins, malformed authorization and forged Host/forwarded identity fail403 before database work. Existing native concurrency/audit rollback and browser workflows remain required runtime acceptance; broad resource authorization remains separately tracked.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None. Existing SQL/lock ordering preserved; thirteen normalized SQL statements are unchanged and one expands the same delivered_at clause inside its repository helper.
- Rollback or compensation: Revert code if necessary; no production data migration or compensation.
- Configuration/secrets changed: None; dependencies unchanged.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1325 API unit tests passed, including776 rejected requests over97 write routes and selected AST architecture guards. Workspace types, strict compilation of5 affected native suites, API/web builds, quality,222-route inventory, migration integrity, evidence/backlog/risk/branding, workspace5/locale6/HTTP9 and runner15 passed. Initial entry73352 gzipbytes within92160 budget. Full exact-commit Docker/native/browser release and required CI remain pending. Unit route coverage does not prove successful authenticated business operations or hosted ingress.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No intended customer UI/API contract change; existing error envelopes retained. No new rendered accessibility claim. Selected architecture guards do not establish universal clean architecture or independent security review.

## Follow-up work

- ARC-003/004/006/008/011/019/023: Remaining domain/controller/SQL/error-envelope adoption.
- SEC-006/QLT-002: Full resource/role/field authorization matrix.
- SEC-008/ENV-006: Hosted CSP, ingress, TLS and cookie acceptance.
- ENV-004/005 and pilot gates: Hosted isolation and operational readiness.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted136/343 (39.7%); after two targets138/343 (40.2%). Core11/28 and provider-inclusive11/40 unchanged; counts do not imply valuation or launch safety.
