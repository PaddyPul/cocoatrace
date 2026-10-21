# Outcome

Make HTTP controllers adapters over named feature workflows and repositories. Inventory, source, invitation and publication decisions previously mixed SQL, transactions and response writes in long handlers; the extracted paths now expose typed actor/input/result boundaries and a required recursive guard prevents direct database access from returning to controllers.

# Changes

- Extract remaining inventory, batch, listing, invitation, farm, organization, workspace and sourcing workflows with named SQL repositories.
- Separate login, contract references/detail, trace reads, public-product administration/projection, readiness, fee reconciliation and attributed downloads.
- Preserve lock order, quantities, tenant/party scope, recall/expiry gates, token rotation, full returned records, public projection/publication recheck and audit-before-download behavior.
- Add workflow, repository and boundary regressions. Extend strict formatting/LF/lint scope to the new modules; wire the controller guard into release/CI quality.
- Record accepted QLT-007 closure:167/343 (48.7%). ARC-011/019 remain candidates pending native/full release. No credit for the extraction before acceptance.

# Validation

1539 API unit tests, workspace/browser types, API build, quality/boundary checks and independent regression review passed author-side. Required authorization, risk, workspace-state and backlog checks were run. The Windows handoff runs the full exact-commit release, including native PostgreSQL/storage/scanner and browser journeys. Docker is unavailable author-side.

# Remaining work

Existing best-effort/post-commit audit gaps remain ARC-013; full DTO/OpenAPI/frontend boundary and whole-route inventory tasks remain explicit. See engineering/CONTROLLER_WORKFLOW_BOUNDARIES.md for the domain matrix and limits. This bundle is a substantial architecture batch, not a claim that103 backlog tasks or all platform gaps are closed.
