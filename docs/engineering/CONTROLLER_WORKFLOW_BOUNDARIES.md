# Controller workflow and database boundaries

The controller directory is recursively checked by `npm run check:controller-boundaries`, which is required by `check:quality` and therefore release/CI. The current inventory is29 production files, including HTTP adapters, public-product helpers and compatibility barrels. This count is not a route, permission-case or complete API specification count.

Controllers adapt validated HTTP inputs, actors, domain outcomes, headers and response bodies. Named feature use cases own business orchestration; SQL belongs to feature repositories or bounded query/projection modules. The guard rejects direct database imports/requires/dynamic imports, query calls and SQL literals in controllers. It detects interpolated template starts and includes nested public-product files. It is a regression guard, not a proof against deliberate alias/indirection bypass or a substitute for review.

| Flow | Domain ownership | Preserved boundary |
| --- | --- | --- |
| Holding creation, transfer, acceptance and split | holdingsWorkflow/service + repository | Organization scope, recall lock, reservation and gram conservation, critical audit transaction |
| Harvest/direct inventory and batch publication | batchWorkflow/useCases + repository | Source-mode rules, source/holding creation, ownership and lock ordering |
| Listing detail, publication, edit and withdrawal | listingWorkflow/useCases + repository | Availability, reservation, recall/expiry, rechecks after locks and transactional audit |
| Farm/plot creation | farmWorkflow/commands + repository | Farm owner lock and declared-source audit transaction |
| Invitations | invitationsWorkflow/useCases + repository | Hash/token rotation, role/organization scope, expiry, acceptance locks, environment-specific raw-link disclosure |
| Organization/onboarding/feedback | organizationWorkflow + workspaceWorkflow | Existing actor scope, full returned record and unchanged audit timing |
| Sourcing request creation/update/closeout | sourcing/requestWorkflow + creationRepository and existing edit/lifecycle modules | Existing transaction/audit and result guarantees |
| Password login | security/login + loginRepository | Dummy password comparison, generic denial, organization gate, session recheck and security events |
| Contract detail/references | catalog/contractDetail + agreements/complianceReferences/repository | Same-party repeatable snapshot, bounded documents/installments, dispatch decision and returned fields |
| Public product administration/projection | publicProducts/administration/projection + repository | Public whitelist, publication recheck, trust/recall reads, QR visibility |
| Trace listing/back/forward/impact | trace/readWorkflow + readRepository | UUID/seed/lot limits, access check, snapshot reads and existing trace calculations |
| Audit/provenance downloads | catalog/exportDownloads + exportAttribution | Complete authorized report and durable attribution before returning bytes |
| Fee reconciliation | fees/reconciliationRead | Repeatable read-only snapshot, rollback and release |
| Readiness guidance | catalog/readinessRead | Organization/network permission scope and deterministic fallback |

## Remaining gaps

This extraction does not establish universal atomic auditing (ARC-013). Existing source-batch creation, organization creation, sourcing creation, onboarding completion, contract references, public-product changes and invitation notification/resend/revoke audit points retain their preexisting best-effort or post-commit behavior. Invitation acceptance still lacks a dedicated audit event. These require separately specified audit transactions and native rollback tests; moving a function does not repair them.

ARC-020 full framework/database DTO precision, ARC-021 OpenAPI, ARC-022 frontend contract generation, ARC-024 whole-route/list/export inventory and hosted capacity acceptance remain separate. Existing registered routes and permissions are unchanged. No new grant, schema, dependency, payment override or safety-release path is introduced.

## Validation

Author-side:1539 API unit tests passed, workspace/browser type checks passed, recursive boundary/quality checks passed and independent review found no concrete runtime regression. Native PostgreSQL concurrency, scanner/storage and browser journeys must pass through the exact-commit release before ARC-011/019 receive acceptance credit. Docker is unavailable in the author environment; mock transaction tests do not replace that evidence.
