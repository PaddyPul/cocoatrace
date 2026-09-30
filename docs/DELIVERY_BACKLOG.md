# CocoaTrace delivery backlog

**Purpose:** Single source of truth for work required to move CocoaTrace from a passion project to an investor-ready, pilot-safe and production-capable company.  
**North Star:** [`NORTH_STAR.md`](./NORTH_STAR.md)  
**Architecture direction:** [`ARCHITECTURE_MODERNIZATION.md`](./ARCHITECTURE_MODERNIZATION.md)  
**Last triaged:** 2026-09-29  
**Next formal review:** Weekly, before selecting new work

## How to use this file

1. Every material change must reference one or more backlog IDs.
2. Select work from **Current execution queue** unless a new P0 incident supersedes it.
3. Move an item to complete only after its stated outcome and the repository definition of done are met.
4. Add newly discovered work to the appropriate section with an ID, priority, phase and completion test.
5. Do not hide unfinished scope inside a pull request. Create follow-up items before merging.
6. At the end of each work session, update checkboxes, the current queue, risks and `Last triaged` if priorities changed.

When asked “what needs to be done?”, start with incomplete items in the current execution queue, then the active phase exit criteria, then blocked P0/P1 work.

## Status and priority legend

- `[ ]` not started
- `[-]` in progress; GitHub does not render this as a task checkbox, so include the text `IN PROGRESS`
- `[x]` complete and verified
- **P0** blocks investor exposure, pilot safety or production
- **P1** required for a credible controlled customer pilot
- **P2** required for an investable, maintainable customer MVP
- **P3** valuable after the core is proven

## Delivery phases

| Phase | Window | Outcome |
| --- | --- | --- |
| 0. Stabilize | Week 1 | Safe investor demo, environment isolation and plan under version control |
| 1. Pilot foundation | Weeks 2–4 | Tenant-safe, private evidence, reliable inventory and approved-user onboarding |
| 2. Customer MVP | Weeks 5–8 | Complete trade, delivery, recall and notification workflows for design partners |
| 3. Investable platform | Weeks 9–12 | Modular architecture, operational maturity, metrics and repeatable pilots |
| 4. Scale proof | Weeks 13–16 | Performance, expansion primitives, independent assurance and production launch gate |

The windows are sequencing targets, not promises that quality gates will be
waived. This is an exhaustive risk and delivery inventory; it intentionally
contains more work than a solo developer should start at once. Keep at most
three engineering items in progress, finish vertical slices, and move a phase
only when its exit gate passes. Phase 4 may extend beyond week 16 as customer
and independent-review evidence becomes available.

## Current execution queue

Complete these canonical backlog items in order unless a blocker requires
resequencing. Update their checkbox in the detailed section below; this queue is
only the ordered view and deliberately has no duplicate checkboxes.

1. **UPL-002, ENV-004** — provision and verify independent staging storage and malware scanning
2. **OPS-006** — alert on scanner failure, signature staleness and quarantine backlog
3. **AUTH/registration wave** — email verification, password recovery, throttling and organization approval
4. **TRD-001–TRD-009** — enforce transactional inventory and agreement invariants
5. **QLT-004** — verify upload authorization, quarantine, scanning and controlled release end to end
6. **DAT-001** — replace optimistic trust-state defaults with honest states
7. **TRD-001** — make inventory reservation and offer acceptance atomic
8. **RCL-001** — enforce recall holds across listing, transfer and dispatch

---

# 1. Governance and delivery discipline

- [x] **GOV-001 · P0 · Phase 0:** Put the North Star, roadmap, architecture direction and delivery backlog in the repository.
- [ ] **GOV-002 · P1 · Phase 0:** Assign a named owner to every active P0/P1 item. Done when no active item is ownerless.
- [ ] **GOV-003 · P1 · Phase 0:** Add a weekly 30-minute product/engineering risk review. Record decisions, blocked items, incidents and changed priorities in this backlog.
- [ ] **GOV-004 · P1 · Phase 0:** Create `docs/adr/` and record architecture decisions for hosting, sessions, tenant isolation, storage, jobs, onboarding and payment boundaries.
- [ ] **GOV-005 · P2 · Phase 1:** Add CODEOWNERS after maintainers are known. Sensitive modules require review from their named owner.
- [ ] **GOV-006 · P1 · Phase 0:** Protect `main`: require pull requests, green CI and resolved review comments.
- [ ] **GOV-007 · P2 · Phase 1:** Define release naming, changelog and semantic versioning conventions.
- [ ] **GOV-008 · P1 · Phase 1:** Maintain a visible risk register with likelihood, impact, mitigation, owner and review date.
- [ ] **GOV-009 · P2 · Phase 2:** Publish a customer-facing known-limitations page for every pilot release.
- [ ] **GOV-010 · P2 · Phase 2:** Establish a deprecation policy for API fields, statuses and customer workflows.

# 2. Environments, build and deployment

