# PR title

test: standardize native fixtures and maintain source-backed pilot capability evidence

# PR body

## Outcome

Critical transport/notification integration tests share guarded typed fixtures instead of copying incomplete organization, permission and trade setup. Pilot and investor discussions get a current source-linked architecture/security overview and a maintained capability matrix that separates accepted local behavior from partial and roadmap work.

## Tracking

- Backlog ID(s): QLT-018, INV-004, INV-005 closure targets; accepted LOG-008/010 reconciled.
- Issue/ADR: docs/runbooks/PILOT_EVIDENCE_FIXTURES.md.
- Target phase/environment: engineering test foundations and pilot due-diligence evidence; hosted and external validation remain separate.

## Change summary

- Add typed disposable-database builders for verified exporter/importer actors, real login sessions, explicit roles, physical stock, listings, offers, contracts and shipments.
- Adopt helpers in timing, exception-awareness and notification native suites while retaining scenario assertions. Add native fixture contract tests for tenant independence, live role reduction, required linked fields and unsafe database refusal.
- Add a source-backed modular-monolith/security overview with trust, storage/scanning, audit/outbox and deployment boundaries.
- Maintain23 capability entries with backlog/evidence/limit references. Generate the human-readable current/partial/roadmap matrix explicitly and check acceptance/source/output drift in CI/release.
- Add policy regressions for unsupported claims, unsafe/missing evidence, stale generation, CRLF equivalence and broken overview links.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Test builders refuse non-disposable database targets before any write. They use real login and live roles, not forged privileged credentials. Existing domain concurrency/audit regressions are preserved. Evidence paths stay within the repository. Documents distinguish traceability from independent audit or hosted assurance.

## Database and deployment

- Migration required: no.
- Backfill/lock implications: None in production; native fixtures only create isolated scenario state in disposable test databases.
- Rollback or compensation: Revert test/evidence changes if required; no production data migration or compensation.
- Configuration/secrets changed: No dependencies or secrets. New check:pilot-evidence runs in release/CI without reinstall.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: Author:1216 API unit tests,4 capability-evidence tests,15 runner tests, workspace API/web/browser types, strict compilation of4 native suites, API/web builds, quality and existing authorization/migration/backlog/risk/branding/workspace/locale/HTTP guards passed. Initial entry73352 gzipbytes against92160 budget. Native runtime/full release and required CI remain pending. Existing browser journeys remain release gates; no new customer UI behavior is introduced.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced
- Notes: No customer UI/API behavior changes. Architecture and matrix are readable repository documents; no rendered UI change needs an accessibility claim. Traceability checks cannot establish semantic completeness, customer traction, compliance or valuation.

## Follow-up work

- QLT-002/SEC-006: Complete resource authorization matrix and independent review.
- QLT-014/016 and PER-001: Broader adapter contracts and representative hosted capacity.
- ENV-004/005/006: Hosted isolation/HTTPS/secrets acceptance.
- INV-006/007/009/016: Design partners, commitments, repeated use and fundraising assessment.
- LOG-012 and provider gates: Verified logistics-provider marketplace and optional adapters.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
- Accepted133/343 (38.8%); after these three targets136/343 (39.7%). Core11/28 and provider-inclusive11/40 unchanged; counts do not imply valuation or launch safety.
