# PR title

feat(security): enforce a reviewed route register and systematic entry authorization

# PR body

## Outcome

Every explicit HTTP entry point is mapped to reviewed credential/permission guards and resource-policy evidence. New public surfaces or guard drift fail release/CI checks. Access-application review now rejects non-administrators before validating their IDs, queries or approval/rejection payloads, while keeping its existing service authority checks.

## Tracking

- Backlog ID(s): SEC-001, SEC-006, QLT-002; CORE-tenant.
- Issue/ADR: AUTHORIZATION_MATRIX.md and ROUTE_SECURITY_REVIEW_2026-10-14.md; no new ADR.
- Target phase/environment: pre-pilot local engineering candidate; universal resource and hosted security acceptance remain open.

## Change summary

- Add a checked 195-route source register with explicit public/token/capability exceptions, inherited guards and current policy/test pointers.
- Prove actual Express registration equality and credential denial across 178 protected routes, including implicit HEAD behavior.
- Supply native cases for all 155 declared-permission routes using a genuine zero-permission session, with malformed-review, foreign-recall and audit controls.
- Add early wildcard-administrator guards to six access-application endpoints; retain service/query checks.
- Require the register gate in release and GitHub CI; refresh historical matrix wording and record the prior recovery acceptance.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: no new public endpoint, role grant, provider or business mutation is introduced. Public/token exceptions and the capability-aware upload handler are explicit; ordinary permissions never imply network scope. Entry-boundary coverage is distinct from full resource ownership, role-union, suspension, returned-field and state-transition proof. The new native case requires foreign/absent recall responses to match; it does not assert a universal legacy 403/404 convention. Tests deny access without creating business mutation audits. Existing transactional and origin/passkey checks remain mandatory.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: none; no production query/schema change.
- Rollback or compensation: revert route/tooling/CI changes without rewriting business/audit/outbox history. Keep existing service policies and older migrations.
- Configuration/secrets changed: none. New check:authorization command uses the already installed TypeScript development compiler; no dependency change or external account required.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Passed: 1,013 API unit tests in 97 files; six register regression cases; nine release-runner tests; workspace/browser type checks; strict native-suite compilation; API/web production builds; quality, migration integrity and three backlog consistency tests; whitespace validation. The existing web chunk-size warning remains. No Docker/PostgreSQL or full browser execution is claimed here.. New native cases compile strictly; Docker/PostgreSQL/full browser execution remains founder release and required CI acceptance. Add passing exact SHA/date and CI evidence before merge. Existing browser journeys remain unchanged. Evidence pointers are not execution reports.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: API/tooling-only change, no new UI flow. The gate reports aggregate counts and explicitly labels resource-matrix acceptance partial. No new request-body/credential logging. No hosted/penetration-test or full-authorization certification claim.

## Follow-up work

- QLT-002/SEC-006: paired authorized/foreign-ID coverage for every resource/action; role unions, suspension, nondisclosure conventions and returned-field/no-state-change assertions.
- SEC-007/014 and SAF-002/003/004: deployment-specific ingress/secrets/CSP/private-storage and independent privileged/security review.
- OPS-006/007/012: real inbox, incident ownership and hosted operational acceptance remain separate.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- SEC-006/QLT-002 are explicitly partial; no full-item credit. Roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%).
