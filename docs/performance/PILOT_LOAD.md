# Local pilot capacity evidence

PER-004/QLT-016/OPS-014 candidate; measured runtime results are not yet available on the author host.

| Workload | Real loopback HTTP work | Independent acceptance |
| --- | --- | --- |
| Marketplace |100 scoped first-page reads from1,005 listings |100items/page, cursor, current seller scope and unchanged full count |
| Trade writes |100 POST offer creations against separate listings |100pending offers,100audit events, zero contracts, unchanged physical quantity |
| Trade actions |100 GET /trade-actions reads after write workload |100distinct actionable offer decisions |
| Provenance |100 complete bounded view requests with100 synthetic evidence metadata rows |100evidence entries; incomplete provenance remains explicit; view produces no export audit |
| Trace |100 forward requests over200lots/199edges |200impacted lots and199kg physical leaves with declared exactness |
| Mixed |50additional real offer writes plus50marketplace reads interleaved |150total offers/audits, no contracts and unchanged10,000kg holding |

Each workload uses four concurrent workers and100observations. Timings include request through parsed JSON and have no discarded warm-up samples. Nearest-rank p50/p95/p99 and maximum are recorded; with100samples p99 is the99th ordered observation, not the maximum. Every response must have its expected success status. There are no retries or ignored503/busy/error responses. Client timeout is20seconds; existing API/database/trace deadlines are unchanged. This does not stress acceptance, reservation or settlement races; existing native concurrency suites cover those separately.

The seeded1,005 listings share one10,000kg physical holding; pending offers do not reserve it. Provenance rows are synthetic metadata, not uploaded/scanned file bytes; no file/provider throughput claim. The trace graph is a200-node star, not a maximum-depth or maximum2,000-node capacity claim. These declared data shapes make the result reproducible rather than representative of every customer graph.

Targets are provisional engineering regression thresholds:100samples, concurrency4, p95≤2,000ms and p99≤5,000ms per workload. Passing them establishes only the recorded local baseline. They are not customer service commitments. Hosted combined API/worker/scanner loads, network latency, actual Docker resource allocation, data skew, multi-instance behavior and larger customer volumes still require separate acceptance. Host CPU count/physical memory describe the executing Node host, not Docker's assigned resource limit.

The native harness uses its existing test-specific file/quota overrides; the source inventory describes configurable defaults and ceilings, not a claim that this metadata-only workload measures those upload limits. The separate accepted file stress gate remains required.

The counts-only report `pilot-load-test-results/summary.json` records Git SHA, timestamps, total elapsed time, host platform/architecture/Node/CPU count/memory, fixture volumes, concurrency, sample counts, percentiles, errors and invariant outcomes. It omits URLs, tokens, identities, request/response bodies, SQL and individual samples. Policy ceilings/defaults live in capacity-policy.json and are source-checked by capacityPolicy.test.ts; those values are not benchmark results.

Release and CI invalidate previous evidence before native integration, then require a complete current-commit passing report. Failed/missing workloads, invariant errors, changed targets or exceeded latency budgets fail acceptance; no partial credit. CI uploads the report for30days. Retain it with release evidence before expiry. No production migration, secret/configuration change, endpoint or dependency is added.

For diagnosis only, run the single native suite with the existing disposable runner, then validate its report:

```powershell
cmd.exe /d /c "npm run test:integration:docker --workspace=api -- pilotLoad.integration.test.ts > pilot-load-focused-output.txt 2>&1"
if ($LASTEXITCODE -ne 0) { throw 'Pilot load failed. Send the first failure.' }
npm run check:pilot-load
if ($LASTEXITCODE -ne 0) { throw 'Pilot load report failed validation.' }
```

Full exact-commit release and required CI remain mandatory. If measurements fail, inspect the failing response/latency and resource constraints; do not raise timeouts or thresholds just to turn the report green.
