# Evidence resource-safety gaps

**Scope:** Remaining evidence upload, scan, storage and download resource controls after the initial private-storage and malware-scanning implementation.  
**Status:** Open engineering and deployment risks. This document does not close PER-003, UPL-010, UPL-015, OPS-006 or hosted capacity acceptance.

## Current safety boundary

Evidence uploads are limited by declared file size and organization storage quota. Upload intents are signed, expire, reserve quota and authorize a specific linked record. Files enter private quarantine, are malware-scanned and must match the declared PDF, JPEG or PNG type before promotion. Downloads require authorization and a persisted clean scan result.

The current candidate also introduces finite storage deadlines, bounded JSON/file reads and a non-waiting transfer cap of four active transfers globally and two per organization **inside one API process**. Those are useful prerequisites, but they do not coordinate replicas and have not yet supplied hosted capacity evidence; the candidate adds a disposable 10 MiB parallel-transfer RSS gate. They do not close PER-003. The overall controls therefore do not yet establish a safe concurrency or memory envelope for a deployed API.

## Remaining exploitable resource gaps

### Buffered upload and scanner amplification

The upload route materializes the complete request as an Express `Buffer` after signed pre-body validation and process/tenant admission, but before the intent is claimed. Admitted concurrent replays can still consume bounded body memory before all but one request are rejected. Object-store writes and object promotion can create additional buffers. Request-rate budgets limit counts over time but do not prevent a damaging simultaneous burst.

Required closure:

- validate and atomically claim the signed intent before accepting its body;
- require the declared content length and reject unsupported content encodings before body parsing;
- enforce non-waiting per-process and shared per-organization/deployment admission limits;
- retain the accepted scanner backpressure/deadline controls during future streaming changes;
- avoid object-store copies that download and re-upload the complete quarantine object.

### Buffered downloads and storage deadlines

Authorized downloads currently read an entire local or S3 object into API memory before responding. Repeated parallel downloads by an otherwise authorized tenant can exhaust process memory and storage bandwidth. Every provider operation needs a finite deadline, but a per-object timeout and size cap alone do not solve concurrent memory amplification.

Required closure:

- stream object bytes through a bounded pipeline and stop the provider read when the client disconnects;
- enforce global and tenant download concurrency independently of ordinary request-rate limits;
- verify provider object length against persisted evidence metadata before and during transfer;
- test stalled, truncated, oversized and client-aborted provider streams.

### Provider preflight and authoritative revalidation

The candidate moves metadata-only local stat/S3 HEAD checks outside payment, document and discrepancy write transactions. A short scoped read commits before provider I/O; the mutation locks and revalidates current party authority, proof metadata, clean/review state and retained cleanup ownership. Request-local probes have a finite deadline and at most four concurrent HEADs; this is not a deployment-wide metadata admission limit. Changed proof fails conservatively; idempotent payment replay does not depend on later provider availability.

Boolean HEAD cannot prevent an out-of-band provider mutation after preflight. Provider version binding and inventory reconciliation remain open. The recall-security candidate applies the same scoped preflight and locked fingerprint revalidation to notice resolution. Rejected, infected, unavailable and cleanup-ineligible proof cannot authorize closure. Public evidence read-path availability consistency remains a follow-up.

### Scanner maintenance and durable cleanup

Accepted bounded scanner maintenance selects at most 50 records by default (maximum 100), processes sequentially under an exclusive database session job lock, and uses scanner socket backpressure with absolute deadlines. Accepted migration 035 tracks owned quarantine/final keys before writes, retains quota charges for unfinished deletion, and supports one-at-a-time leased cleanup with backoff and terminal dead states. Infected metadata and cleanup work commit together.

Remaining: automatic scheduling and alerts, operator dead-letter recovery, historical object inventory, and crash/recovery measurement. Parallel scanning would require per-record leases. Never infer a historical object provider or bulk-delete unmatched storage keys.

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
