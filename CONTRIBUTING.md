# Contributing to CocoaTrace

CocoaTrace handles commercial, identity, evidence and traceability records. Changes must optimize for correctness, explainability and safe iteration—not only a successful UI demonstration.

## Start here

1. Read [`docs/NORTH_STAR.md`](./docs/NORTH_STAR.md).
2. Select a numbered item from [`docs/DELIVERY_BACKLOG.md`](./docs/DELIVERY_BACKLOG.md).
3. Read [`docs/ARCHITECTURE_MODERNIZATION.md`](./docs/ARCHITECTURE_MODERNIZATION.md) for the target boundary.
4. Confirm the item’s acceptance criteria and dependencies before editing code.

Do not start material untracked work. If the work is missing, add a backlog item or issue first.

## Branches and commits

- Branch from current `main` after CI is green.
- Use a short-lived branch such as `fix/SEC-002-provenance-access` or `feat/IDN-009-password-reset`.
- Keep commits reviewable and name the backlog ID where practical.
- Do not combine unrelated cleanup with a safety-critical fix.
- Never force-push or rewrite shared release history without coordination.

## Required change shape

Prefer this dependency direction:

```text
route/controller -> policy/application service -> domain -> repository/ports -> infrastructure adapter
```

- Controllers translate HTTP; they do not own business workflows.
- Policies decide resource access.
- Services orchestrate transactions and domain operations.
- Repositories own SQL and mapping.
- External providers implement small interfaces.
- React pages compose feature components and hooks; they do not become multi-resource administration files.

## Coding expectations

- Validate all external input at the boundary.
- Use `unknown` and parsing instead of new `any`.
- Keep state transitions explicit and fail closed.
- Avoid raw status strings scattered through handlers.
- Do not compress multiple mutations into one line.
- Do not swallow errors or convert failed requests into misleading empty data.
- Do not return raw database rows, secret values or internal storage paths.
- Keep environment access in the typed configuration module.
- Add a new migration; never edit a migration already applied outside disposable development databases.
- Critical business writes, audit data and outbox events must share the appropriate transaction.
- Every fixed defect receives a regression test.

The size guidance in the architecture document is a review trigger, not permission to split cohesive code arbitrarily.

## Security review questions

Every change must answer:

1. Which actor and organization can perform this operation?
2. Which records can they read or mutate?
3. What happens if an unrelated tenant guesses the identifier?
4. Can the request be retried safely?
5. Can two requests race and violate a quantity or state invariant?
6. Does the response expose personal, commercial or storage metadata?
7. What is audited and what happens if audit/outbox recording fails?
8. Does the change affect retention, notification, recall or document release?

## Tests

Run the applicable checks before opening a pull request:

```bash
npm test --workspace=api
npm run test:integration:docker
npm run typecheck --workspace=api
npm run build --workspace=api
npm run build --workspace=web
```

The integration command creates a disposable PostgreSQL 16 database on port
`15434`, installs the frozen schema baseline at migration `010`, and asks Knex
to apply every later migration before executing the API suite. The reset guard
refuses any database whose name does not contain a standalone `test` segment.
Never point it at development, staging, or production data.

The baseline is intentional. Historical migration `001` imports the mutable
`db/schema.sql`, while migration `009` then adds fields already present in that
schema, so the historical chain cannot reliably reconstruct an empty database.
This integration suite verifies the current baseline plus all new forward
migrations; it does **not** satisfy QLT-005's empty-database and previous-release
migration rehearsal. Do not add a new migration to the frozen baseline list.

To use a dedicated PostgreSQL service that is already running:

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/cocoatrace_test npm run test:integration
```

As the backlog adds them, also run lint and Playwright suites.

Test the risk, not just the successful path. Authorization changes require an allowed case and at least one unrelated-tenant denial. Quantity/state changes require invalid-transition and concurrency coverage.

## Database changes

- Use a forward-only numbered migration.
- Test it on an empty database and the latest previous schema.
- Describe locks, backfill, expected duration and rollback/compensation.
- Avoid destructive changes until data has been migrated and the old code path has been retired.
- Add constraints for invariants that must survive application defects.

## Pull requests

Use the pull-request template. A reviewer should be able to identify:

- backlog item and customer/safety outcome;
- architecture boundary affected;
- authorization and data impact;
- migration and rollback plan;
- tests and staging evidence; and
- follow-up work explicitly returned to the backlog.

## Updating the backlog

An item may be checked only when its outcome and the backlog definition of done are satisfied. If partially implemented, leave it unchecked and write `IN PROGRESS` with the branch or issue reference.

After completion:

1. check the item;
2. update the current execution queue;
3. update affected phase gates and risks;
4. add newly discovered follow-ups; and
5. update `Last triaged` if priority or scope changed.

## Architecture decisions

Create an ADR from [`docs/adr/000-template.md`](./docs/adr/000-template.md) when a decision changes platform boundaries, security, data ownership, provider choice, deployment, legal meaning or long-term operating cost.

## Definition of done

A change is done when:

- acceptance behavior is demonstrated;
- authorization and failure behavior are tested;
- migrations and rollback are safe;
- logs/metrics are useful and redact secrets;
- documentation and runbooks are current;
- CI passes;
- staging verification passes for release-bound work; and
- the backlog accurately represents what remains.