- [x] **ENV-001 · P0 · Phase 0:** Create typed configuration for `development`, `test`, `demo`, `staging` and `production`.
- [x] **ENV-002 · P0 · Phase 0:** Remove automatic demo seeding from the production Docker command.
- [x] **ENV-003 · P0 · Phase 0:** Add `DEMO_MODE` and remove demo-only UI/API behavior outside demo.
- [ ] **ENV-004 · P0 · Phase 0:** Create separate databases, storage buckets, secrets and service identities for demo, staging and production.
- [ ] **ENV-005 · P0 · Phase 0:** Make database ports private outside local development.
- [ ] **ENV-006 · P0 · Phase 0:** Require HTTPS, secure cookies and exact allowed origins in staging/production.
- [ ] **ENV-007 · P1 · Phase 0:** Add an ephemeral PostgreSQL service to CI and apply all migrations from zero.
- [ ] **ENV-008 · P1 · Phase 0:** Automatically deploy `main` to staging after CI passes.
- [ ] **ENV-009 · P1 · Phase 1:** Promote the same immutable container artifact from staging to production; do not rebuild it.
- [ ] **ENV-010 · P0 · Phase 1:** Protect production deployment with a GitHub Environment approval and environment-scoped secrets.
- [ ] **ENV-011 · P1 · Phase 1:** Run migrations as a separate release job with a backup/restore point and explicit failure reporting.
- [ ] **ENV-012 · P1 · Phase 1:** Add migration compatibility rules for rolling deployment and rollback.
- [ ] **ENV-013 · P1 · Phase 1:** Add staging and production readiness smoke tests after every deployment.
- [ ] **ENV-014 · P1 · Phase 1:** Publish deployed Git SHA, build time and environment in a protected diagnostics endpoint.
- [ ] **ENV-015 · P2 · Phase 2:** Add pull-request preview deployments without production secrets or persistent customer data.
- [ ] **ENV-016 · P1 · Phase 1:** Add a safe, explicit demo reset job that cannot address staging or production.
- [ ] **ENV-017 · P1 · Phase 1:** Add deployment concurrency controls so an older release cannot overwrite a newer one.
- [ ] **ENV-018 · P2 · Phase 2:** Document domain, DNS, TLS, cookie and CORS configuration for every environment.

# 3. Architecture and code quality

- [x] **ARC-001 · P1 · Phase 1:** Add a typed `config/` module and remove scattered environment parsing.
- [ ] **ARC-002 · P1 · Phase 1:** Define shared actor, organization scope, money, quantity and identifier types.
- [ ] **ARC-003 · P1 · Phase 1:** Create reusable resource policy interfaces and move authorization decisions out of controllers.
- [ ] **ARC-004 · P1 · Phase 1:** Extract evidence controller logic into service, policy, repository and infrastructure adapters.
- [ ] **ARC-005 · P1 · Phase 1:** Extract offer acceptance and inventory reservation into one transactional trading use case.
- [ ] **ARC-006 · P1 · Phase 2:** Extract payment-plan and installment state machines.
- [ ] **ARC-007 · P1 · Phase 2:** Extract shipment and delivery state machines.
- [ ] **ARC-008 · P1 · Phase 2:** Extract recall activation, notification and resolution use cases.
- [ ] **ARC-009 · P2 · Phase 2:** Split public product administration, public rendering and recall code into separate modules.
- [ ] **ARC-010 · P2 · Phase 2:** Replace duplicated provenance view/export logic with one provenance builder and response mappers.
- [ ] **ARC-011 · P2 · Phase 2:** Move SQL from migrated controllers into repositories/query modules.
- [ ] **ARC-012 · P2 · Phase 2:** Introduce a transaction boundary abstraction used by application services.
- [ ] **ARC-013 · P1 · Phase 2:** Write critical business changes, audit records and outbox events atomically.
- [ ] **ARC-014 · P2 · Phase 3:** Add a transactional outbox and idempotent worker for email, alerts and external callbacks.
- [ ] **ARC-015 · P2 · Phase 3:** Split `web/src/pages/DataPages.tsx` into feature-owned routes and components.
- [ ] **ARC-016 · P2 · Phase 3:** Split `web/src/api.ts` into a shared HTTP client and feature clients.
- [ ] **ARC-017 · P2 · Phase 3:** Split `web/src/types.ts` into module-owned schemas and domain types.
- [ ] **ARC-018 · P2 · Phase 3:** Refactor batch, contract and shipment route components into focused components and hooks.
- [ ] **ARC-019 · P2 · Phase 3:** Replace compressed multi-operation functions with readable, named use cases.
- [ ] **ARC-020 · P2 · Phase 3:** Eliminate `any` from high-risk domain, authorization, payment, evidence and traceability paths.
- [ ] **ARC-021 · P2 · Phase 3:** Publish and maintain an OpenAPI specification.
- [ ] **ARC-022 · P2 · Phase 3:** Generate or strongly type the frontend API boundary from the OpenAPI contract.
- [ ] **ARC-023 · P2 · Phase 3:** Introduce stable error codes and a consistent API error envelope.
- [ ] **ARC-024 · P2 · Phase 3:** Add pagination and bounded queries to list/export endpoints.
- [ ] **ARC-025 · P2 · Phase 3:** Remove the unused sessions design or make it the authoritative revocable session system.
- [ ] **ARC-026 · P3 · Phase 4:** Add commodity policy/configuration interfaces before onboarding the second commodity.
- [ ] **ARC-027 · P3 · Phase 4:** Add transformation workflow ports and domain types only when a validated customer requires blending/repacking.

# 4. Identity, registration and organizations

