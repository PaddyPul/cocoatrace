# Sprint:103 closure targets (30% of the total backlog)

Founder target accepted2026-10-20: close at least30% of343 tasks, rounded up to103. Preserve the original sprint baseline164/343; its OPS-016 acceptance has already moved completion to165/343 (48.1%). The forward target is103 additional closures from165, reaching268/343 (78.1%). The register retains accepted OPS-016 for continuity plus103 unresolved candidates.

This is a planning target, not an estimate or completion promise. Do not subdivide tasks to inflate the denominator. Preserve each original acceptance requirement in DELIVERY_BACKLOG.md; summaries below do not replace them. External hosting, policy/legal decisions, representative devices and customer evidence can block closure even after code is merged.

## Delivery order

1. Finish private database observation coverage with native transaction/error/reuse evidence (OPS-011).
2. Close remaining recorded workspace-state and accessibility gaps with actual browser/device evidence.
3. Complete typed boundaries, resource policies and atomic critical-action evidence by domain.
4. Implement supported claim/document and custody policies, preserving historical decisions.
5. Complete independent release, recovery, hosting and operating evidence with named owners.

Combine independent changes within each coherent batch; run focused checks before the shared full release. Accepted full-item closure alone changes the progress count. Review dependencies before starting each candidate; no implementation can substitute for an external decision.

## Candidate register

