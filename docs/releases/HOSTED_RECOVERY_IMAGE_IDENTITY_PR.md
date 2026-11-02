## Outcome

Fix the Oracle update failure caused by treating the source API container's configuration digest as a runnable image ID. Verify a locally cached image against the original container and check archive access before taking the demo offline.

## Tracking

- Backlog ID(s): INV-001, ENV-005, ENV-013, ENV-017, OPS-002, OPS-009
- Issue/ADR: extends docs/adr/004-oracle-synthetic-demo.md; follow-up to PR #158
- Target phase/environment: existing synthetic Oracle investor demo

## Change summary

- Resolve cached source images and verify their configuration identity using a networkless probe that is never started; pin the runnable image ID in snapshot metadata.
- Reject moved tags, missing original images and cleanup label mismatches; never pull or substitute a newer release.
- Run image/archive preflight before maintenance in both update and backup commands; expose a locked standalone preflight.
- Preserve old complete manifests and failed partial snapshots; document the observed Oracle failure and recovery.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: Pinned SHA-256 image IDs, exact source configuration equality and label-checked probe cleanup. No source volumes are attached to the unstarted identity probe. Archive preflight attaches evidence read-only, has no network and emits no document contents. Existing lock and private snapshot controls remain. No Sonar suppression or review-manifest hash change.

## Database and deployment

- Migration required: no
- Backfill/lock implications: shared maintenance lock; read-only preflight before downtime; consistent snapshots still stop writers
- Rollback or compensation: failed preflight leaves the live service running; later update failure retains maintenance; no automatic live restore
- Configuration/secrets changed: no secret changes; snapshot image metadata distinguishes runnable IDs from container configuration digests

## Defect regression

- Defect severity: P1
- Confirmed P0 register ID (if applicable): not applicable
- Regression test and failure behavior: containerd index/config identity accepted only on exact match; moved tag rejected and probe removed; missing images never trigger a pull/substitution; wrong cleanup label refuses deletion. Fourteen Python recovery/input tests pass.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [ ] API build/typecheck
- [ ] Web production build
- [ ] Staging verification
- Evidence/results: Focused author Python/Node maintenance checks passed. Full native release, exact-main CI including hosted-demo-recovery, and actual Oracle preflight/update/restore remain required. Docker is unavailable in the author environment; a mocked resolver regression does not constitute an actual containerd restore.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

OPS-002/009: actual non-empty Oracle evidence restore and off-VM encrypted recovery. INV-001/003: hosted account/trade continuity acceptance. ENV-005/013/017: verify update and paused CD before activation. No item is closed solely by this patch.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete
