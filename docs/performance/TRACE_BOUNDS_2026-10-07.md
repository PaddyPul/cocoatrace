# Trace calculation rehearsal — 2026-10-07

Fixture: 2,000 material lots, 1,999 fan-out edges, 8,000 distributions and distinct recipient organizations. Quantities are physically consistent. Ten in-memory runs on the author container produced median **13.56 ms**, maximum **35.80 ms**, against a 250 ms calculation budget.

Reproduce from repository root:

```powershell
node --import tsx api/scripts/benchmark-trace.ts
```

The benchmark records counts, median and maximum. It fails if analysis is incomplete or the lot count differs. Results are machine-specific, not a hosted throughput/latency SLA. The adversarial unit suite independently tests over-cap graphs, deep chains, cycles and repeated convergent allocations; safe refusal is expected outside the supported envelope.

PostgreSQL query-plan/capacity rehearsal, hosted concurrent request measurements, heap/CPU observations and API-wide pagination remain PER-001/PER-003/PER-004 follow-ups. Native PostgreSQL correctness is pending founder release acceptance. No performance percentage or pilot readiness claim follows from this synthetic result alone.
