# PR title

fix(security): hide private source identities and keep authorized reads snapshot-consistent

# PR body

## Outcome

A caller with valid ordinary permissions cannot distinguish another organization's private farm/plot, batch, certificate or holding from an absent record through the response. Authorized source reads remain available under the existing relationship/network policy, with details and linked collections evaluated in one consistent snapshot. Session-bound data and denial responses receive a no-store default.

## Tracking

- Backlog ID(s): SEC-006, QLT-002, ARC-011; CORE-tenant.
- Issue/ADR: AUTHORIZATION_MATRIX.md and SOURCE_RESOURCE_BOUNDARIES_2026-10-14.md; no new ADR.
- Target phase/environment: pre-pilot local engineering candidate; full resource/field and hosted acceptance remain open.

## Change summary

- Return matching foreign/absent 404 responses for six private direct/plot reads; authorize farm/batch/certificate details before hydration.
- Extract four detail builders into privateResources.ts and pass one bounded repeatable-read executor through policy, metadata, collection and trust reads.
- Validate four direct-detail UUID parameters after credential/permission guards; retain current holder-only holding scope.
- Establish no-store in session authentication and extend existing 178 credential/155 permission cases to check it.
- Add paired two-organization, collection/search/total, role-union, network, live revocation/suspension and concurrent holding-snapshot regressions; update old 403 expectations only for the changed classes.
- Keep MFA authorization probes on the bounded organization page and restore changed farm ownership even when the cursor denial assertion fails.
- Record the founder's completed authorization-register workflow separately from this candidate.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: 401 credentials and 403 missing permissions precede UUID validation. Valid but foreign/absent private identities return identical per-endpoint bodies. Ordinary role unions do not imply network authority. Existing cooperative/certifier/trade relationships and explicit network flags remain; holding access remains current-holder only. Policy and hydration share a bounded snapshot. Current role/session/user/organization changes govern the next request, without claiming cancellation of already authorized snapshots. Reads create no business mutation audit or outbox work. No new credential/body logging, external URL or recipient is introduced. Relationship-specific field projection remains a separate review requirement.

## Database and deployment

- Migration required: no; frozen migration assets unchanged.
- Backfill/lock implications: no backfill or write lock introduced. Detail reads now use the existing bounded repeatable-read transaction and two-second statement/five-second total read limits; no deadline is raised.
- Rollback or compensation: revert API/query/tests together to restore the prior response convention; no business/audit/outbox record rewrite or compensation needed.
- Configuration/secrets changed: none; no dependency/provider or real email setup.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed 1,034 API cases in 98 files, quality, workspace/browser types, both builds, register checks, migration integrity and backlog consistency. New 34-case native suite and four affected existing suites compile strictly. Docker/PostgreSQL/full browser execution remains founder release and required CI acceptance. Add the passing exact commit/date and required CI evidence before merge. No separate manual persona test is needed. See SOURCE_RESOURCE_BOUNDARIES_WINDOWS.md.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: API-only change; no new UI flow or visual audit claimed. Existing authorized response shapes/pagination are retained. No hosted latency/capacity or universal authorization certification is claimed.

## Follow-up work

- SEC-006/QLT-002: paired trade/payment/fee/shipment/evidence/profile/provenance and admin action coverage; remaining nondisclosure conventions and relationship-specific field projections.
- ARC-011: remaining controller mutation SQL and complete repository/policy separation.
- SEC-007/014, SAF-002/003/004: deployment-specific ingress/CSP/secrets/private storage and independent review.
- OPS/PER gates: real inbox/incident ownership, private-byte recovery and representative hosted capacity remain separate.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- No full-item completion credit: roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%). The earlier register release is recorded as accepted; current native/hosted acceptance is not inferred.