- [ ] **IDN-001 · P0 · Phase 1:** Remove every shared demo account from staging and production.
- [ ] **IDN-002 · P1 · Phase 1:** Implement “Request access” for buyer and supplier organizations.
- [ ] **IDN-003 · P1 · Phase 1:** Add organization states: application pending, review pending, verified, rejected and suspended.
- [ ] **IDN-004 · P1 · Phase 1:** Require email verification before an organization application can proceed.
- [ ] **IDN-005 · P1 · Phase 1:** Manually approve the first pilot organizations and record reviewer/time/reason.
- [ ] **IDN-006 · P1 · Phase 1:** Create the first organization administrator only after organization approval.
- [ ] **IDN-007 · P1 · Phase 1:** Keep additional users invitation-only during the pilot.
- [ ] **IDN-008 · P1 · Phase 1:** Send invitation emails; add resend, revoke and expiry controls.
- [ ] **IDN-009 · P0 · Phase 1:** Implement password reset with single-use hashed tokens, uniform responses and rate limits.
- [ ] **IDN-010 · P1 · Phase 1:** Implement password change and revoke other sessions after sensitive account changes.
- [ ] **IDN-011 · P1 · Phase 1:** Implement user suspension/deactivation and immediate session revocation.
- [ ] **IDN-012 · P1 · Phase 2:** Require MFA for platform admins, certifiers, regulators and organization admins.
- [ ] **IDN-013 · P1 · Phase 1:** Replace process-memory login throttling with shared, account-aware and IP-aware limits.
- [ ] **IDN-014 · P1 · Phase 1:** Add security events for failed login, reset, MFA and session revocation.
- [ ] **IDN-015 · P1 · Phase 1:** Record terms/privacy version and acceptance timestamp per user.
- [ ] **IDN-016 · P2 · Phase 2:** Add organization member role changes with least-privilege constraints and audit.
- [ ] **IDN-017 · P2 · Phase 2:** Add an organization-admin member screen for invite, deactivate and role review.
- [ ] **IDN-018 · P2 · Phase 2:** Add recovery procedures for lost MFA and locked accounts.
- [ ] **IDN-019 · P2 · Phase 3:** Add periodic privileged-access review and stale-account reporting.
- [ ] **IDN-020 · P3 · Phase 4:** Evaluate enterprise SSO only after customer demand is validated.

# 5. Authorization and application security

- [x] **SEC-001 · P0 · Phase 1:** Document route/resource authorization matrix with explicit network-wide permissions. See [`security/AUTHORIZATION_MATRIX.md`](security/AUTHORIZATION_MATRIX.md).
- [-] **SEC-002 · P0 · Phase 1 — IN PROGRESS:** Farm, plot, certificate, profile, provenance, evidence and indirect contract IDOR fixes and PostgreSQL regressions are implemented; completion awaits the green PostgreSQL security suite.
- [-] **SEC-003 · P0 · Phase 1 — IN PROGRESS:** Ordinary reads are tenant/relationship bounded and explicit `*.all`/`*.network` grants were added; completion awaits the green PostgreSQL security suite.
- [-] **SEC-004 · P0 · Phase 1 — IN PROGRESS:** Provenance now binds `contractId` to both the batch and an authorized party; completion awaits the green PostgreSQL security suite.
- [-] **SEC-005 · P0 · Phase 1 — IN PROGRESS:** Contract document listing, attachment and download inherit contract-party authorization; completion awaits the green PostgreSQL security suite.
- [ ] **SEC-006 · P1 · Phase 1:** Decide whether unauthorized resources consistently return `403` or non-disclosing `404` and test it.
- [ ] **SEC-007 · P1 · Phase 1:** Add CSRF/origin tests for every cookie-authenticated state-changing request.
- [ ] **SEC-008 · P1 · Phase 1:** Add a restrictive Content Security Policy and verify public profile assets.
- [ ] **SEC-009 · P1 · Phase 1:** Review all outbound/tracking/hero URLs against allowlist and safe rendering rules.
- [ ] **SEC-010 · P1 · Phase 1:** Add request-body and query-size limits globally.
- [ ] **SEC-011 · P1 · Phase 1:** Add bounded rate limits for public scan, QR, login, reset, invitation and upload-intent endpoints.
- [ ] **SEC-012 · P1 · Phase 1:** Move production secrets to a managed secret store and rotate existing secrets.
- [ ] **SEC-013 · P1 · Phase 1:** Add secret scanning to CI and repository settings.
- [ ] **SEC-014 · P1 · Phase 1:** Add dependency and container vulnerability scanning; remediate or accept findings explicitly.
- [ ] **SEC-015 · P1 · Phase 2:** Threat-model account takeover, tenant breakout, fraudulent claims, malicious files, payment-reference fraud and recall abuse.
- [ ] **SEC-016 · P2 · Phase 2:** Add PostgreSQL RLS to the highest-risk tenant tables after application policies stabilize.
- [ ] **SEC-017 · P1 · Phase 2:** Add immutable security-event retention and alerts for abnormal authorization failures.
- [ ] **SEC-018 · P2 · Phase 3:** Commission an independent authorization/security review before public production.
- [ ] **SEC-019 · P2 · Phase 3:** Create a vulnerability-reporting policy and private security contact.
- [ ] **SEC-020 · P2 · Phase 3:** Run an OWASP ASVS-aligned release review and record accepted exceptions.

# 6. Evidence and file uploads

