# Sprint:35 closure targets

Baseline:164/343 (47.8%), founder reports prior release/merge accepted2026-10-19. Target199/343 (58.0%), +10.20 percentage points. This is a delivery target across multiple independently verifiable bundles, not a promise that partial work counts as complete.

## Delivery batches

### Workspace resilience

| Item | Existing acceptance requirement |
| --- | --- |
| UX-001 | Test all P0/P1 workflows at mobile, tablet and desktop widths. |
| UX-002 | Ensure all controls have accessible names, keyboard access and visible focus. |
| UX-003 | Ensure errors appear near the failed action and preserve entered data. IN PROGRESS 2026-10-13 grooming: Accepted access-review, recall-recovery and operations forms retain drafts with explicit errors; whole-application action/form retention remains unverified. |
| UX-004 | Stop converting material API failures into misleading empty states. IN PROGRESS 2026-10-13 grooming: Accepted paged register, aggregate and selection reads distinguish failure from empty results; a whole-route legacy failure audit remains open. |
| UX-005 | Add loading, empty, partial failure, offline/retry and permission-denied states consistently. IN PROGRESS 2026-10-13 grooming: Loading/empty/read-retry/permission states exist in accepted feature pages; universal offline and consistent whole-app treatment remain open. |
| UX-008 | Run an automated accessibility check in CI and manually test core keyboard journeys. |
| UX-010 | Add browser support policy and test the agreed mobile browsers. |
| PRD-011 | Give every empty state an explanation and permitted next action. IN PROGRESS 2026-10-06: trade action centre now explains a successful empty list separately from a failed refresh; source/sourcing setup stays distinct from active trade guidance. Other platform empty-state and permission coverage remains open. |
| QLT-020 | Add cross-browser and visual-regression coverage for the investor and critical customer flows. |
| PER-005 | Split heavy frontend routes and establish mobile performance/accessibility budgets. Completion: measured production bundles and buyer/supplier mobile journey with regression thresholds. |

### Typed architecture and contracts

| Item | Existing acceptance requirement |
| --- | --- |
| ARC-002 | Define shared actor, organization scope, money, quantity and identifier types. IN PROGRESS 2026-10-13 grooming: Shared authenticated actor, assurance actor and exact money helpers exist; shared organization-scope/quantity/identifier types are not adopted throughout. |
| ARC-003 | Create reusable resource policy interfaces and move authorization decisions out of controllers. IN PROGRESS (grooming): Shared resourcePolicy checks exist; adoption and typed interfaces across all controllers remain incomplete. |
| ARC-011 | Move SQL from migrated controllers into repositories/query modules. IN PROGRESS 2026-10-13 grooming: Migrated catalog reads use query/repository modules; remaining controller mutation SQL and full boundary adoption are open. |
| ARC-013 | Write critical business changes, audit records and outbox events atomically. IN PROGRESS (grooming): Trading/payment critical changes and audit writes share transactions; route-wide audit/outbox coverage needs an explicit matrix. |
| ARC-018 | Refactor batch, contract and shipment route components into focused components and hooks. IN PROGRESS 2026-10-13 grooming: Feature-owned contract/shipment/source record routes exist; complete focused workflow hook/component extraction remains open. |
| ARC-019 | Replace compressed multi-operation functions with readable, named use cases. IN PROGRESS: contract payment-term handlers are HTTP adapters over named typed use cases; remaining controller extraction stays open; the applicable native release is founder accepted. |
| ARC-020 | Eliminate `any` from high-risk domain, authorization, payment, evidence and traceability paths. IN PROGRESS 2026-10-13 grooming: Strict no-any enforcement covers migrated security/MFA/transport/payment/delivery/trace/catalog/operations modules; legacy evidence/auth/controller paths still require cleanup. |
| ARC-021 | Publish and maintain an OpenAPI specification. |
| ARC-022 | Generate or strongly type the frontend API boundary from the OpenAPI contract. |
| ARC-024 | Accepted feature-owned paged/query modules cover the resource slices listed under PER-001 and delivery checkpoints. Remaining: explicit all-route/list/export inventory and any unreviewed legacy boundaries; hosted capacity remains PER-004. Earlier evidence-selector/native-pending text is superseded by founder acceptance. |
| QLT-007 | Strict no-new-any rules now include trace, catalog, security, MFA, access controls, transport, trade actions, payments, delivery, cancellation, fees and operations. Legacy evidence/auth/controller adoption remains open. |

