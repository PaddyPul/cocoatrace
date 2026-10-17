# PR title

refactor: separate private evidence downloads and payment creation domain boundaries

# PR body

## Outcome

Private evidence download authorization, metadata, storage and response lifecycle now have explicit typed owners. Payment-request creation joins the existing payment domain use cases, with one shared five-plan agreed-state policy instead of inline SQL and plan decisions in the HTTP controller.

## Tracking

- Backlog ID(s): ARC-004, ARC-006 closure targets; accepted ARC-007/SEC-007 reconciled.
- Issue/ADR: docs/runbooks/EVIDENCE_PAYMENT_BOUNDARIES.md.
- Target phase/environment: high-risk domain/controller ownership; existing runtime behavior acceptance remains required.

## Change summary

- Split evidence downloads into typed metadata repository, pure denial policy, private storage adapter, framework-free transfer lease and Express response adapter; keep upload operations delegated to existing services.
- Preserve uploader/entity access, scan/review/payment release gates, attachment/no-store/error headers, bounded legacy path handling and transfer admission through both storage and response completion.
- Extract seller-scoped payment creation transaction and pure closed/duplicate/money guards. Share the five-plan agreed status policy with terms while retaining installment/document/security/issue/settlement use cases.
- Add lifecycle and HTTP adapter tests, all-plan creation/audit rollback regressions and AST dependency guards.
- Update state ownership/runbook/current acceptance records without migrations, dependencies or UI/API redesign.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No new download access grant or dispatch/payment bypass. Transfer lease releases idempotently after storage/response completion, including early disconnect/error. Creation retains contract lock, seller scope and atomic audit; duplicate creation remains a conflict. No public storage URL or new external call.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None; existing SQL, rounding, actor scope and transaction order retained.
- Rollback or compensation: Revert code if required; no data migration or compensation.
- Configuration/secrets changed: None; dependencies unchanged. Hardened API startup remains Node-based without npm/npx.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1360 API unit tests passed; workspace API/web/browser types, strict compilation of4 affected native suites, API/web builds, quality,222-route inventory, migration integrity, evidence/backlog/risk/branding, workspace5/locale6/HTTP9 and runner15 passed. Initial entry73352 gzipbytes within92160 budget. Source comparison confirms extracted evidence query and6 payment SQL statements unchanged. Full exact-commit Docker/native/browser/evidence-stress release and required CI remain pending. Existing every-plan, private evidence and tenant tests must still pass.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No customer UI redesign or new rendered accessibility claim. Existing error envelopes and original inserted-row payment creation response retained. This does not add streaming, expiring download links, provider payments, legal assurance or universal clean architecture.

## Follow-up work

- ARC-003/008/011/019/020/023: Remaining domain/controller/query/type/error-envelope adoption.
- UPL-010/011/013: Download-link semantics, reviewer/history and retention policies.
- PER-003/007: Multi-instance transfer admission and streaming/capacity acceptance.
- SEC-006/QLT-002: Complete resource/role/field matrix and independent review.
- ENV-004/005/006: Hosted isolation/ingress acceptance.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted138/343 (40.2%); after two targets140/343 (40.8%). Core11/28 and provider-inclusive11/40 unchanged; completion counts do not imply valuation or launch safety.