- [x] **UPL-001 · P0 · Phase 1:** `/uploads` static serving and response storage paths are removed and regression-tested.
- [ ] **UPL-002 · P0 · Phase 1:** Create private, per-environment object-storage buckets with encryption and public access blocked.
- [x] **UPL-003 · P0 · Phase 1:** Add entity-authorized upload intents using opaque object keys and expiring signed URLs.
- [x] **UPL-004 · P0 · Phase 1:** Add quarantine storage and keep documents unavailable until validation completes.
- [x] **UPL-005 · P0 · Phase 1:** Initially allow only PDF, JPEG and PNG using extension, MIME and file-signature checks.
- [x] **UPL-006 · P0 · Phase 1:** Add explicit per-file and per-organization size limits.
- [x] **UPL-007 · P0 · Phase 1:** Add malware scanning and record engine/result/time.
- [x] **UPL-008 · P1 · Phase 1:** Calculate the definitive SHA-256 after upload and before approval.
- [-] **UPL-009 · P1 · Phase 1 — IN PROGRESS:** Upload, scan, infection, failure, submission and expiry states are explicit; reviewer approval/rejection UX remains.
- [ ] **UPL-010 · P1 · Phase 1:** Add authorized expiring downloads with attachment disposition and release-condition checks.
- [ ] **UPL-011 · P1 · Phase 2:** Add reviewer queues, rejection reasons and replacement/version history.
- [ ] **UPL-012 · P1 · Phase 2:** Add certificate/document expiry and renewal reminders.
- [ ] **UPL-013 · P1 · Phase 2:** Define retention, deletion, legal hold and backup behavior.
- [ ] **UPL-014 · P1 · Phase 2:** Audit upload intent, completion, scan, review, access and deletion.
- [ ] **UPL-015 · P2 · Phase 2:** Add storage quotas and abuse monitoring.
- [ ] **UPL-016 · P2 · Phase 3:** Add asynchronous extraction only behind human confirmation and without changing trust state.
- [ ] **UPL-017 · P2 · Phase 3:** Add a public/private field policy for product-profile evidence metadata.
- [ ] **UPL-018 · P2 · Phase 3:** Complete a restore test for evidence metadata and object versions.

# 7. Trust, certification and compliance data

- [ ] **DAT-001 · P0 · Phase 1:** Replace verified/approved/clear/EUDR-checked defaults with pending, self-declared or unknown states.
- [ ] **DAT-002 · P0 · Phase 1:** Migrate existing non-seed records to an honest trust state with an audit report.
- [ ] **DAT-003 · P1 · Phase 1:** Record claim source, reviewer, method, timestamp and expiry.
- [-] **DAT-004 · P1 · Phase 1 — IN PROGRESS:** Certificate issue and attestation validate farmer organization against farm ownership; completion awaits the PostgreSQL regression run.
- [-] **DAT-005 · P1 · Phase 1 — IN PROGRESS:** Attestation validates crop scope and harvest-date coverage; completion awaits the PostgreSQL regression run.
- [ ] **DAT-006 · P1 · Phase 1:** Prevent contradictory duplicate active certificates.
- [ ] **DAT-007 · P1 · Phase 2:** Cascade certificate suspension/revocation into affected claims, listings, deals and alerts.
- [ ] **DAT-008 · P1 · Phase 2:** Recalculate marketplace and product-profile trust labels from current source data.
- [ ] **DAT-009 · P1 · Phase 2:** Show whether information is self-declared, document-supported or independently verified.
- [ ] **DAT-010 · P1 · Phase 2:** Add evidence requirements by claim type rather than accepting arbitrary labels.
- [ ] **DAT-011 · P2 · Phase 2:** Introduce configurable assurance schemes rather than hard-coded organic/EUDR assumptions.
- [ ] **DAT-012 · P2 · Phase 3:** Add history/effective dates so past decisions remain explainable after claim changes.
- [ ] **DAT-013 · P2 · Phase 3:** Add data-quality reports for missing, contradictory, stale and impossible records.
- [ ] **DAT-014 · P2 · Phase 3:** Define master-data ownership for organization, farm, plot, material and product identifiers.

# 8. Inventory, marketplace, offers and agreements

- [ ] **TRD-001 · P0 · Phase 1:** Add transactional inventory reservation with row locks during offer acceptance.
- [ ] **TRD-002 · P0 · Phase 1:** Deactivate or resize every incompatible listing sharing a committed holding.
- [ ] **TRD-003 · P0 · Phase 1:** Reject acceptance when listing is inactive, offer expired or holding not available.
- [ ] **TRD-004 · P0 · Phase 1:** Prevent listing create/update above unreserved quantity.
- [ ] **TRD-005 · P0 · Phase 1:** Prevent custody transfer or split of reserved/committed inventory.
- [ ] **TRD-006 · P0 · Phase 1:** Lock transfer and holding rows when accepting transfers.
- [ ] **TRD-007 · P0 · Phase 1:** Add database constraints for positive quantities, legal statuses and one agreement per accepted offer.
- [ ] **TRD-008 · P1 · Phase 1:** Add reconciliation invariants across source quantity, holdings, reservations, commitments and distributions.
- [ ] **TRD-009 · P1 · Phase 1:** Add concurrency tests for simultaneous offers, listings, transfers and acceptance.
- [ ] **TRD-010 · P1 · Phase 2:** Allow buyers to withdraw pending offers.
- [ ] **TRD-011 · P1 · Phase 2:** Add seller rejection reason and immutable history.
- [ ] **TRD-012 · P1 · Phase 2:** Implement a bounded counteroffer flow or explicitly mark negotiation external.
- [ ] **TRD-013 · P1 · Phase 2:** Enforce offer currency/validity rules and listing compatibility.
- [ ] **TRD-014 · P1 · Phase 2:** Snapshot accepted price, quantity, Incoterm, locations and assurance requirements.
- [ ] **TRD-015 · P1 · Phase 2:** Add agreement version, explicit acceptance by both parties and acceptance timestamp.
- [ ] **TRD-016 · P1 · Phase 2:** Rename “sales contract” where no legally executed contract exists, or add signed-document support.
- [ ] **TRD-017 · P1 · Phase 2:** Add cancellation, dispute and administrator-resolution states.
- [ ] **TRD-018 · P2 · Phase 2:** Award/close the originating sourcing request when appropriate.
- [ ] **TRD-019 · P2 · Phase 3:** Add marketplace pagination, search indexes and deterministic match explanations.
- [ ] **TRD-020 · P2 · Phase 3:** Add listing expiry and supplier renewal workflows.

