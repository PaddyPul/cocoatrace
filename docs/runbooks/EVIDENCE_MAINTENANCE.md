# Pending evidence scan maintenance

Use the pending-evidence scanner to retry evidence records whose malware status is
`legacy_unscanned` or `scan_failed`.

## Run one bounded batch

From the repository root:

```bash
npm run evidence:scan-pending --workspace=api
```

The default batch contains at most 50 records. To select a smaller or larger bounded batch, set
`EVIDENCE_SCAN_BATCH_SIZE` to an integer from 1 through 100 before running the command. Values
outside that range fail without selecting evidence.

Only one scanner job may run against a database at a time. A second invocation exits successfully
with a `busy` summary and performs no scanner or object-storage work. Rerun it after the active job
finishes.

## Read the summary

- `selected`: records selected in this batch;
- `clean`: records verified clean;
- `infected`: records persisted as infected;
- `failed`: processing or cleanup incidents requiring attention;
- `busy`: another database session owns the maintenance-job lock.

The command returns a non-zero exit code when `failed` is greater than zero. Run another bounded
batch after investigating scanner, storage, or missing-object failures. Failed records receive a new
scan timestamp, so previously unscanned records are considered before immediate retries.

For infected evidence, the database security decision is recorded before object deletion. A failed
deletion therefore leaves the record marked `infected` and increments both `infected` and `failed`.
Treat that case as pending object cleanup; do not change the record back to `scan_failed`.

## Current operational boundary

The scanner uses a PostgreSQL session advisory lock. PostgreSQL releases that lock if the worker
process or database session terminates. This prevents concurrent jobs against the same database; it
is not a durable per-record lease or a cleanup queue. The job reads and scans one bounded file at a
time. Continue to track cleanup retries, quota accounting, multi-node transfer admission and RSS
stress acceptance in `EVIDENCE_RESOURCE_GAPS.md`.

Logs contain record identifiers and safe error categories only. They must not contain file bytes,
malware signatures, provider error messages, signed capabilities, or local file paths.
