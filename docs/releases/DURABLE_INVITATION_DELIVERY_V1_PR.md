## Outcome

An invitation committed by BetterTrade can now be delivered after a request/process crash. Team creation, resend and first-admin organization approval commit the business change, delivery intent and audit together. Buyers/suppliers see an honest queued state; operators can inspect and review transient terminal failures without exposing bearer credentials.

## Tracking

- Backlog ID(s): ARC-013, IDN-021, SEC-006, OPS-010; prior accepted inspection CT-00 reconciled
- Issue/ADR: docs/runbooks/INVITATION_DELIVERY.md; docs/engineering/INVITATION_DELIVERY_NEXT.md (no separate issue number assigned)
- Target phase/environment: Phases 1–2; local/test and deployment preparation. Real staging/provider acceptance remains open. Canton remains optional P2.

## Change summary

- Add a transactional invitation-generation outbox across all three invitation producers, including first-admin approval; initial issuance/review now recheck live authority inside the transaction.
- Encrypt recoverable tokens with a dedicated AES-256-GCM key, bind them to invitation/generation/recipient and clear them on submission, suppression, replacement, cancellation or observed expiry.
- Add bounded claims, leases, retry backoff and restart recovery, tracked worker status, queue observations and audited operator retry with live revalidation.
- Show pending delivery distinctly from disabled/sent; extend operations browser coverage and native fault/concurrency definitions.
- Record founder acceptance of CT-00 inspection after PR #139. Accepted backlog becomes 170/362 (47.0%); no Canton runtime or whole-item credit for this unaccepted delivery candidate.

## Security and data review

- [x] Resource authorization and unrelated-tenant behavior considered
- [x] Sensitive/commercial/personal data exposure considered
- [x] Retry, idempotency and concurrency considered
- [x] Audit/outbox behavior considered
- [x] File, URL or external-input handling considered where applicable
- Notes: No plaintext bearer, recipient email or key in the outbox/logs/audit. Recipient digest remains sensitive internal metadata. Initiators require current scope/session/assurance; workers recheck issuer and target eligibility. Resend invalidates old generations; revoke/accept scrub pending credentials. SMTP is at least once and can duplicate after unknown outcomes; relay acceptance is not inbox delivery. Lifecycle locks remain held during SMTP submission and slow providers can delay access decisions. No wildcard ledger rights or new Canton integration is introduced.

## Database and deployment

- Migration required: yes — forward migration 052, registered digest; applied migrations unchanged
- Backfill/lock implications: adds an empty outbox, partial indexes and worker-name constraint; no historical replay/backfill. Legacy hash-only invitations require explicit authorized resend. Short claim transactions; current identity/invitation locks remain held during submission.
- Rollback or compensation: stop new workers and prefer forward repair; preserve queue/history/key. Down migration refuses nonempty history. An old UI needs the stopped new worker's status row removed; old code cannot drain/expire pending credentials. Do not reset volumes.
- Configuration/secrets changed: dedicated 64-hex INVITATION_DELIVERY_KEY required for enabled identity SMTP, independent of session/evidence keys. Disabled demo unchanged. Synthetic browser key isolated; local Mailpit override requires a local key. One key only; drain/reissue before rotation.

## Defect regression

- Defect severity: P1
- Confirmed P0 register ID (if applicable): not applicable; no confirmed P0 classification
- Regression test and failure behavior: native `recovers committed invitation intent after the original request is gone and scrubs submitted credentials`; `rolls back invitation and business audit when outbox persistence fails`; `claims once across concurrent workers`; `retries unknown submission outcomes at least once without falsely reporting sent`. Outbox failure rolls back business/audit; incomplete submission stays retryable/terminal without a false sent record. Crypto and response unit regressions run independently of Docker.
- A P0 fix must include its regression in the same PR; do not merge a test-free P0 fix. Add the defect and exact test title to docs/quality/p0-regressions.json. Label confirmed P0 PRs `severity:P0`.

## Verification

- [x] Unit tests
- [ ] Database/API integration tests
- [ ] E2E/manual persona journey
- [x] API build/typecheck
- [x] Web production build
- [ ] Staging verification
- Evidence/results: author 1,613 API unit cases pass; workspace/API/web/browser types, API/web builds, quality/controller boundaries, migration integrity, authorization register, backlog tests and web entry budget pass. The first native run passed 877 cases across 83 suites, but the new delivery suite failed setup because the unseeded baseline lacked the exporter role; its 21 cases were skipped. A fixture correction now supplies and cleans up the required role without changing existing role permissions. Targeted native and full-release reruns remain pending. Native delivery/operations suites compile strictly; browser definitions include pending invitation and invitation terminal retry. Docker/browser/native runtime and full verify:release are pending on the author host. Before merge, record the new candidate SHA/date, passing full-release summary with matching commit and required CI. Do not mark runtime/staging checkboxes from compilation alone.

## Product and operations

- [x] User-facing states and errors are clear
- [x] Logs/metrics redact secrets and identify failures
- [x] Documentation/runbooks/API contract updated
- [ ] Accessibility/responsive behavior checked where applicable
- [x] No unsupported product claim introduced

## Follow-up work

ARC-013: complete whole-write mutation/audit/event inventory and remaining negative/concurrency coverage. IDN-021 / ENV-004–014: real staging inbox/link and private restore evidence. OPS-006/010: named hosted ownership, external alerts, incident/key/retention drills and SMTP latency acceptance. SEC-006 / SAF-002: deployed secrets/least-privilege review. CT-01–18: optional Canton ADR/runtime/integration work remains unimplemented. Request-access verification and password-reset delivery retain existing synchronous behavior.

## Backlog update

- [x] Item remains open and is marked `IN PROGRESS`
- [ ] Item acceptance criteria and definition of done are met and it is checked complete

ARC-013/IDN-021 and hosted security/operations items remain partial. CT-00 alone records the founder's already accepted inspection from the previous merged bundle. Current count: 170 complete, 57 partial, 135 open out of 362; core gates 11/28 and provider-inclusive 11/40 unchanged.