# 9. Payments, fees and financial boundaries

- [ ] **PAY-001 · P0 · Phase 1:** Keep server-enforced dispatch gates and add integration tests for every payment plan.
- [ ] **PAY-002 · P1 · Phase 1:** Display prominently that CocoaTrace records references and confirmations but does not hold funds or provide escrow.
- [ ] **PAY-003 · P1 · Phase 2:** Require payment evidence attachment or structured proof where the selected plan requires it.
- [ ] **PAY-004 · P1 · Phase 2:** Separate buyer submission, seller confirmation, rejection and dispute histories.
- [ ] **PAY-005 · P1 · Phase 2:** Add idempotency to payment submission and confirmation.
- [ ] **PAY-006 · P1 · Phase 2:** Prevent one party from unilaterally satisfying incompatible payment and delivery conditions.
- [ ] **PAY-007 · P1 · Phase 2:** Define document-release behavior for each payment plan.
- [ ] **PAY-008 · P1 · Phase 2:** Add overdue installment calculation and reminders.
- [ ] **PAY-009 · P1 · Phase 2:** Add correction/reversal procedure without deleting history.
- [ ] **PAY-010 · P1 · Phase 2:** Define how bank guarantees/LC references are independently checked or explicitly marked seller-accepted only.
- [ ] **PAY-011 · P1 · Phase 2:** Define platform fee payer, tax treatment, invoice timing and collection process.
- [ ] **PAY-012 · P1 · Phase 2:** Implement platform fee invoice delivery and paid/write-off status.
- [ ] **PAY-013 · P2 · Phase 3:** Reconcile fee invoices against completed deals and finance exports.
- [ ] **PAY-014 · P3 · Phase 4:** Evaluate regulated payment-provider integrations only after the manual workflow and demand are proven.

# 10. Logistics, delivery and external transport

- [ ] **LOG-001 · P1 · Phase 1:** Preserve Incoterm-based transport coordinator assignment and test every supported term.
- [ ] **LOG-002 · P1 · Phase 2:** Define which party may record each milestone and which may only observe it.
- [ ] **LOG-003 · P1 · Phase 2:** Require essential arrangement fields before departure-relevant milestones.
- [ ] **LOG-004 · P1 · Phase 2:** Decide whether milestone skipping is allowed; encode required predecessors explicitly.
- [ ] **LOG-005 · P1 · Phase 2:** Add buyer delivery confirmation distinct from a reported delivery milestone.
- [ ] **LOG-006 · P1 · Phase 2:** Add shortages, damage, rejection and delivery-dispute flows.
- [ ] **LOG-007 · P1 · Phase 2:** Prevent automatic settlement while a delivery dispute is open.
- [ ] **LOG-008 · P1 · Phase 2:** Require reason, acknowledgement and notification for exceptional dispatch.
- [ ] **LOG-009 · P1 · Phase 2:** Attach transport documents through the controlled evidence workflow.
- [ ] **LOG-010 · P2 · Phase 3:** Add ETA changes, delay reasons and overdue milestone alerts.
- [ ] **LOG-011 · P2 · Phase 3:** Add optional provider tracking links with URL safety validation.
- [ ] **LOG-012 · P3 · Phase 4:** Add carrier/provider integrations only through optional adapters; keep manual external arrangements first-class.

# 11. Traceability and recall

- [ ] **RCL-001 · P0 · Phase 2:** Put affected lots and holdings on hold when a recall activates.
- [ ] **RCL-002 · P0 · Phase 2:** Disable affected listings and block offers, transfers and dispatch.
- [ ] **RCL-003 · P1 · Phase 2:** Generate recipient notifications from the quantity-aware impact calculation.
- [ ] **RCL-004 · P1 · Phase 2:** Add recipient acknowledgement, contact status and escalation.
- [ ] **RCL-005 · P1 · Phase 2:** Track quarantined, returned, destroyed, corrected and released quantities.
- [ ] **RCL-006 · P1 · Phase 2:** Require resolution reason, authorized approver and supporting evidence.
- [ ] **RCL-007 · P1 · Phase 2:** Preserve resolved public notices and resolution history.
- [ ] **RCL-008 · P1 · Phase 2:** Add tabletop recall tests covering partial, commingled and distributed material.
- [ ] **RCL-009 · P1 · Phase 2:** Add reconciliation warnings as actionable blocking tasks where safety is uncertain.
- [ ] **RCL-010 · P1 · Phase 2:** Define who can investigate versus activate versus resolve recalls.
- [ ] **RCL-011 · P2 · Phase 3:** Add a genuine customer transformation/blending workflow or remove transformation claims.
- [ ] **RCL-012 · P2 · Phase 3:** Add chain-of-custody event correction through superseding records rather than destructive edits.
- [ ] **RCL-013 · P2 · Phase 3:** Add drill reports with elapsed time, completeness, unresolved recipients and quantity reconciliation.
- [ ] **RCL-014 · P3 · Phase 4:** Evaluate standards-based traceability exports after customer format requirements are known.

# 12. Product experience and notifications

