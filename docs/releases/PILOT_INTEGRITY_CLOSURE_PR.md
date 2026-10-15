# PR title

feat: enforce departure readiness and certificate scope integrity

# PR body

## Outcome

An arranging party must record essential transport information before reporting actual departure. Certificate issuance and reinstatement cannot create a second active record from the same issuer for the same subject/farm/standard with overlapping crop and validity scope. Explicit validity-boundary regressions, seven architecture decisions and a maintained risk register complete five candidate outcomes; three previously accepted logistics items are reconciled as complete.

## Tracking

- Backlog ID(s): LOG-003, DAT-005, DAT-006, GOV-004, GOV-008.
- Reconciled existing acceptance: LOG-002, LOG-004, LOG-011. Prior six offer/customer/policy items now complete.
- Issue/ADR: adr/README.md, RISK_REGISTER.md and runbooks/TRANSPORT_RESPONSIBILITIES.md.
- Target phase/environment: pre-pilot engineering and documentation acceptance; hosted/corridor approval remains separate.

## Change summary

- Require provider name OR booking reference, known mode and origin/destination for actual departed reports. Return structured missing fields after authority, recall and payment gates.
- Preserve draft, source loading/handover and later arrival/recovery/receipt reporting; no blanket vessel/container/ETA/document requirement.
- Serialize certificate issuance/reinstatement on the farm row and reject active same-issuer/subject/standard intersecting crop/date scope. Preserve independent issuers, standards, crops and nonoverlapping periods.
- Use civil DATE text for reinstatement overlap checks; avoid timezone conversion of validity bounds.
- Add seven native validity and five native duplicate-scope regressions, plus departure and fixture updates.
- Publish seven architecture records and eight likelihood/impact/mitigation/owner/review-date risks. Require risk-source/view consistency in CI/release.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: current authority and existing payment/recall controls retain priority. Exceptional dispatch cannot bypass arrangement readiness. Certificate guards retain approved independent-issuer requirements; concurrent app writes serialize, and failed attribution/audit rolls back state. This does not add a DB-admin exclusion constraint or silently rewrite historical duplicates. Risk records contain no credentials/customer data and do not automatically accept risks. Shared owner is the coordinating founder, not an invented independent reviewer.

## Database and deployment

- Migration required: no; frozen assets unchanged.
- Backfill/lock implications: certificate writes take a farm row update lock to serialize app issuance/reinstatement; old rows are preserved. Existing draft shipments need completed arrangement fields before new actual departure.
- Rollback or compensation: revert API/helper/UI/test changes together; no forced certificate/inventory/payment rewrite. Reverting integrity guards requires review; preserve existing audit history.
- Configuration/secrets changed: none; no dependency/provider/paid service. Risk register adds repository data and an existing-tooling release gate.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author passed 1,087 API unit cases, code quality, workspace/browser types, both builds, risk checks, authorization register and backlog consistency. Four affected native suites compile strictly. Native certificate scope races, validity boundaries and real departure/browser journeys require exact-commit full release and required CI. Record passing SHA/date and CI evidence before merge; update applicable boxes after pass. No repeated manual persona loop is requested.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: departure failure identifies missing arrangement fields; provider identity is not independently verified. Current limitations copy 2026-10-14.1 was reviewed and remains accurate. ADR publication does not provision infrastructure; a due risk review is reported without failing solely on time or claiming automatic risk closure.

## Follow-up work

- GEO-001: approved pilot corridor/named-place/domestic policy; no legal Incoterm compliance claim.
- DAT-013: data-quality reporting/remediation for historical contradictions; no silent cleanup of old certificates.
- ENV/OPS/SAF/PER and SEC-019: actual private resources, inbox/owner/recovery/capacity and independent security evidence.
- GOV-008: coordinating owner must review by the recorded next date and update risk decisions; publication does not schedule or perform future reviews.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Prior six accepted closures plus LOG-002/004/011 reconciliation make 101/343 (29.4%) accepted. Close five candidate rows after integrated release/review/merge: 106/343 (30.9%). Core 11/28 (39.3%) and provider-inclusive 11/40 (27.5%) stay unchanged because corridor/hosted criteria remain.
