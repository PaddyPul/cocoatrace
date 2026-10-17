# Capacity budgets and provisional pilot targets

The [machine-readable policy](capacity-policy.json) records source-checked limits. It is an engineering inventory, not a measured deployment capacity, customer SLA, throughput promise or proof that a hosted environment is ready. `api/src/testing/capacityPolicy.test.ts` parses source syntax with TypeScript; it never initializes environment configuration, database, scanner or storage clients. Changes to a bound constant/default/ceiling must update this policy explicitly.

| Boundary                  | Current default or hard cap                                     | Meaning                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database pool             | Default 10 connections; configurable maximum 100                | Per API process. Deployment replicas multiply demand. PostgreSQL capacity and operator headroom must be sized separately.                                                                         |
| Pool timing               | Acquire 5 seconds; idle 30 seconds                              | Connection acquisition and idle cleanup, not an end-to-end query SLA.                                                                                                                             |
| Catalog pages             | Default 50; maximum 100 records                                 | Server-side paging. Linked SQL results are capped at 5,000 rows.                                                                                                                                  |
| Catalog timing            | SQL statement 2 seconds; elapsed read 5 seconds                 | Elapsed guard is checked between queries; it is not a hard wall-clock cancellation of an entire HTTP request.                                                                                     |
| Evidence size             | Default 10 MiB; configurable maximum 100 MiB                    | Per file. Scanner, parser, adapter and response copies affect RSS beyond the raw file size.                                                                                                       |
| Evidence quota            | Default 1 GiB per organization                                  | Configured quota, with no configuration upper ceiling. Reserved and persisted usage are checked by the upload workflow. This is not a disk allocation or a global bucket quota.                   |
| Transfer admission        | 4 global; 2 per organization                                    | Shared uploads/downloads within one API process. This is not distributed cluster admission. Busy responses preserve bounded admission; operators must not interpret them as successful transfers. |
| Storage timing            | Default 15 seconds; maximum 120 seconds                         | Per operation timeout configuration. No remote provider availability guarantee.                                                                                                                   |
| Scanner timing            | Default 15 seconds; maximum 120 seconds                         | Per scanner attempt; retries default 2, configurable maximum 5 (up to 3 and 6 attempts respectively).                                                                                             |
| Scanner buffers           | 8 KiB response; 64 KiB frames                                   | Protocol buffer bounds, not total scanner-process memory.                                                                                                                                         |
| Trace graph               | 2,000 lots; 8,000 edges; 8,000 distributions; 100 seeds         | Per operation. Larger graphs fail explicitly as incomplete and establish no safety clearance.                                                                                                     |
| Trace work                | Depth 128; 200,000 work units; calculation 250 ms               | In-process traversal bounds.                                                                                                                                                                      |
| Trace database/activation | Database 5 seconds; activation 10 seconds; statements 2 seconds | Existing operation budgets; not a guarantee that every admissible graph completes.                                                                                                                |

## Local regression target

A declared local pilot regression workload uses **at least 100 samples at concurrency 4**, with **p95 ≤ 2,000 ms and p99 ≤ 5,000 ms**. These thresholds are provisional engineering targets, not measured results or a customer SLA. Report the exact workload, commit, host and dependency conditions alongside observed latency, failure counts and result completeness. A pass on one workstation does not establish hosted capacity or multi-replica scaling.

Keep timing/performance evidence separate from authorization and safety assertions: an empty error response is not an empty workspace; a timeout is not a safety clearance. No production timeout, quota, pool size or admission cap is changed by this inventory. Before pilot, operators still need deployment-specific database connection allocation, storage lifecycle/capacity, scanner health, resource monitoring, representative data and measured load evidence.

## Source and verification

- [Configuration validation](../../api/src/config/env.ts): numeric defaults and allowable maxima.
- [Database pool](../../api/src/db.ts): connection timing.
- [Catalog boundary](../../api/src/modules/catalog/paging.ts): page and read guards.
- [Evidence admission](../../api/src/modules/security/evidenceConcurrency.ts): shared process limits.
- [Upload workflow](../../api/src/services/evidenceUploadService.ts): configured file/quota enforcement.
- [Scanner](../../api/src/services/evidenceMalwareScanner.ts): bounded protocol and retries.
- [Trace limits](../../api/src/modules/trace/limits.ts): graph and work budgets.
- [Capacity policy check](../../api/src/testing/capacityPolicy.test.ts): source drift, malformed binding, unsafe path, target classification and arithmetic parsing.