- [ ] **PRD-001 · P0 · Phase 0:** Remove or flag all unsupported claims, dead controls and incoherent demo records.
- [ ] **PRD-002 · P0 · Phase 0:** Keep demo, staging and production content/data visually distinguishable.
- [ ] **PRD-003 · P1 · Phase 1:** Remove generic “Contribute proof” as a starting task; anchor evidence contribution to a record and request.
- [ ] **PRD-004 · P1 · Phase 1:** Ensure supplier onboarding selects conventional versus source-traceable supply before record creation.
- [ ] **PRD-005 · P1 · Phase 1:** Ensure buyer sourcing requirements persist and drive marketplace matching.
- [ ] **PRD-006 · P1 · Phase 2:** Make the guided dashboard and deal room use one next-action source.
- [ ] **PRD-007 · P1 · Phase 2:** Add a notification center with read/unread, responsible party and deep link.
- [ ] **PRD-008 · P1 · Phase 2:** Send transactional emails for invitation, offer, terms, payment, dispatch, delivery, dispute and recall actions.
- [ ] **PRD-009 · P1 · Phase 2:** Add overdue/action-required filters for buyers and suppliers.
- [ ] **PRD-010 · P1 · Phase 2:** Provide document checklists based on payment plan, route and Incoterm.
- [ ] **PRD-011 · P1 · Phase 2:** Give every empty state an explanation and permitted next action.
- [ ] **PRD-012 · P1 · Phase 2:** Add customer-visible activity history to deals.
- [ ] **PRD-013 · P2 · Phase 3:** Add saved filters and search for organizations with meaningful record volume.
- [ ] **PRD-014 · P2 · Phase 3:** Add product analytics without collecting unnecessary personal data.
- [ ] **PRD-015 · P2 · Phase 3:** Add contextual support/contact flow and issue reference IDs.
- [ ] **PRD-016 · P3 · Phase 4:** Validate second-commodity schemas with customer research before building them.

# 13. UX, accessibility and frontend quality

- [ ] **UX-001 · P1 · Phase 1:** Test all P0/P1 workflows at mobile, tablet and desktop widths.
- [ ] **UX-002 · P1 · Phase 1:** Ensure all controls have accessible names, keyboard access and visible focus.
- [ ] **UX-003 · P1 · Phase 1:** Ensure errors appear near the failed action and preserve entered data.
- [ ] **UX-004 · P1 · Phase 1:** Stop converting material API failures into misleading empty states.
- [ ] **UX-005 · P1 · Phase 2:** Add loading, empty, partial failure, offline/retry and permission-denied states consistently.
- [ ] **UX-006 · P1 · Phase 2:** Add confirmation for destructive or irreversible actions.
- [ ] **UX-007 · P1 · Phase 2:** Make status labels and colors consistent across dashboard, deal, payment and shipment views.
- [ ] **UX-008 · P2 · Phase 2:** Run an automated accessibility check in CI and manually test core keyboard journeys.
- [ ] **UX-009 · P2 · Phase 3:** Add route-level code splitting and keep initial bundle within an agreed budget.
- [ ] **UX-010 · P2 · Phase 3:** Add browser support policy and test the agreed mobile browsers.
- [ ] **UX-011 · P2 · Phase 3:** Add safe unsaved-change warnings to long forms.
- [ ] **UX-012 · P3 · Phase 4:** Conduct structured usability sessions and close repeated friction patterns.

# 14. Testing and engineering quality gates

- [x] **QLT-001 · P0 · Phase 1:** Add real-PostgreSQL API integration tests with at least two unrelated organizations. The disposable PostgreSQL harness, safety guard, two-tenant API tests and CI job have completed a green run.
- [ ] **QLT-002 · P0 · Phase 1:** Add negative authorization tests for every protected resource family.
- [ ] **QLT-003 · P0 · Phase 1:** Add inventory and offer concurrency tests.
- [ ] **QLT-004 · P0 · Phase 1:** Test evidence upload authorization, file limits, quarantine, scan and download release.
- [ ] **QLT-005 · P1 · Phase 1:** Test migrations from an empty database and from the current baseline snapshot.
- [ ] **QLT-006 · P1 · Phase 1:** Add ESLint, formatting and typecheck commands to CI.
- [ ] **QLT-007 · P1 · Phase 1:** Prohibit new `any` in changed high-risk modules.
- [ ] **QLT-008 · P1 · Phase 1:** Add regression tests for every confirmed P0 defect before or with the fix.
- [ ] **QLT-009 · P1 · Phase 2:** Add Playwright buyer onboarding and sourcing journey.
- [ ] **QLT-010 · P1 · Phase 2:** Add Playwright supplier organic and conventional publishing journeys.
- [ ] **QLT-011 · P1 · Phase 2:** Add Playwright offer-to-settlement journey for each supported payment-plan class.
- [ ] **QLT-012 · P1 · Phase 2:** Add Playwright delivery exception and recall journey.
- [ ] **QLT-013 · P1 · Phase 2:** Add API idempotency and retry tests.
- [ ] **QLT-014 · P1 · Phase 2:** Add contract tests for storage, email, scanner and future provider adapters.
- [ ] **QLT-015 · P2 · Phase 3:** Establish critical-domain coverage reporting; focus on meaningful branch and failure coverage rather than a vanity percentage.
- [ ] **QLT-016 · P2 · Phase 3:** Add load tests for marketplace, trade actions, provenance and large trace graphs.
- [ ] **QLT-017 · P2 · Phase 3:** Add long-running migration and rollback rehearsal in staging.
- [ ] **QLT-018 · P2 · Phase 3:** Add test data builders/factories rather than coupling tests to the demo seed.
- [ ] **QLT-019 · P2 · Phase 3:** Add mutation or equivalent fault-injection testing for payment and inventory invariants.
- [ ] **QLT-020 · P3 · Phase 4:** Add cross-browser and visual-regression coverage for the investor and critical customer flows.

# 15. Observability, reliability and operations

