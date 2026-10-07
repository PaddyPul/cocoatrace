# Bounded trace and recall safety

## Contract

Trace success is a bounded calculation over the selected lots' full connected genealogy (both directions, including co-inputs needed for mass ratios). It is not a product-safety clearance. Small unrelated components remain usable when another component exceeds its limits.

An incomplete analysis returns HTTP 422, `code: TRACE_ANALYSIS_INCOMPLETE` and `analysis: { status: 'incomplete', reason, safetyClearance: false }`. No partial scope, recipients or numerical totals are returned. Reasons distinguish cycle, invalid graph, lot/edge/distribution/seed limits, depth/work/time and PostgreSQL cancellation. Unknown/foreign seeds are rejected before connected analysis. Malformed UUIDs return validation errors.

Successful responses add `analysis: { status: 'complete', workUnits, safetyClearance: false }`. Declared/estimated allocation confidence remains distinct from safety. Existing mass-allocation and full commingled-descendant recall semantics are preserved.

## Hard limits

Policy lives in `api/src/modules/trace/limits.ts`, without user-controlled overrides:

| Bound | Value |
|---|---:|
| Lots / accessible selector records | 2,000 |
| Genealogy edges | 8,000 |
| Distributions | 8,000 |
| Suspect seed inputs | 100 |
| Connected discovery / directed genealogy depth | 128 |
| Calculation / discovery work units | 200,000 |
| Calculation elapsed budget | 250 ms |
| Database discovery/read elapsed budget | 5 seconds |
| Individual PostgreSQL statement timeout | 2 seconds |
| Recall activation checkpoint elapsed budget | 10 seconds |

Read transactions use repeatable-read, read-only snapshots and transaction-local SQL timeout. Rowsets request limit+1 and reject overflow; they never silently truncate. The existing source/destination/distribution indexes are reused. A bounded frontier discovers connectivity before loading lot/edge/distribution details. The selector reads only permitted summaries and never loads network genealogy. More than 2,000 permitted selector records produces an explicit error; pagination/search is follow-up, not silently incomplete data.

Time budgets are checked between queries/work checkpoints; they are not a preemptive network SLA. A currently executing statement can extend a read budget by its SQL timeout, and pool acquisition uses the existing connection timeout. Measure deployed query plans and network behavior before raising limits. Broad API/export pagination remains PER-001/ARC-024.

## Atomic activation

Activation resolves requested batches, verifies source access and completes analysis before creating a notice. Scope and lot holds are written in bulk, with existing holding holds, listing withdrawal, participant/outbox registration and audit in the same transaction. Failure/cancellation rolls back all writes. Existing active recalls/holds remain intact.

**Incomplete analysis does not automatically establish new safety holds.** Operators must isolate suspected material physically and stop trading it through operational controls, escalate to the recall manager and repair/expand the reviewed analysis capacity. Do not treat a failed activation as protection or clearance, and do not bypass limits by changing an error into a success. Existing notice acknowledgement/recovery remains available when genealogy fails.

## Verification and operations

- Pure tests retain quantity-aware results and add cycle, depth, malformed data, size and repeated-convergence budgets.
- Repository tests cover component scoping, limit overflow, SQL cancellation and snapshot rollback/release.
- Native PostgreSQL tests add cyclic activation rollback and unrelated oversized-component isolation with foreign-seed denial.
- Browser fixture verifies incomplete analysis displays an alert without partial allocation/recipient results. Native browser/integration execution is part of `npm run verify:release`.
- Synthetic benchmark: `node --import tsx api/scripts/benchmark-trace.ts`. This does not access a database or seed application data.
- Structured operational logging records the existing request correlation and failure code/reason; no new outbox sender or external recipient message is introduced.
