# Private evidence lifecycle audit

Candidate for UPL-014 / ARC-013 / QLT-002, based on merged main PR #140. The founder accepted the previous invitation delivery release. This candidate still requires focused native and exact-commit full release verification.

## Event matrix

| Boundary | Durable record | Failure behavior / evidence |
| --- | --- | --- |
| Upload intent | `evidence.upload_intent.create`, actor and upload-intent ID | Intent, reservation and audit roll back together; `evidenceUploadService.test.ts`, native business-audit/cleanup suites |
| Uploaded clean bytes | `evidence.upload.complete`, evidence ID and content hash | Evidence completion, ownership/retention and audit share the transaction; completion rollback and retry regression in `evidenceCleanup.integration.test.ts` |
| Upload scan error / infection | `evidence.scan.failed` / `evidence.scan.infected` | Scan outcome, critical audit and durable cleanup reservation share the transaction; `evidenceUploadService.test.ts` |
| Maintenance clean / infection / failure | `evidence.maintenance.clean` / `.infected` / `.scan_failed` | Each conditional decision and audit are a single data-modifying SQL statement. Infection and cleanup reservation additionally share the outer transaction. Audit failure cannot leave a successful unaudited scan; inability to persist the fail-closed outcome stops the batch. Native audit-trigger regressions and `scanPending.test.ts` |
| Independent review / replacement | `evidence.review.decided` / `evidence.version.replaced` | Existing review/decision history, evidence revision and audit commit together in `documentReview/service.ts`; `documentReview.integration.test.ts` |
| Private download | `evidence.download.release_ready`, requesting user and organization, evidence ID, byte count | Existing authentication, permission, entity/party, scan/review and protected-document gates run first. Missing bytes produce no ready event. Audit insertion must succeed before bytes leave the service; unit/native failure tests prove this. This is release readiness, not receipt confirmation |
| Abandoned upload / stalled scan | `evidence.upload.abandoned`, upload-intent ID, safe expired/scan_failed outcome | Terminalization, audit and cleanup scheduling share the sweep transaction; native rollback/retry case |
| Provider object deletion | `evidence.cleanup.deleted`, cleanup ID and owning organization, safe reason and provider acknowledgement outcome | Provider I/O precedes one atomic cleanup-completion/audit statement. Audit failure leaves processing lease and quota ownership intact. Retry after lease expiry repeats idempotent deletion and records one completion event; native recovery regression |
| Reviewed operator retry | Existing `operations/recovery.ts` critical audits | Current operator assurance, retry mutation and audit share the transaction; accepted operations recovery suites |

Automated decisions use reserved non-human UUID `00000000-0000-4000-8000-000000000002`, never impersonating the uploader. Organization attribution comes from the changed database row. Audit metadata excludes filenames, object keys, provider error messages, file contents, scanner signatures, credentials and document contents; the download event stores only the byte *count*. Existing business audits retain their documented metadata.

## Recovery and limits

PostgreSQL atomicity does not roll back provider deletion. If acknowledgement or audit persistence fails after deletion, durable ownership remains until a later attempt confirms deletion and atomically records completion. The existing five-minute lease, attempt cap, terminal queue, quota accounting and reviewed operator recovery stay in force. A lost claim does not record a successful deletion event. Repeated failures remain visible as terminal work rather than silently releasing quota.

Already-clean evidence is not selected again; a lost conditional maintenance update is not counted as clean. Authentication is evaluated on every download request. A successful read can now fail if its critical access audit cannot persist; this intentionally prevents unrecorded byte release. An audit event is not a guarantee that a browser saved a file. No historical audit backfill is attempted.

The HTTP mutation inventory is enforced by `npm run check:mutation-audits` in CI and release checks. It enumerates 106 POST/PUT/PATCH/DELETE routes, including two computation-only POST actions, and four curated background/GET side-effect boundaries. Seven narrow invitation/upload actions are classified covered; 97 require exact-action review of already-existing implementations. These are review gaps, not a claim that 97 actions lack audit. New/removed/moved/changed-handler routes and missing evidence fail the gate. Handler-body changes and all background jobs are not automatically proved by this inventory; ARC-013 stays open.

## Acceptance and follow-ups

Run the focused `evidenceCleanup.integration.test.ts` suite, then the entire release on the captured candidate commit, then required CI before merge. Seven added native scenarios cover download attribution/failure/scan denial, maintenance attribution/idempotency, clean-audit rollback, infected-audit rollback, failure-audit rollback, abandoned-upload sweep rollback/retry and deletion-audit recovery. Author compilation is not database execution. Existing browser evidence download/review journeys run as part of the full release; no new UI interaction is introduced.

UPL-014 remains IN PROGRESS until that evidence and the matrix are accepted. This bundle targets one whole-row closure after acceptance (171/362, 47.2%) and advances ARC-013/QLT-002 without whole-row credit. Current accepted count remains 170/362 (47.0%).

UPL-010 expiring download links, UPL-013 retention/legal hold/backups, UPL-018 private restore, immutable security retention (SEC-017), hosted operating ownership and external review remain separate. These events do not prove backup erasure, retention compliance, universal application transaction coverage, hosted readiness or Canton integration. No new migration, secret, provider, dependency or deployment service is required.