- [ ] **OPS-001 · P0 · Phase 1:** Use managed PostgreSQL for staging/production with encryption, automated backups and point-in-time recovery.
- [ ] **OPS-002 · P0 · Phase 1:** Complete and record a successful database restore drill.
- [ ] **OPS-003 · P0 · Phase 1:** Add centralized structured logs with request/correlation IDs and secret redaction.
- [ ] **OPS-004 · P0 · Phase 1:** Add backend and frontend error monitoring with release version and environment.
- [ ] **OPS-005 · P1 · Phase 1:** Add uptime checks for web, API liveness and API readiness.
- [ ] **OPS-006 · P1 · Phase 1:** Alert on elevated 5xx, failed login abuse, authorization failures, queue backlog, DB exhaustion and storage scan failures.
- [ ] **OPS-007 · P1 · Phase 1:** Define on-call/incident owner and escalation contacts for the pilot.
- [ ] **OPS-008 · P1 · Phase 1:** Write incident-response, secret-rotation and customer-communication runbooks.
- [ ] **OPS-009 · P1 · Phase 1:** Write and exercise deployment rollback procedures.
- [ ] **OPS-010 · P1 · Phase 2:** Add a durable job queue with retries, dead-letter handling and idempotency.
- [ ] **OPS-011 · P1 · Phase 2:** Add database pool, query latency, HTTP latency and queue metrics.
- [ ] **OPS-012 · P1 · Phase 2:** Define pilot SLOs, initial alert thresholds, RPO and RTO.
- [ ] **OPS-013 · P2 · Phase 2:** Add data export and deletion operations with authorization and audit.
- [ ] **OPS-014 · P2 · Phase 3:** Add capacity budgets for database, storage, uploads and trace graph size.
- [ ] **OPS-015 · P2 · Phase 3:** Run a controlled incident exercise and capture follow-up work.
- [ ] **OPS-016 · P2 · Phase 3:** Add a public or customer-facing service-status mechanism before wider launch.
- [ ] **OPS-017 · P2 · Phase 3:** Test regional/data-residency requirements with actual pilot contracts.
- [ ] **OPS-018 · P3 · Phase 4:** Add horizontal-scaling validation and multi-instance rate-limit/job tests.

# 16. Privacy, legal and commercial controls

- [ ] **LEG-001 · P0 · Phase 1:** Publish pilot privacy notice and record acceptance.
- [ ] **LEG-002 · P0 · Phase 1:** Publish pilot terms of service and acceptable-use rules.
- [ ] **LEG-003 · P0 · Phase 1:** Prepare a design-partner/pilot agreement with known limitations and support boundary.
- [ ] **LEG-004 · P1 · Phase 1:** Define data controller/processor roles and prepare a DPA template.
- [ ] **LEG-005 · P1 · Phase 1:** Define retention, deletion, export and legal-hold policies.
- [ ] **LEG-006 · P1 · Phase 1:** Publish a subprocessor list for hosting, storage, email, monitoring and optional AI.
- [ ] **LEG-007 · P1 · Phase 1:** State clearly that CocoaTrace is not a certifier, bank, escrow provider, carrier, customs broker or legal compliance authority.
- [ ] **LEG-008 · P1 · Phase 2:** Define ownership and permitted use of uploaded evidence, product profiles and aggregated metrics.
- [ ] **LEG-009 · P1 · Phase 2:** Define responsibilities and remedies for false claims, fraud, disputes and recalled goods.
- [ ] **LEG-010 · P1 · Phase 2:** Define platform fee, invoicing, tax and payment terms.
- [ ] **LEG-011 · P2 · Phase 3:** Obtain legal review for the first production jurisdictions and trade corridor.
- [ ] **LEG-012 · P2 · Phase 3:** Add documented customer offboarding, deletion and evidence-export procedure.

# 17. Investor readiness, traction and company evidence

- [ ] **INV-001 · P0 · Phase 0:** Deploy an isolated, synthetic, resettable investor demo.
- [ ] **INV-002 · P0 · Phase 0:** Create and rehearse a five-minute buyer/supplier/payment/recall demo script.
- [ ] **INV-003 · P0 · Phase 0:** Ensure every action in the investor path works from a clean reset and has a graceful fallback.
- [ ] **INV-004 · P1 · Phase 1:** Produce a one-page architecture and security overview that matches reality.
- [ ] **INV-005 · P1 · Phase 1:** Maintain a current-versus-roadmap capability matrix to prevent overclaiming.
- [ ] **INV-006 · P1 · Phase 1:** Recruit target design partners: three suppliers/exporters, two buyers and supporting assurance/logistics participants.
- [ ] **INV-007 · P1 · Phase 2:** Capture signed pilot intent, problem evidence and willingness-to-pay hypotheses.
- [ ] **INV-008 · P1 · Phase 2:** Instrument time-to-first-value, completion, review time, support interventions and repeat usage.
- [ ] **INV-009 · P1 · Phase 2:** Complete at least two repeated workflows per initial supplier and one independent buyer review.
- [ ] **INV-010 · P1 · Phase 2:** Demonstrate 100% recipient identification in recorded tabletop recalls.
- [ ] **INV-011 · P2 · Phase 3:** Create an investor data room with product, market, architecture, security, roadmap, pilots, metrics and risk register.
- [ ] **INV-012 · P2 · Phase 3:** Document unit economics hypotheses: fee basis, acquisition channel, onboarding cost and support burden.
- [ ] **INV-013 · P2 · Phase 3:** Publish anonymized pilot case studies with permission.
- [ ] **INV-014 · P2 · Phase 3:** Maintain a defensibility narrative grounded in accumulated workflow, evidence and traceability data—not generic AI claims.
- [ ] **INV-015 · P2 · Phase 4:** Assemble technical due-diligence evidence: test results, architecture decisions, incidents, restore drill, security review and release history.
- [ ] **INV-016 · P2 · Phase 4:** Reassess fundraising readiness against product usage, customer commitments, team and technical risk; do not infer valuation from feature count.

