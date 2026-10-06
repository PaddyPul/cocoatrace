# BetterTrade architecture modernization

Reviewed 2026-10-06. Incremental modular monolith; no rewrite. Related ARC-*, PER-*, SAF-*, SVC-* and QLT-*.

## Measured source baseline

Current source inspection: DataPages.tsx 722 lines across unrelated resource pages; publicProductController.ts 360 lines; web types.ts 502 lines; web api.ts 374 lines; recall response module 341 lines; emailSender.ts 338 lines; delivery workflow 324 lines. Controller query-call search finds approximately 226 calls; contractController now has 9, down from the older 47-call baseline. Approximately 224 textual `any` tokens were found (heuristic, includes comments/tests, not a semantic type audit). Production JS was about 636 kB raw/164 kB gzip in the last local build, without route splitting. These are audit indicators, not code-quality or performance pass/fail scores.

Implemented seams include organizationAccess service/repository/policy, authoritative auth sessions, private evidence storage/scanner adapters, trading offers/transaction/reconciliation, payments terms/installments/issues/reminders, delivery acceptance, cancellation, fee ledger and recall lifecycle/safety/response. ESLint/format/script contracts, unit tests, PostgreSQL and browser journeys now exist. Older statements that no automated gates exist are obsolete.

Remaining smells: mixed HTTP/SQL/policy in controllers; generic API defaults to `any`; one central frontend client/type collection; duplicate Dashboard/DealRoom next-action decisions; incomplete adoption of scoped policies; recursive/unbounded graph work; unbounded list queries; overloaded pages and inconsistent source/conventional empty states. File size is a signal—split by responsibility, not arbitrary line count.

## Module boundaries

| Domain | Owns | Must not own |
| --- | --- | --- |
| Identity/organizations | Approval, membership, scoped actors, sessions/revocation | Commodity verification or transport capability merely by approving identity |
| Catalog/inventory | Material/source records, holdings, publication and quantities | Payment receipt or service awards |
| Sourcing/trading | Briefs/offers, agreed goods terms and quantity commitment | Carrier APIs or private evidence storage mechanics |
| Goods payments/fees | Agreed schedules, receipt verification, release gates and separate platform ledger | Implicit escrow, provider service charges or invented FX |
| Fulfillment/delivery | Agreed route/coordinator, allowed progress, buyer acceptance | Unilateral goods price changes or provider-confirmed buyer receipt |
| Service marketplace | Provider capabilities, RFQs, quotes, assignments and service commercial terms | Goods payment verification, custody settlement or global shipment read grants |
| Evidence/trust | Private scanned files, scoped review attribution and live claims | Automatic certification of self-entered data |
| Trace/recall | Quantity-aware lineage, safety holds/responses and bounded analysis | Unbounded global graph traversal or clearing incomplete safety analysis |
| Notifications/operations | Transactional events, leased jobs, delivery attempts and alerts | Business authorization decisions or silent post-commit audit failures |

Use HTTP adapters → typed application use cases → domain policy and repository/query interfaces → infrastructure adapters. Shared primitives: actor/scope, IDs, quantity/unit, exact money/currency, transaction boundary, stable errors, audit and outbox. Avoid a global “services” module that recreates the monolith. PostgreSQL and existing Express/React remain; separate worker process is a deployment role, not a microservice rewrite.

## SOLID application

Single responsibility: controller handles parsing/HTTP; policy makes authorization decisions; use case owns transition; query module owns SQL; adapter owns I/O. Open/closed: commodity, storage, email/scanner and optional carrier integrations implement small explicit ports. Substitutability: adapters must pass shared contracts, including failure behavior. Interface segregation: provider job actor does not receive buyer payment privileges. Dependency inversion: domain use cases depend on narrow ports, not Express request objects or provider SDKs.

Do not introduce abstractions without a real boundary. Preserve contract-first lock order and atomic mutation/audit/outbox. Use explicit idempotency and uniqueness constraints. Publish versioned OpenAPI schemas and stable errors; generate/strongly type feature clients after contract cleanup.

## Extraction sequence and acceptance

1. Shared typed authorization/actor boundaries, cookie/proxy/rate-limit tests and admin lifecycle.
2. One trade next-action/transition source consumed by home and deal room; source/conventional onboarding and sourcing persistence regressions.
3. Cursor pagination, bounded graph algorithms, streaming/bounded file behavior and measured resource budgets.
4. Split DataPages, feature clients/types and public product responsibilities as those modules change. Do not refactor frozen migrations or unrelated routes just for renaming.
5. Provider application/capability repository and scoped RFQ/award domain, then assigned-job lifecycle. Separate service and goods financial ledgers.
6. Shared scheduler/DLQ operations and deployed monitoring/recovery. Independent security review before wider public production.

Each extraction preserves existing API behavior unless versioned, tests transaction rollback/concurrency/tenant denials, changes one vertical slice and supplies an inheritance note. Developer handover needs local setup, module map, permissions matrix, migration/recovery runbooks, CI artifact links, ADRs and known limitations.

## Rename compatibility

Customer-facing BetterTrade branding comes first. Inventory packages, service/project names, database volumes, evidence namespaces, token issuer/audience, cookie/local-storage keys, URLs and GitHub remotes before internal changes. Preserve persisted data and old install upgrade paths through aliases or explicit migration. Frozen baseline files/checksums never change. GitHub repository rename, domain registration and operational resource migration require separately reviewed changes; this grooming does not perform them.

Previous planning detail is retained in [the historical archive](archive/pre-bettertrade-2026-10-06/ARCHITECTURE_MODERNIZATION.md); its obsolete deployment/product assumptions do not apply.
