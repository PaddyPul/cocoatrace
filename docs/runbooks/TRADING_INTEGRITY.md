# Trading integrity v1

Backlog: ARC-005, ARC-012, TRD-001–TRD-009.

Offer acceptance now creates the agreement, payment schedule, fee record and
shipment in the same transaction as the inventory commitment and audit events.
An expired offer, inactive listing, unavailable holding or foreign organization
cannot be accepted. A repeated acceptance cannot create another agreement.

## Quantity rules

- One holding can have several listings, but their **combined active quantity**
  plus pending custody transfers must fit its available quantity.
- Acceptance commits only the accepted quantity. A partial acceptance creates a
  committed slice and leaves the residual available. Incompatible listings are
  resized or deactivated; incompatible pending offers are rejected. The unsold
  advertised portion continues as a new listing on the residual holding, at the
  original listing terms. Accepted listings remain deal history. Previously
  unadvertised inventory is not automatically published.
- A requested custody transfer reserves quantity until its state changes.
  Committed inventory cannot be transferred or split. A holding with a pending
  transfer cannot be split.
- Transferred source holdings retain their original quantity for historical
  traceability. They are excluded from live stock allocation totals; do not
  change them to zero to make an inventory report balance.
- Quantities use three decimal places (integer grams for application allocation
  arithmetic). Database constraints reject invalid quantities, illegal states
  and duplicate agreements for one offer.

The trading module owns offer acceptance and fulfillment creation. The shared
transaction helper also writes audits before commit, so audit failure rolls
back the trade. Competing listing, allocation, transfer, split and marketplace
publication paths participate in inventory locking and budget checks.

## Automated verification

Authoring validation: API and web builds passed, 151 API unit tests passed,
and migration integrity verification passed. A supplemental WASM PostgreSQL run
applied every forward migration through 020 and passed 12 functional trading
tests; nine concurrency tests were skipped because its single backend cannot
validate native transaction races. The canonical integration suite contains
51 tests (30 existing plus 21 trading). Native Docker suites and GitHub CI remain
release gates; this report does not mark them passed.

From the repository root, with Docker Desktop running:

```powershell
npm ci
npm run migrations:verify --workspace=api
npm run build --workspace=api
npm run test --workspace=api
npm run test:migrations:docker
npm run test:integration:docker
npm run typecheck:browser
npm run test:browser:docker
```

The integration suite includes competing acceptance, listing, holding and
transfer requests; partial decimal allocations; rejected expired/inactive and
foreign-tenant actions; downstream failure rollback; direct database constraint
checks; and independent reconciliation. Use native PostgreSQL in Docker/CI for
the concurrency gate. A successful single-client or WASM PostgreSQL check does
not establish concurrency correctness.

## Read-only reconciliation

To inspect the normal local application database through its configured API
container:

```powershell
docker compose -f docker-compose.yml -f docker-compose.email-test.yml exec api npm run trade:reconcile
```

Alternatively, run `npm run trade:reconcile` on a host configured with the
intended application's database and environment settings. The command reads a
repeatable, read-only snapshot and prints JSON with `ok`, `issueCount` and issue
codes/resource identifiers. Exit zero means no supported invariant failed;
exit one means issues or a query failure. It does not repair, delete, unlock,
seed or settle records.

Checks compare source quantity with live holdings; listings and requested
transfers with holding capacity/ownership; accepted offers with exactly one
matching agreement; committed slices with open agreements; fulfillment records;
and settlement/delivery/distribution consistency. A clean report does not prove
real-world stock exists, funds arrived or shipping documents are genuine.

For any finding, preserve the output, identify the affected records and review
their history before correcting them through a reviewed process. Historical
demo records may expose inconsistencies that were previously accepted. Do not
reset a customer database or automatically rewrite quantities to clear a report.

## Migration and release handling

Migration 020 checks existing rows before installing quantity/state constraints
and the unique offer-to-agreement constraint. It reports invalid records and
refuses the migration rather than silently rewriting trade history. Existing
duplicate agreements or invalid quantities require a reviewed correction plan.
The normal migration runner rolls back a failed invocation.

Run migrations only after a backup/restore point on real staging or production.
Do not delete ledger entries, alter frozen migration hashes, use an automatic
`down`, or remove volumes. A code rollback alone does not reverse schema changes.
Keep this release pending until native migration, integration, container and
browser CI checks pass. Environment isolation, real deployment rehearsals and
production recovery remain separate backlog gates.