---

# Phase exit gates

## Phase 0 — investor-safe stabilization

- [ ] Production image does not seed demo data.
- [ ] Demo-only routes and credentials cannot appear outside demo.
- [ ] Demo, staging and production resources are isolated.
- [ ] Investor story works from a clean reset.
- [ ] Product claims match implemented capability.
- [ ] Repository planning and contribution process is active.

## Phase 1 — controlled pilot foundation

- [ ] Known tenant leaks are fixed and multi-organization tests pass.
- [ ] Production-like evidence storage is private, scanned and permission-controlled.
- [ ] Trust states no longer mislabel self-declared data.
- [ ] Inventory cannot be oversold or transferred while committed.
- [ ] Approved-organization registration, invitation, reset and revocation work.
- [ ] Managed database backup and restore drill pass.
- [ ] Monitoring, alerts and incident ownership are active.
- [ ] Pilot privacy, terms and agreements are ready.

## Phase 2 — complete customer MVP

- [ ] Buyer and supplier complete the deal without navigating disconnected modules.
- [ ] Payment, document release, transport and delivery states agree.
- [ ] Delivery requires appropriate buyer confirmation or recorded exception.
- [ ] Recall activation blocks supply and notifies/records recipients.
- [ ] Critical browser journeys pass in staging.
- [ ] Platform fee workflow and commercial boundary are documented.
- [ ] Pilot metrics are collected and reviewed.

## Phase 3 — investable platform

- [ ] High-risk modules follow the target architecture.
- [ ] SQL and authorization are no longer spread through HTTP controllers.
- [ ] OpenAPI, contribution standards and quality gates are enforced.
- [ ] Operational SLOs, incident exercise and load tests are complete.
- [ ] Design partners demonstrate repeat use and buyer value.
- [ ] Investor data room and technical due-diligence evidence are current.

## Phase 4 — production and scale proof

- [ ] Independent security review has no unresolved critical findings.
- [ ] Production launch checklist, rollback and restore are exercised.
- [ ] Performance and capacity meet agreed pilot/customer volumes.
- [ ] Commodity expansion uses configurable primitives and validated demand.
- [ ] Fundraising readiness is supported by traction, economics and technical evidence.

# Definition of done for every backlog item

An item is complete only when applicable criteria are met:

- [ ] Acceptance behavior is explicit and demonstrated.
- [ ] Authorization and tenant impact were considered.
- [ ] Failure paths and rollback behavior were considered.
- [ ] Unit, integration and/or E2E tests cover the risk introduced or repaired.
- [ ] Database changes use a new forward migration and have upgrade/rollback notes.
- [ ] Logs contain useful context without secrets or unnecessary personal data.
- [ ] User-facing errors explain the next safe action.
- [ ] Documentation, API contract and runbooks are updated.
- [ ] CI passes.
- [ ] Staging verification passes.
- [ ] No unrelated demo behavior or customer data was introduced.
- [ ] This backlog and any linked issue are updated.

# Open decisions requiring explicit ADRs

- [ ] **DEC-001:** Hosting and regional deployment provider
- [ ] **DEC-002:** Revocable session architecture
- [ ] **DEC-003:** Application policies versus PostgreSQL RLS boundaries
- [ ] **DEC-004:** Object storage, malware scanner and evidence lifecycle
- [ ] **DEC-005:** Email provider and transactional notification ownership
- [ ] **DEC-006:** Background job/queue implementation
- [ ] **DEC-007:** Organization approval and business-verification standard
- [ ] **DEC-008:** Legal meaning of deal/contract records and e-signature boundary
- [ ] **DEC-009:** Platform fee invoicing and collection model
- [ ] **DEC-010:** Initial supported commodity/corridor and expansion criteria
- [ ] **DEC-011:** Transformation/blending feature scope
- [ ] **DEC-012:** Analytics, consent and data-retention model

# Known current risks

| Risk | Severity | Current mitigation | Closure items |
| --- | --- | --- | --- |
| Demo credentials/data reach a production-like deployment | Critical | Documentation warning only | ENV-001–006, IDN-001 |
| Cross-tenant farm/provenance/profile/certificate access | Critical | Partial controller checks | SEC-001–006, QLT-001–002 |
| Uploaded evidence bypasses protected download route | Critical | Random storage name only | UPL-001–010 |
| Self-entered records appear verified/approved | Critical | Organic attestation on batches only | DAT-001–010 |
| Same inventory can underpin inconsistent contracts | Critical | Some application quantity checks | TRD-001–009 |
| Recall notice does not quarantine affected supply | Critical | Public notice and calculation | RCL-001–010 |
| Critical audit events can fail after business commit | High | Warning log | ARC-013–014 |
| Real users lack reset/MFA/revocation lifecycle | High | Invite and password login | IDN-008–014 |
| No database integration or browser E2E suite | High | 50 unit-focused API tests | QLT-001–018 |
| Large, coupled files slow safe inheritance | Medium | TypeScript build | ARC-004–023 |
| No restore/monitoring/incident proof | High | Health endpoints and structured logger | OPS-001–012 |
| Marketing claims exceed implemented transformations | Medium | Demo genealogy | PRD-001, RCL-011, INV-005 |
