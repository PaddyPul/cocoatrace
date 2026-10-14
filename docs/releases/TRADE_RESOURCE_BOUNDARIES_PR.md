# PR title

fix(security): scope trade details and verify buyer-seller action boundaries

# PR body

## Outcome

Unrelated organizations cannot distinguish private contract, payment or shipment records from absent records through direct reads, even with wildcard permissions. Authorized parties receive consistent detail snapshots. Automated regressions protect buyer/seller payment actions and Incoterm transport responsibilities.

## Tracking

- Backlog ID(s): SEC-006, QLT-002, ARC-011; CORE-tenant.
- Issue/ADR: TRADE_RESOURCE_BOUNDARIES_2026-10-14.md and AUTHORIZATION_MATRIX.md; no new ADR.
- Target phase/environment: pre-pilot local candidate; hosted acceptance remains separate.

## Change summary

- Scope direct contract/payment/shipment SQL to current trade parties; return matching foreign/absent 404 responses.
- Validate direct-read UUIDs after credential and permission guards.
- Use one bounded snapshot for parent and linked details; send contract success only after completion.
- Reject oversized linked arrays explicitly, without partial success.
- Add private-read regressions and wrongful-party payment state/audit invariants; preserve all eleven Incoterm write rules and document-release gates.
- Record accepted source-boundary release f74f290f and main update 606da5bd0 without inferring hosted or independent CI acceptance.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: wildcard grants no trade-party bypass. Entry guards precede UUID parsing. Reads do not emit business audit/outbox work; denied payment mutations are checked for unchanged state and relevant audit counts. Existing payment locks, evidence ownership/release and Incoterm authority remain. Snapshot consistency is not cancellation of in-flight authorization; broader field-level disclosure review remains open.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: no backfill; existing two-second statement/five-second total catalog read bounds retained. Read snapshots add no write locks.
- Rollback or compensation: revert API/query/tests together; no data compensation required.
- Configuration/secrets changed: none; no new dependency or outgoing email configuration.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: 1,045 API unit cases in 101 files, code quality, all workspace/browser types, API/web builds, authorization register and backlog checks passed; author validation is recorded in TRADE_RESOURCE_BOUNDARIES_WINDOWS.md. Native PostgreSQL suites compile strictly; Docker and full browser runtime are pending founder release verification and required CI. Record passing exact commit/date and CI evidence before merge. No additional manual test is requested.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: API-only; no new visual flow. Changed foreign payment/shipment direct reads now return 404. Valid detail response shapes remain. Oversized linked arrays return explicit 422, with no silent truncation.

## Follow-up work

- SEC-006/QLT-002: remaining field-level document, fee, profile/provenance and admin-action coverage, current-authority transitions and universal resource matrix.
- ARC-011: remaining controller mutation SQL and repository/policy separation.
- SEC-007/014, SAF-002/003/004 and OPS/PER: deployed ingress/secrets/private storage, independent security review, real incident ownership and hosted recovery/capacity evidence.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- No whole-item completion credit: roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%). Prior source slice accepted; current runtime acceptance remains pending.