### Recorded requirements and safety

| Item | Existing acceptance requirement |
| --- | --- |
| DAT-010 | Add evidence requirements by claim type rather than accepting arbitrary labels. |
| DAT-011 | Introduce configurable assurance schemes rather than hard-coded organic/EUDR assumptions. |
| DAT-012 | Add history/effective dates so past decisions remain explainable after claim changes. |
| DAT-013 | Add data-quality reports for missing, contradictory, stale and impossible records. |
| DAT-014 | Define master-data ownership for organization, farm, plot, material and product identifiers. |
| TRD-014 | Snapshot accepted price, quantity, Incoterm, locations and assurance requirements. IN PROGRESS 2026-10-13 grooming: Accepted goods price/quantity/currency, Incoterm and locations are preserved through the transactional trade/fulfillment path; full immutable assurance-requirement snapshots remain open. |
| PRD-003 | Remove generic “Contribute proof” as a starting task; anchor evidence contribution to a record and request. IN PROGRESS: Record picker, explicit document purpose and contextual farm/batch entry implemented; Founder confirms full release checks passed and merge/pull completed 2026-10-07. Record-based contribution is accepted; request-specific evidence checklist remains follow-up. |
| PRD-010 | Provide document checklists based on payment plan, route and Incoterm. IN PROGRESS 2026-10-13 grooming: Payment-plan protected-document rules and current evidence guidance exist; complete route/mode/named-place/Incoterm checklists remain open. |
| RCL-009 | Add reconciliation warnings as actionable blocking tasks where safety is uncertain. |
| RCL-012 | Add chain-of-custody event correction through superseding records rather than destructive edits. |

### Private operational evidence

| Item | Existing acceptance requirement |
| --- | --- |
| OPS-011 | Add database pool, query latency, HTTP latency and queue metrics. |
| OPS-016 | Add a public or customer-facing service-status mechanism before wider launch. |
| PRD-014 | Add product analytics without collecting unnecessary personal data. |
| INV-008 | Instrument time-to-first-value, completion, review time, support interventions and repeat usage. |

## Acceptance and dependencies

- Implement and verify one coherent batch at a time; combine independent changes before a shared full release. Report focused checks first; run the mandatory exact-commit release before push/merge.
- User reports required release/merge acceptance; only then change the corresponding full-item completion state. Do not manufacture a seven/35-item count from smaller substeps.
- UX-001/002/008/010/QLT-020/PER-005 require actual browser/keyboard/device evidence; TypeScript and DOM checks alone do not close all of them. Browser support defaults are proposals until agreed and exercised.
- DAT/PRD requirement policies need a supported commodity/corridor decision before making regulatory or document claims. Versioned configurable interfaces alone cannot approve a policy.
- Analytics require privacy/retention decisions and a minimal event contract; do not start collecting personal data merely to meet a target.
- OPS service status/metrics must report observed unknown/unavailable states and redact business/identity details. Hosted monitoring and SLO gates remain independent.
- Current first bundle focuses read retries, honest unknown/permission failure and shared keyboard interaction; it advances the sprint without claiming35 closures.

## Batch tracking

- Batch1 workspace resilience and keyboard corrections: founder reports full release/merge accepted. Broad UX parent items remain open.
- Batch2 workspace state inventory and observability: candidate;54 page modules/68 evidence entries, source/trade/admin recovery fixes, private runtime metrics and public status. Focused/new native cases plus full release remain required.
- Accepted completion stays164/343 (47.8%);35 closures are the sprint target, not an achieved count.
