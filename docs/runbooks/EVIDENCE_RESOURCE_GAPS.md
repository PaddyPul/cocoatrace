# Evidence resource-safety gaps

**Scope:** Remaining evidence upload, scan, storage and download resource controls after the initial private-storage and malware-scanning implementation.  
**Status:** Open engineering and deployment risks. This document does not close PER-003, UPL-010, UPL-015, OPS-006 or hosted capacity acceptance.

## Current safety boundary

Evidence uploads are limited by declared file size and organization storage quota. Upload intents are signed, expire, reserve quota and authorize a specific linked record. Files enter private quarantine, are malware-scanned and must match the declared PDF, JPEG or PNG type before promotion. Downloads require authorization and a persisted clean scan result.

The current candidate also introduces finite storage deadlines, bounded JSON/file reads and a non-waiting transfer cap of four active transfers globally and two per organization **inside one API process**. Those are useful prerequisites, but they do not coordinate replicas and have not passed the required maximum-file RSS stress test. They do not close PER-003. The overall controls therefore do not yet establish a safe concurrency or memory envelope for a deployed API.

## Remaining exploitable resource gaps

### Buffered upload and scanner amplification

The upload route materializes the complete request as an Express `Buffer` before the intent is claimed. Concurrent replays of one valid signed URL can therefore consume the configured maximum body memory before all but one request are rejected. Scanner framing, object-store writes and object promotion can create additional full-file buffers. Request-rate budgets limit counts over time but do not prevent a damaging simultaneous burst.

Required closure:

- validate and atomically claim the signed intent before accepting its body;
- require the declared content length and reject unsupported content encodings before body parsing;
- enforce non-waiting per-process and shared per-organization/deployment admission limits;
- write scanner frames with socket backpressure instead of concatenating another whole-file buffer;
- avoid object-store copies that download and re-upload the complete quarantine object.

### Buffered downloads and storage deadlines

Authorized downloads currently read an entire local or S3 object into API memory before responding. Repeated parallel downloads by an otherwise authorized tenant can exhaust process memory and storage bandwidth. Every provider operation needs a finite deadline, but a per-object timeout and size cap alone do not solve concurrent memory amplification.

Required closure:

- stream object bytes through a bounded pipeline and stop the provider read when the client disconnects;
- enforce global and tenant download concurrency independently of ordinary request-rate limits;
- verify provider object length against persisted evidence metadata before and during transfer;
- test stalled, truncated, oversized and client-aborted provider streams.

### Provider I/O inside trade transactions

Payment submission and confirmation, document presentation, and delivery-discrepancy creation currently call `storage.get()` merely to prove that evidence bytes exist. These calls download the complete object while database transactions and row locks are open. A slow or maliciously repeated provider read can therefore consume both API memory and the PostgreSQL connection pool.

Replace full reads with a bounded `HEAD`/existence operation. Provider I/O should occur outside locked database transactions, followed by a transactional revalidation of the evidence metadata and trade state. Alternatively, use a persisted object-availability state maintained by a separate reconciliation process. The design must specify its failure and time-of-check/time-of-use behavior.

### Scanner maintenance job

The pending-evidence scanner selects the complete eligible history, has no durable claim lease and buffers each object. Two invocations can scan the same evidence, a very large legacy object is not constrained by the current upload limit, and an interrupted job has no explicit stale-lease recovery.

Required closure:

- select a fixed batch size;
- claim each record with an expiring lease before provider I/O;
- use bounded worker concurrency and retry backoff;
- reject or escalate legacy objects beyond the reviewed scan-size policy;
- prove that two workers do not scan one record concurrently and that an expired lease is recoverable.

### Cleanup, quota and orphan objects

Stale-intent cleanup currently runs from the upload-intent request path and may issue a large `Promise.all` deletion fan-out. Deletion failures are ignored. Once an intent becomes rejected, infected or scan-failed, its declared bytes no longer reserve organization quota even if quarantine deletion failed. A failed final-object deletion after database failure can also leave an object key without durable retry state.

Required closure:

- persist cleanup work with object key, organization, byte count, reason, attempts and next-attempt time;
- count cleanup-pending bytes against the organization quota until deletion is confirmed;
- process cleanup through bounded leases, retry/backoff and an operator-visible terminal state;
- remove storage deletion fan-out from the upload-intent request path;
- reconcile database cleanup records against bucket inventory without bulk deletion.

### Process-only limits and horizontal scaling

A process semaphore protects one Node.js instance but does not enforce organization fairness or deployment capacity across replicas. A database-backed or equivalent shared expiring lease is required for tenant/deployment admission. A local non-waiting cap is still needed to protect each process before allocating a request body or provider stream.

Limits must be explicit configuration with safe staging and production validation. Saturation should fail before body parsing with a stable `429` or `503`, a `Retry-After` value and no scanner or storage side effect.

## Required acceptance evidence

PER-003 remains open until all of the following are captured:

1. A parallel maximum-size upload and download stress test runs against the production storage/scanner adapters or faithful isolated substitutes.
2. The API process has a declared RSS budget. The test samples peak RSS and fails when that budget is exceeded; passing ordinary unit tests is insufficient.
3. Same-tenant and deployment-wide concurrency tests prove admission caps, fair rejection and expired-lease recovery across at least two worker processes.
4. Slow scanner, slow storage, truncated response, client disconnect and process-crash cases release permits and leave recoverable durable state.
5. Failed object deletion remains quota-accounted and is retried without an unbounded fan-out.
6. Scanner maintenance workers demonstrate bounded batches, no duplicate concurrent scan and stale-lease recovery.
7. Request logs and retained test artifacts contain no signed upload capability or other query token.

Hosted load measurements, alert thresholds, container memory limits and named incident ownership remain separate deployment evidence. None should be inferred from a green local test suite.
