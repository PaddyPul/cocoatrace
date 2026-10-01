# Integration database baseline

`010_schema.sql` is a frozen snapshot of the schema represented by migrations
`001` through `010`. The integration harness loads that snapshot, records those
historical filenames in Knex's migration table, and then runs every migration
with a filename after `010_live_traceability_wiring.ts`.

This compatibility baseline is necessary because the historical chain is not
replayable from zero: migration `001_initial_schema.ts` reads the mutable
`db/schema.sql`, which already contains changes that migration `009` attempts to
add again.

Rules:

- Do not edit `010_schema.sql` for ordinary schema changes.
- Do not add new migrations to `INTEGRATION_BASELINE_MIGRATIONS`.
- Append a new numbered migration; the harness will execute it after the frozen
  baseline and fail CI if it cannot be applied.
- Keep QLT-005 open until an empty-database and previous-release migration
  rehearsal is implemented independently of this compatibility baseline.