| ID | State at planning | Existing scope (abbreviated) |
| --- | --- | --- |
| UX-001 | open | Test all P0/P1 workflows at mobile, tablet and desktop widths. |
| UX-002 | open | Ensure all controls have accessible names, keyboard access and visible focus. |
| UX-003 | partial | Ensure errors appear near the failed action and preserve entered data. |
| UX-004 | partial | Stop converting material API failures into misleading empty states. |
| UX-005 | partial | Add loading, empty, partial failure, offline/retry and permission-denied states consistently. |
| UX-008 | open | Run an automated accessibility check in CI and manually test core keyboard journeys. |
| UX-010 | open | Add browser support policy and test the agreed mobile browsers. |
| PRD-011 | partial | Give every empty state an explanation and permitted next action. |
| QLT-020 | open | Add cross-browser and visual-regression coverage for the investor and critical customer flows. |
| PER-005 | open | Split heavy frontend routes and establish mobile performance/accessibility budgets. Completion: measured production bundles and buyer/supplier mobile journey with regression thresholds. |
| ARC-002 | partial | Define shared actor, organization scope, money, quantity and identifier types. |
| ARC-003 | partial | Create reusable resource policy interfaces and move authorization decisions out of controllers. |
| ARC-011 | partial | Move SQL from migrated controllers into repositories/query modules. |
| ARC-013 | partial | Write critical business changes, audit records and outbox events atomically. |
| ARC-018 | partial | Refactor batch, contract and shipment route components into focused components and hooks. |
| ARC-019 | partial | Replace compressed multi-operation functions with readable, named use cases. |
| ARC-020 | partial | Eliminate `any` from high-risk domain, authorization, payment, evidence and traceability paths. |
| ARC-021 | open | Publish and maintain an OpenAPI specification. |
| ARC-022 | open | Generate or strongly type the frontend API boundary from the OpenAPI contract. |
| ARC-024 | partial | Accepted feature-owned paged/query modules cover the resource slices listed under PER-001 and delivery checkpoints. Remaining: explicit all-route/list/export inventory and any unreviewed legacy boundaries; hosted capacity remains PER-004. Earlier evidence-selector/native-pending text is superseded by founder acceptance. |
| QLT-007 | partial | Strict no-new-any rules now include trace, catalog, security, MFA, access controls, transport, trade actions, payments, delivery, cancellation, fees and operations. Legacy evidence/auth/controller adoption remains open. |
| DAT-010 | open | Add evidence requirements by claim type rather than accepting arbitrary labels. |
| DAT-011 | open | Introduce configurable assurance schemes rather than hard-coded organic/EUDR assumptions. |
| DAT-012 | open | Add history/effective dates so past decisions remain explainable after claim changes. |
| DAT-013 | open | Add data-quality reports for missing, contradictory, stale and impossible records. |
| DAT-014 | open | Define master-data ownership for organization, farm, plot, material and product identifiers. |
| TRD-014 | partial | Snapshot accepted price, quantity, Incoterm, locations and assurance requirements. |
| PRD-003 | partial | Remove generic “Contribute proof” as a starting task; anchor evidence contribution to a record and request. |
| PRD-010 | partial | Provide document checklists based on payment plan, route and Incoterm. |
| RCL-009 | open | Add reconciliation warnings as actionable blocking tasks where safety is uncertain. |
| RCL-012 | open | Add chain-of-custody event correction through superseding records rather than destructive edits. |
| OPS-011 | partial | Add database pool, query latency, HTTP latency and queue metrics. |
| OPS-016 | accepted | Add a public or customer-facing service-status mechanism before wider launch. |
| PRD-014 | open | Add product analytics without collecting unnecessary personal data. |
| INV-008 | open | Instrument time-to-first-value, completion, review time, support interventions and repeat usage. |
| ENV-004 | open | Create separate databases, storage buckets, secrets and service identities for demo, staging and production. |
| ENV-005 | open | Make database ports private outside local development. |
| ENV-006 | open | Require HTTPS, secure cookies and exact allowed origins in staging/production. |
| ENV-010 | open | Protect production deployment with a GitHub Environment approval and environment-scoped secrets. |
| IDN-001 | open | Remove every shared demo account from staging and production. |
| INV-001 | partial | Deploy an isolated, synthetic, resettable investor demo. |
| INV-002 | open | Create and rehearse a five-minute buyer/supplier/payment/recall demo script. |
| INV-003 | open | Ensure every action in the investor path works from a clean reset and has a graceful fallback. |
| LEG-001 | open | Publish pilot privacy notice and record acceptance. |
| LEG-002 | open | Publish pilot terms of service and acceptable-use rules. |
| LEG-003 | open | Prepare a design-partner/pilot agreement with known limitations and support boundary. |
| OPS-001 | open | Use managed PostgreSQL for staging/production with encryption, automated backups and point-in-time recovery. |
| OPS-002 | partial | Local disposable dump/restore schema/history/relational/evidence-metadata rehearsal is founder release accepted. Private object bytes/versions, managed-provider restore and agreed RPO/RTO remain unverified; metadata-only restoration does not close this item. |
| OPS-003 | partial | Add centralized structured logs with request/correlation IDs and secret redaction. |
| OPS-004 | open | Add backend and frontend error monitoring with release version and environment. |
| PRD-001 | partial | Remove or flag all unsupported claims, dead controls and incoherent demo records. |
| QLT-002 | partial | IN PROGRESS  |
| SAF-002 | open | Inventory all secret-bearing URLs/logs/emails, rotate deployment keys and exercise revocation. Completion: secret-scan and redaction tests plus owner-recorded deployment rotation. |
| SAF-004 | partial | Protect administrators with phishing-resistant MFA or a reviewed isolated administration mechanism before real customer access. |
| SVC-005 | open | Award one active service order atomically with provider acceptance and explicit payer/coordinator authority. Completion: concurrent awards, retries, quote changes and expired verification cannot double-book the contract. |
| SVC-006 | open | Enforce least-privilege assigned-job grants, unrelated-provider denial and access revocation. Completion: provider cannot confirm goods payment, override holds, accept buyer delivery or browse unassigned private records. |
| UPL-002 | open | Create private, per-environment object-storage buckets with encryption and public access blocked. |
| BRD-004 | open | Approve name/domain availability and customer terminology before public launch. Completion: founder records chosen identity and any professional legal review; no availability claim based on a code rename. |
| BST-001 | partial | IMPLEMENTED; founder verified allowed-email PIN access on  |
| BST-002 | open | Verify actual Always Free eligibility, capacity, architecture, email/storage compatibility and spending boundaries. Completion: recorded provider decision under DEC-001, or explicit unavailability blocker. |
| BST-003 | open | Prepare reproducible zero-cost staging deployment and secret handoff; preserve ENV-004–006, UPL-002 and OPS-002 requirements. Completion: isolated live environment, hosted tests, private evidence proof and restore report. Do not mark complete from local Docker tests. |
| CUR-001 | partial | Agree pilot currencies and document a currency policy. One explicit ISO currency per listing, offer and accepted contract; distinguish trade currency from display preferences. Completion: approved supported-currency matrix and mismatch rules. |
| CUR-002 | partial | Carry contract currency through payment installments, fees, invoices, refunds and reconciliation; API rejects incompatible offers/payments. Preserve existing recorded currencies during migration. Completion: end-to-end tests prove no silent currency changes. |
| DAT-003 | partial | Independent certificate issuance/attestation records source, actual reviewer, method, time, expiry and audit atomically. Customer-facing trust summaries expose review provenance without private document URLs. A general origin/EUDR/evidence review workflow remains future work; local native release accepted by founder; general workflow acceptance remains open. |
| DAT-007 | partial | Live batch/listing/passport/provenance trust now reflects suspension/revocation/expiry. Audited reinstatement applies only to valid suspended certificates. Deal protections and proactive alerts remain open. |
| ENV-008 | open | Automatically deploy `main` to staging after CI passes. |
| ENV-009 | open | Promote the same immutable container artifact from staging to production; do not rebuild it. |
| ENV-011 | open | Run migrations as a separate release job with a backup/restore point and explicit failure reporting. |
| ENV-013 | open | Add staging and production readiness smoke tests after every deployment. |
| ENV-014 | partial | Publish deployed Git SHA, build time and environment in a protected diagnostics endpoint. |
| ENV-017 | open | Add deployment concurrency controls so an older release cannot overwrite a newer one. |
| GEO-001 | open | Approve first pilot commodity, country/corridor and delivery modes; completion: named invited organizations and supported/rejected cases. Broad raw-material capability is not universal regulatory readiness. |
| GEO-002 | open | Model origin/destination country, administrative region, named place and route independently of economic-region membership. Completion: domestic, cross-border within-region and inter-region route tests. |
| GEO-003 | open | Separate agreed payment schedule, delivery coordinator, service payer and Incoterm/risk allocation. Completion: domestic road delivery and sea-only FOB/CIF validation with named places and explicit agreement snapshots. |
| GEO-004 | open | Create versioned commodity/route requirement policies: handling, restricted cargo, units and required documents. Completion: unsupported hazardous/regulated cargo fails explicitly; conventional supply never invents farms. |
| GOV-002 | open | Assign a named owner to every active P0/P1 item. Done when no active item is ownerless. |
| GOV-003 | open | Add a weekly 30-minute product/engineering risk review. Record decisions, blocked items, incidents and changed priorities in this backlog. |
| GOV-006 | open | Protect `main`: require pull requests, green CI and resolved review comments. |
| IDN-005 | partial | Manually approve the first pilot organizations and record reviewer/time/reason. |
| IDN-015 | open | Record terms/privacy version and acceptance timestamp per user. |
| IDN-021 | partial | Complete identity email delivery setup and end-to-end inbox verification. Done when verification, approval invitation, team invitation/resend and password reset arrive in the intended inbox in staging, expired/revoked/reused links are rejected, and delivery failures can be retried without creating duplicate organizations or accounts. Local demo links alone do not close this item. User reports all local identity/email checks passed on  |
| INV-006 | open | Recruit target design partners: three suppliers/exporters, two buyers and supporting assurance/logistics participants. |
| INV-007 | open | Capture signed pilot intent, problem evidence and willingness-to-pay hypotheses. |
| INV-009 | open | Complete at least two repeated workflows per initial supplier and one independent buyer review. |
| LEG-004 | open | Define data controller/processor roles and prepare a DPA template. |
| LEG-005 | open | Define retention, deletion, export and legal-hold policies. |
| LEG-006 | open | Publish a subprocessor list for hosting, storage, email, monitoring and optional AI. |
| LEG-008 | open | Define ownership and permitted use of uploaded evidence, product profiles and aggregated metrics. |
| LEG-009 | open | Define responsibilities and remedies for false claims, fraud, disputes and recalled goods. |
| LEG-010 | open | Define platform fee, invoicing, tax and payment terms. |
| LNG-001 | partial | Select pilot languages with users; introduce translation catalogs, English fallback and persisted user language preference. Completion: no hard-coded customer-facing strings in the first translated trade journey. |
| LNG-002 | partial | Translate onboarding, sourcing, offers, guided dashboard, payment and delivery actions plus actionable API errors using stable error codes. Completion: buyer and supplier browser journeys pass in two selected locales. |
| LNG-003 | partial | Localize recipient emails and notifications and format dates, quantities and currency using locale-aware helpers. Validate localized number input without changing commercial units. Completion: decimal/date ambiguity and fallback tests pass. |
| LOG-006 | partial | Add shortages, damage, rejection and delivery-dispute flows. |
| OPS-005 | partial | Add uptime checks for web, API liveness and API readiness. |
| OPS-006 | partial | Scheduled-job failure/staleness records, redacted errors and private operator monitor are founder accepted  |
| OPS-007 | open | Define on-call/incident owner and escalation contacts for the pilot. |
| OPS-008 | partial | Scanner outage and quarantine response are drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Assign provider-specific owners, add secret-rotation and customer-communication procedures, and exercise them before closing. |
| OPS-009 | partial | The immutable-image rollback sequence is drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Adapt it to the selected hosting/database providers and record a successful staging exercise before closing. |
| OPS-010 | partial | Durable email/reminder/object-cleanup queues, leases/retries/terminal states, independent scheduled jobs and audited cleanup recovery are founder accepted  |
| OPS-012 | open | Define pilot SLOs, initial alert thresholds, RPO and RTO. |
| PAY-011 | partial | Define platform fee payer, tax treatment, invoice timing and collection process. |
| PER-001 | partial | Accepted max-100 scoped pages/searches, explicit legacy/export overflow, SQL deadlines and native query plans now cover source, inventory/marketplace, evidence, trade/payment, certificates/products, recalls/responses, public histories, audit/provenance, sourcing, organizations/members/invitations and review/feedback registers. Remaining: explicit universal endpoint inventory and any uncovered legacy/detail/export paths, representative hosted indexes/concurrent SLO benchmarks. Do not repeat accepted slices or infer universal coverage from this list. |
| PRD-008 | partial | Send transactional emails for invitation, offer, terms, payment, dispatch, delivery, dispute and recall actions. |
