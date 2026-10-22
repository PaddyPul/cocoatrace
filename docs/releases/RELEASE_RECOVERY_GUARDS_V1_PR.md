## Outcome

Private evidence recovery now proves that restored database metadata resolves to the correct private bytes and historical object versions. Release verification captures its candidate before checks and refuses changed Git state. A pinned, canary-tested full-history secret scan blocks unreviewed findings without publishing values.

## Tracking

- Backlog ID(s): UPL-018 (closure target); SEC-013, OPS-002, SAF-002 (partial/follow-up); reconcile UPL-010, UPL-012, RCL-004
- Issue/ADR: docs/runbooks/PRIVATE_EVIDENCE_RESTORE.md; docs/runbooks/SECRET_SCANNING.md; docs/runbooks/RELEASE_CANDIDATE_EVIDENCE.md
- Target phase/environment: Phases 1–3; disposable local/CI release safeguards. Managed-provider and repository-owner acceptance remain separate.

## Change summary

- Extend the existing mandatory PostgreSQL rehearsal with versioned private Moto object archive, complete source destruction, separate bucket restore, original-to-restored version mapping, retained deletion markers and restored-database hash/size/MIME cross-checks.
- Require corruption, missing-version and mismatched metadata canaries to fail; preserve schema, migration history, linked records and audit checks. Retain a safe CI recovery summary.
- Capture clean candidate commit/branch before verification; fail on changed HEAD, branch, tracked or untracked files; overwrite stale passing evidence even when preflight fails.
- Add pinned Gitleaks default rules, generated detection canary, complete HEAD history, exact expiring reviewed fingerprints and a value-free summary to CI/full release. Inline allow comments and ignore files cannot bypass it.
- Reconcile founder acceptance of PR #143: UPL-010, UPL-012 and RCL-004 complete; accepted174/362 (48.1%).

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Only fixed disposable databases/buckets are used; no production endpoint parameter. S3 version IDs are mapped, not falsely claimed preserved. Private archive/map stay in the disposable container. No live application grants, business states or audits change. Scanner raw reports are redacted, temporary and removed; safe summaries omit values/context/identities. Four historical false-positive/synthetic occurrences have exact fingerprints and expiry2027-01-20; no broad exclusions.

## Database and deployment

- Migration required: no
- Backfill/lock implications: none to deployed application; rehearsal applies current forward migrations in disposable PostgreSQL.
- Rollback or compensation: revert runner/workflow changes; no customer-data mutation or schema rollback. Cleanup removes only the fixed test project. Failed recovery leaves production unchanged.
- Configuration/secrets changed: no application credentials; a pinned scanner image is pulled on first use. New safe ignored report directories. Optional exact-version native scanner override for author diagnostics only.

## Defect regression

- Defect severity: P2 — engineering evidence attribution; no confirmed P0
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: `passing release records the candidate captured before verification`; commit/branch/tracked/untracked mutation regressions; `dirty preflight overwrites stale passing evidence and executes no checks`; failed object archival stops backup and cleans the disposable project. Runtime object canaries reject corrupted heads, lost historical versions and metadata hash/size/MIME mismatches. Secret tests reject new/expired occurrences and prove the persisted projection omits secret/context/identity fields.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [ ] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results: 34 release/scanner/recovery runner regressions pass; backlog regressions pass. Actual Moto5.2.3 archive/source-destruction/restore/version/delete-marker/checksum/private-control/mismatch canaries pass on author host. Exact-version native Gitleaks detection canary and full-history scan pass with four reviewed occurrences. Quality gate passes. Application source/dependencies unchanged; API/web builds and all native Docker suites run through the founder full release. PostgreSQL+Docker orchestration and hosted acceptance are not claimed from author Moto validation.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

SEC-013: owner enables repository secret scanning/push protection and required check, verifies settings. SAF-002: actual credential rotation/revocation exercise. OPS-002/ENV-004/011 and UPL-013: managed-provider snapshots, independent retention, named owners and measured RPO/RTO. GOV-006: enforce required check through repository rules. No automatic production deployment or backup service is introduced. Accessibility/API/web build checkboxes are not applicable to these non-UI runner changes; existing full release still runs application checks.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete


UPL-018 stays IN PROGRESS until the exact-commit Docker/full release and review accept its original metadata/object-version restore criterion. Accepting it yields175/362 (48.3%). SEC-013 stays partial until owner settings are verified; managed recovery stays open. Core/provider-inclusive gates remain11/28 and11/40.
