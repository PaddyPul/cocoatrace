> Historical plan, superseded 2026-10-06. Do not use these instructions for deployment. See ../../BETTERTRADE_PILOT_PLAN.md and the current document of the same name.

# Architecture modernization plan

**Status:** Approved direction; incremental migration required
**Related backlog:** `ARC-*`, `QLT-*`, `SEC-*` and `DAT-*` in [`DELIVERY_BACKLOG.md`](./DELIVERY_BACKLOG.md)

## Purpose

This document defines how CocoaTrace moves from a fast-moving passion project to a codebase that a professional engineering team can safely inherit. It is not a proposal for a rewrite. Existing working flows should be protected with tests and migrated one module at a time.

## Current baseline and observed smells

The 2026-09-29 review found:

- `web/src/pages/DataPages.tsx` contains 722 lines and several unrelated resource pages.
- `api/src/controllers/publicProductController.ts` contains 400 lines and combines public presentation, QR generation, profile management and recall workflows.
- `api/src/controllers/contractController.ts` performs 47 direct database calls.
- The controllers collectively contain more than 2,200 lines and regularly combine HTTP handling, authorization, SQL, transactions, domain policy and audit operations.
- The TypeScript source contains more than 200 explicit `any` usages.
- Several files contain extremely long, compressed lines that combine multiple state changes.
- Provenance pack construction is duplicated between read and export paths.
- Authorization rules are repeated and sometimes interpret ordinary read permissions as global access.
- Environment parsing is distributed across application modules and scripts.
- Status values and transitions are represented as uncoordinated strings.
- Audit writes often happen after the business transaction and audit failure is swallowed.
- The frontend uses one central API file for every feature.
- Some dashboards silently convert failed API calls into empty datasets.
- There is no ESLint/formatter gate, OpenAPI contract, browser E2E suite, database integration suite, CODEOWNERS file or documented contribution process.

These are maintainability and correctness risks, not cosmetic objections.

## Architectural principles

### Single responsibility

- Routes declare HTTP paths and middleware.
- Controllers translate HTTP input/output only.
- Application services orchestrate use cases and transactions.
- Domain modules enforce state transitions and invariants.
- Policy objects decide whether an actor can perform an action on a resource.
- Repositories/query modules own SQL and database mapping.
- Adapters integrate storage, email, AI and other external services.

### Open/closed

Commodity-specific rules, storage providers and notification channels should be added behind interfaces rather than through expanding conditionals in controllers.

### Liskov substitution

Infrastructure adapters must honour explicit contracts. A local storage adapter and an object-storage adapter, for example, should expose the same behavior and security semantics expected by the evidence service.

### Interface segregation

Prefer small ports such as `EvidenceObjectStore`, `EmailSender`, `MalwareScanner` and `PaymentReferenceVerifier` over a general utility or provider object.

### Dependency inversion

Domain and application services depend on interfaces. Express, PostgreSQL, object storage and email providers remain at the outside of the system.

## Target backend structure

```text
api/src/
  app.ts
  server.ts
  config/
    env.ts
    index.ts
  platform/
    auth/
    db/
    errors/
    http/
    logging/
    observability/
    storage/
    email/
    jobs/
  modules/
    identity/
      domain.ts
      service.ts
      repository.ts
      policy.ts
      schemas.ts
      routes.ts
      controller.ts
    organizations/
    catalog/
    sourcing/
    trading/
    payments/
    logistics/
    evidence/
    traceability/
    recalls/
  shared/
    domain/
    types/
    validation/
  workers/
  migrations/
```

Each module owns its language and state. Cross-module operations are expressed as application use cases or domain events rather than controllers reaching into unrelated tables.

## Target frontend structure

```text
web/src/
  app/
    router/
    providers/
    layout/
  features/
    onboarding/
    sourcing/
    supply/
    offers/
    deals/
    payments/
    logistics/
    evidence/
    traceability/
    recalls/
    administration/
  entities/
    organization/
    batch/
    listing/
    contract/
    shipment/
  shared/
    api/
    components/
    forms/
    hooks/
    types/
    utils/
  routes/
```

A feature may contain its page, components, API client, hooks and tests. Shared code must be genuinely cross-feature rather than a dumping ground.

## Required request flow

```text
HTTP route
  -> authentication
  -> validated input
  -> controller
  -> authorization policy
  -> application service
  -> domain rules/state machine
  -> repository transaction
  -> audit/outbox event
  -> response mapper
```

Business rules must not depend on whether a request came from the web UI, an API client or a future worker.

## Core module boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| Identity | login, sessions, MFA, verification, resets, invitations | organization verification policy |
| Organizations | membership, organization application and status | authentication credentials |
| Catalog | farms, plots, source batches, holdings, profiles | offers and settlement |
| Sourcing | buyer requirements and match criteria | marketplace inventory mutation |
| Trading | listings, offers, reservations, agreements, disputes | payment-provider implementation |
| Payments | plans, installments, references, release gates, fees | shipment milestone storage |
| Logistics | arrangements, milestones, delivery acceptance | commercial-term negotiation |
| Evidence | upload intents, scans, review, access and release | entity-specific ownership decisions without policies |
| Traceability | material lots, transformations, distributions, graph queries | public recall communications |
| Recalls | incident scope, holds, notifications, acknowledgements, resolution | generic product profile editing |

## Authorization model

RBAC answers whether a role may attempt an action. Resource policy answers whether the actor may perform it on this specific record.

Example:

```ts
interface ContractPolicy {
  canRead(actor: Actor, contract: ContractAccessView): boolean;
  canProposeTerms(actor: Actor, contract: ContractAccessView): boolean;
  canConfirmDelivery(actor: Actor, contract: ContractAccessView): boolean;
}
```

Controllers must not infer global access from `*.read`. Global scopes require an explicit permission such as `farm.read.all` or `traceability.read.network`.

PostgreSQL row-level security may be added for high-risk tenant tables after the application policy matrix is stable. It is defense in depth, not a substitute for application authorization.

## State machines

Central state machines are required for:

- organization verification;
- user lifecycle and invitations;
- evidence upload/review;
- holdings and inventory reservations;
- offers and trade agreements;
- payment plans and installments;
- shipments and delivery exceptions;
- certificates and claims;
- material lots; and
- recalls.

Every transition defines:

- allowed starting states;
- required actor and policy;
- required evidence or fields;
- resulting state;
- audit event;
- notification/outbox event; and
- compensating or exceptional transition.

Unrecognized states and illegal transitions fail closed.

## Transaction and event reliability

Critical business data, audit metadata and an outbox event should be written in one database transaction. A worker publishes notifications, email and external callbacks from the outbox with retries and idempotency.

This prevents the current failure mode where a business operation commits but its audit event silently fails.

Use idempotency keys for externally retryable commands such as:

- invitation creation;
- offer acceptance;
- payment submission;
- shipment milestone recording;
- upload finalization; and
- recall notification.

## Configuration

Create one validated configuration module that parses environment variables at startup. No domain module should read `process.env` directly.

Configuration must:

- distinguish development, test, demo, staging and production;
- reject insecure production values;
- expose typed, immutable settings;
- prevent demo seeding outside approved environments; and
- keep secret values out of logs and error messages.

## API contract

- Publish an OpenAPI specification for supported endpoints.
- Use consistent error codes and response envelopes.
- Generate or strongly type the frontend client from the contract where practical.
- Version breaking API changes.
- Document pagination, filtering and idempotency behavior.
- Avoid returning raw database rows or internal storage paths.

## Coding standards

These are review triggers rather than arbitrary substitutes for judgment:

- Controllers should normally remain below 100 lines and delegate domain work.
- React route components should normally remain below 250 lines.
- Functions should do one job and normally remain below 40 lines.
- Do not place multiple state-changing operations on one compressed line.
- Do not add `any` to domain or API-boundary code; use `unknown` plus parsing.
- Do not put SQL in controllers after the relevant module is migrated.
- Do not swallow operational errors or present failures as empty records.
- Do not mutate existing applied migrations; add a new migration.
- Use named domain types for identifiers, quantities, currency and status values.
- Add tests with every repaired defect.
- Comments explain decisions and invariants, not restate code.

## Testing architecture

### Unit tests

Pure state transitions, quantity calculations, policies, mappers and validation.

### Database integration tests

Real PostgreSQL with migrations. Exercise repositories, transactions, constraints, authorization queries and concurrency.

### API tests

Authenticated requests with multiple organizations. Verify both allowed and denied behavior.

### Browser E2E tests

Critical persona journeys in a production-like build. Keep the suite small, deterministic and focused on revenue/safety paths.

### Contract tests

Object storage, email and other provider adapters tested against their interface expectations.

## Incremental extraction order

1. Configuration, error model and test harness
2. Authorization policy layer
3. Evidence and object storage
4. Inventory reservation and trading
5. Identity and organization onboarding
6. Payments and logistics
7. Traceability and recalls
8. Product profiles and provenance
9. Frontend feature extraction
10. OpenAPI/client generation and remaining cleanup

Each extraction follows this sequence:

1. characterize current behavior with tests;
2. define the policy/domain contract;
3. move SQL to a repository;
4. move orchestration to a service;
5. reduce the controller to an adapter;
6. add negative and failure-path tests;
7. remove the old path; and
8. update architecture and backlog status.

## Priority refactor targets

### Backend

1. `publicProductController.ts`: separate public profile queries, profile administration and recall commands.
2. `contractController.ts`: extract offer acceptance, inventory reservation, payment initialization and shipment initialization into one transactional use case.
3. `batchController.ts`: separate source inventory, direct inventory, attestation and marketplace publication.
4. `provenanceController.ts`: create one provenance builder reused by view and export.
5. `paymentController.ts` and `shipmentController.ts`: expand compressed functions and introduce explicit state machines.
6. `evidenceController.ts`: replace filesystem work with an evidence application service and storage/scanner ports.

### Frontend

1. Split `DataPages.tsx` by resource and feature.
2. Split `api.ts` into feature clients behind a shared HTTP client.
3. Split `types.ts` into domain-owned schemas/types.
4. Extract contract, batch and shipment page sections into feature components and hooks.
5. Replace silent fetch fallbacks with explicit partial-failure UI.
6. Add route-level code splitting after feature boundaries exist.

## Architecture decision records

Material decisions should be captured in `docs/adr/` using:

- context;
- decision;
- alternatives considered;
- consequences;
- security/data implications; and
- status.

At minimum, record decisions for hosting, session model, tenant isolation, object storage, background jobs, organization onboarding, payment boundary and traceability model.

## Completion criteria

Modernization is successful when:

- critical workflows are modular and covered by integration/E2E tests;
- authorization behavior is explicit and centrally testable;
- no critical business transaction can commit without its audit/outbox record;
- a new provider can be added through an adapter rather than controller changes;
- high-risk modules contain no raw `any` or compressed state-changing logic;
- new engineers can identify ownership and change impact without tracing the whole application; and
- feature delivery continues throughout the migration without a destabilizing rewrite.
