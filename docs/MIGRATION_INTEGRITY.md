# Migration integrity and upgrade validation

Knex records migration **file names**, not file contents. Removing, renaming or
silently editing an applied migration can therefore make an existing database
unupgradable or make a clean database differ from an upgraded one.

## Frozen baseline

`001_initial_schema.ts` historically reads `db/schema.sql`. That design made the
first migration depend on a mutable file. Reconstructing the exact SQL seen by
every existing database is not possible, and renaming `001_initial_schema.ts`
would conflict with the names already stored in `knex_migrations`.

The safe transition is forward-only:

- `001_initial_schema.ts` keeps its existing name and implementation;
- the current `db/schema.sql` is now the frozen clean-install baseline;
- `api/migrations.manifest.json` pins the SHA-256 of the baseline and every
  historical migration from `001` through `015` (hashes canonicalize CRLF to
  LF so Windows and Linux checkouts produce the same digest);
- all future schema changes use a new migration and register that new file in
  the manifest; and
- neither the baseline nor a registered migration is edited to fix an upgrade.

This does not claim that the manifest proves what an older deployment executed.
It establishes a verifiable integrity boundary from this repository version
forward without changing any migration name already recorded by Knex.

## Adding a migration

1. Add the next forward-only migration under `api/src/migrations/`. Do not
   rename either of the two existing `002_*` migrations.
2. Calculate its digest:

   ```bash
   node -e "const fs=require('fs'),c=require('crypto');const p=process.argv[1],s=fs.readFileSync(p,'utf8').replaceAll('\\r\\n','\\n');console.log(c.createHash('sha256').update(s).digest('hex'))" api/src/migrations/016_description.ts
   ```

3. Append its repository-relative path and lowercase digest to
   `api/migrations.manifest.json` in lexical file-name order.
4. Run `npm run migrations:verify --workspace=api` and the empty-database and
   upgrade validations below.

Changing a digest for an already registered file is not an acceptable fix. Add
a compensating migration instead. If a historical file genuinely differs from
the manifest, stop the release and recover the reviewed version from source
control before running Knex.

## Current baseline validation

Run the integrity guard and the disposable PostgreSQL integration suite:

```bash
npm run migrations:verify --workspace=api
npm run test:integration:docker
```

The current integration harness loads the frozen `db/schema.sql` baseline and
then exercises the API against real PostgreSQL. It does **not** yet prove an
empty database can execute migrations `001` through the latest migration, nor
does it prove an older deployed schema can be upgraded. Those two rehearsals
remain tracked by `QLT-005` and must not be reported as complete merely because
the manifest and API integration suite pass.

## Upgrade validation

Never test an upgrade first on the only copy of staging or production data.

1. Take a backup or snapshot and restore it into an isolated upgrade-test
   database.
2. Record the applied names before deployment:

   ```sql
   SELECT id, name, batch, migration_time
   FROM knex_migrations
   ORDER BY id;
   ```

3. Confirm every recorded name still exists in `api/src/migrations/`, then run:

   ```bash
   npm run migrations:verify --workspace=api
   npm run db:migrate --workspace=api
   ```

4. Run application smoke tests and inspect the new `knex_migrations` rows.
5. Repeat the migration command; it must report `Already up to date`.
6. Promote the same reviewed artifact only after both clean-install and cloned
   upgrade validation pass.

The manifest protects repository inputs. Backup, restore, migration locking,
schema compatibility and application smoke tests remain separate operational
release controls.
