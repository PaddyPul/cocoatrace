# Evidence object cleanup

Evidence provider deletions are tracked in `evidence_object_cleanup`. A failed provider call must
never make an object disappear from quota accounting or operational visibility.

## Run a bounded cleanup batch

From the repository root:

```bash
npm run evidence:cleanup --workspace=api
```

The job first transitions a bounded set of expired or stalled upload intents and their registered
objects to durable cleanup work. It then claims at most 50 due objects and deletes them sequentially.
Set `EVIDENCE_CLEANUP_BATCH_SIZE` to an integer from 1 through 100 to change that batch limit.

Claims use database-time leases. A crashed worker's claim becomes eligible again after five minutes.
Provider failures use capped exponential backoff with jitter. After eight claims, the object enters
`dead`; dead objects remain charged to the owning organization and require operator review.

## Interpret the summary

- `sweptIntents`: registered objects queued while stale upload intents were terminalized;
- `selected`: cleanup objects claimed by this run;
- `deleted`: provider deletion succeeded and the token-fenced database update recorded `done`;
- `retried`: provider deletion failed and was returned to `pending` with backoff;
- `dead`: unsafe or repeatedly failing work moved to operator review;
- `lostClaims`: another claim state won before completion; the object remains quota-accounted.

The command exits non-zero when the run creates retry, dead, or lost-claim work.

## Safety boundaries

The worker deletes only server-generated `quarantine/<environment>/<uuid>` or
`evidence/<environment>/<uuid>` keys whose recorded provider matches the active provider. It refuses
to delete a key referenced by live evidence unless the cleanup reason and evidence record both say
malware was detected. `retained` objects are never selected.

Deletion is idempotent, but quota is released only after the claim token still matches and the
ledger reaches `done`. Logs contain cleanup identifiers and safe outcome categories, not object
keys, provider error messages, file paths, signed capabilities, malware signatures, or file bytes.

Historical objects that existed before the cleanup ledger require a separately reviewed inventory.
Do not fabricate ownership or provider information to backfill them. Until reconciled, legacy active
intent reservations remain part of quota accounting.
