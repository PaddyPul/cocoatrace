# CocoaTrace delivery backlog

**Purpose:** Single source of truth for work required to move CocoaTrace from a passion project to an investor-ready, pilot-safe and production-capable company.  
**North Star:** [`NORTH_STAR.md`](./NORTH_STAR.md)  
**Architecture direction:** [`ARCHITECTURE_MODERNIZATION.md`](./ARCHITECTURE_MODERNIZATION.md)  
**Last triaged:** 2026-10-06
**Next formal review:** Weekly, before selecting new work

## How to use this file

1. Every material change must reference one or more backlog IDs.
2. Select work from **Current execution queue** unless a new P0 incident supersedes it.
3. Move an item to complete only after its stated outcome and the repository definition of done are met.
4. Add newly discovered work to the appropriate section with an ID, priority, phase and completion test.
5. Do not hide unfinished scope inside a pull request. Create follow-up items before merging.
6. At the end of each work session, update checkboxes, the current queue, risks and `Last triaged` if priorities changed.
7. Automate repeatable browser journeys in each sprint. Bundle handoffs should require automated checks plus a short targeted smoke test, not repeat the entire manual regression suite. Real-provider delivery, usability and new behavior still require focused human verification.
8. Every bundle handoff includes guarded apply/test/start/push/merge/pull commands and a tailored PR title/description, with actual and pending verification distinguished.

When asked “what needs to be done?”, start with incomplete items in the current execution queue, then the active phase exit criteria, then blocked P0/P1 work.

Current zero-budget implementation: **BST-001** supervised synthetic preview runner and email-restricted temporary HTTPS. See [`runbooks/ZERO_COST_DEMO_PREVIEW.md`](runbooks/ZERO_COST_DEMO_PREVIEW.md). Founder confirmed native preview startup and allowed-email PIN access on 2026-10-02; anonymous probe denial passed. Live staging and an independently tested unlisted visitor remain separate.

## Bootstrap budget and expansion constraints

Hosting budget is **USD 0/month** until the founder explicitly changes it. Do not activate paid plans, auto-upgrades, metered overages or trial-dependent infrastructure. See [`runbooks/FREE_STAGING_PLAN.md`](runbooks/FREE_STAGING_PLAN.md). Provider signup and account verification belong to the founder; repository configuration and automation belong to the implementation work. Free hosting does not waive private uploads, malware scanning, tenant isolation or restore gates.

Hosting follow-ups **BST-001–003** and their completion tests are maintained in the linked free-staging runbook; include them when counting the backlog.

### Multi-currency

- [ ] **CUR-001 · IN PROGRESS · P1 · Phase 2:** Agree pilot currencies and document a currency policy. One explicit ISO currency per listing, offer and accepted contract; distinguish trade currency from display preferences. Completion: approved supported-currency matrix and mismatch rules.
- [ ] **CUR-002 · IN PROGRESS · P1 · Phase 2:** Carry contract currency through payment installments, fees, invoices, refunds and reconciliation; API rejects incompatible offers/payments. Preserve existing recorded currencies during migration. Completion: end-to-end tests prove no silent currency changes.
- [ ] **CUR-003 · IN PROGRESS · P1 · Phase 2:** Centralize exact monetary arithmetic and rounding by currency minor units; never use floating-point money calculations. Completion: boundary tests cover two-decimal and zero-decimal currencies, installments and fee totals.
- [ ] **CUR-004 · P2 · Phase 3:** Add user display-currency preferences with explicitly indicative FX quotes including source, timestamp and rate snapshot. Original contractual amounts remain visible. Completion: stale/missing-rate and historical-quote tests pass.
- [ ] **CUR-005 · P2 · Phase 3:** Specify actual FX conversion/settlement separately with provider support, fees, consent and audit records before enabling it. Completion: approved design and sandbox reconciliation; display conversion never moves funds.

### Multi-language

- [-] **LNG-001 · P1 · Phase 2 · IN PROGRESS:** Select pilot languages with users; introduce translation catalogs, English fallback and persisted user language preference. Completion: no hard-coded customer-facing strings in the first translated trade journey.
- [-] **LNG-002 · P1 · Phase 2 · IN PROGRESS:** Translate onboarding, sourcing, offers, guided dashboard, payment and delivery actions plus actionable API errors using stable error codes. Completion: buyer and supplier browser journeys pass in two selected locales.
- [-] **LNG-003 · P1 · Phase 2 · IN PROGRESS:** Localize recipient emails and notifications and format dates, quantities and currency using locale-aware helpers. Validate localized number input without changing commercial units. Completion: decimal/date ambiguity and fallback tests pass.
- [ ] **LNG-004 · P2 · Phase 3:** Define authoritative contract/document languages, reviewed translations and clearly labeled translated summaries; preserve original evidence and user-entered text. Completion: versioned language policy and review workflow, with no automatic replacement of legal records.
- [ ] **LNG-005 · P2 · Phase 3:** Human-review pilot translations and test keyboard access, longer text and missing keys; design for later RTL support. Completion: translation QA checklist and automated overflow/fallback coverage.

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

## Progress snapshot — 2026-10-06

Interpreting the founder's latest “done” as completion of the prescribed release checks and merge/pull, the canonical backlog contains **307 named items: 64 complete (20.8%), 30 in progress (9.8%), and 213 not started (69.4%)**. This corrects the previously reported denominator of 310 by recounting every named backlog row; it does not credit new completions. Items are counted equally, with no fractional completion credit. Started work is **30.6%**; that is not a completion measure.

The denominator includes engineering, operations, design-partner validation, fundraising evidence, multi-currency, multi-language and later expansion. It measures the exhaustive roadmap, not usability of the existing app or a percentage of an $8M valuation. Native/CI completion here is founder-reported; independent CI URL archival remains open. Partially implemented suspension, real email delivery, hosted restore, disposal/segregation and recall deadline/external-recipient workflows stay open.

## Current execution queue

Select the next coherent batch from this queue. Completed-wave history and evidence are maintained in [`RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md), rather than occupying the active queue.

1. **Container security release — SEC-014:** dependency fixes are founder-reported merged. Multi-stage API runtime, supported Node 24 bases, unprivileged Nginx and fail-closed OS/library image scans implemented; founder confirmed release/merge/pull on 2026-10-05 after the package-manager correction. Remaining image/digest/build-tool scope stays open. The unpatched build-only braces advisory, third-party service images and digest promotion remain open. See `runbooks/CONTAINER_SECURITY.md`.
2. **Unstarted bilateral cancellation — LOG-006, TRD-017:** scoped request/review, payment/security/transport guards, exact committed-stock release, estimated-fee voiding and immutable audit history implemented. Founder confirms cancellation merged and pulled. Paid cancellation, partial settlement, refunds and returns still require explicit financial and inventory policies.
3. **Payment-term workflow extraction — ARC-006, ARC-019, QLT-007:** proposal/confirmation are moved from HTTP controllers into a typed transaction service; contract-first locking, closed-contract guards, retry and rollback regressions implemented. Founder confirms payment-term extraction merged and pulled. Continue other state-machine extraction incrementally.
4. **Commercial operations — PAY-011–PAY-013:** recorded seller/completion fee policy, decimal fee snapshots, in-app commercial statements, separate payer submission/platform receipt verification, controlled rejection/write-off and currency-separated JSON reconciliation implemented. Founder confirms the fee ledger merged and pulled. Tax, real collection instructions, emailed invoices, bank reconciliation and production commercial approval remain open.
5. **Trade currency foundation — CUR-001–CUR-003:** EUR/USD/GHS/GBP plus snapshotted JPY precision policy, offer/acceptance mismatch rejection, currency-preserving publication/buyer UI, exact decimal contract totals/deposit allocations, and payment/transport/settlement drift guards implemented. Founder confirms the four-currency foundation merged. Founder confirms the JPY zero-decimal snapshot extension tested, merged and pulled on 2026-10-06; independent CI archival remains open. Three-decimal currencies, refunds, FX and display preferences remain open. See `runbooks/CURRENCY_PRECISION.md`. See `runbooks/TRADE_CURRENCY.md`.
6. **Language foundation — LNG-001–LNG-003:** English/French shell catalogs, English fallback, account-separated device preferences, translated workspace navigation/search and locale display helpers implemented. New unit and browser regressions are included. Native browser/release confirmation pending. Full trade forms/dashboard actions, server-persisted cross-device preferences, recipient emails, localized input validation and pilot/human translation approval remain open. See `runbooks/LANGUAGE_FOUNDATION.md`.
7. **Controlled pilot and live environment gates — IDN-005, IDN-021, ENV-004–ENV-006, OPS-001–OPS-002, BST-002–BST-003:** actual approved design partners, real email delivery, private storage and a verified hosted restore under the zero-budget constraint. Provider eligibility and customer participation remain external dependencies.

The following deployment work is a **parallel external gate**, not repository-complete work: **ENV-004–ENV-006, UPL-002, OPS-001–OPS-002**. A named infrastructure owner must provision isolated staging resources, private encrypted object storage, HTTPS/secrets, managed database recovery and a recorded restore drill. Repository tests and local Docker do not close those items.

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
- [-] **ENV-007 · P1 · Phase 0:** Add an ephemeral PostgreSQL service to CI and apply all migrations from zero. IN PROGRESS: `migration-startup` now builds the API image and runs the normal release command against isolated PostgreSQL 16; native CI evidence is pending.
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
- [x] **ENV-019 · P0 · Phase 1:** Repair empty-database bootstrap and rehearse both fresh startup and existing-database upgrade. Discovered 2026-10-01: migration 001 loads the frozen schema snapshot through 010, then migration 009 attempts to add an existing `batches.source_mode` column. Done when the normal release migration command succeeds from empty PostgreSQL and upgrades an existing ledger without resetting data or changing frozen migrations/checksums. The browser/API test baseline preparation does not close this production release blocker. IMPLEMENTED: normal-runner bootstrap repair and production-configured fresh/upgrade regressions are implemented. API build, 144 unit tests, migration integrity and nine nonconcurrent CLI scenarios passed locally against temporary WASM PostgreSQL. Native PostgreSQL/container CI evidence, including concurrency, remains required. See ADR 001 and `docs/runbooks/MIGRATION_STARTUP.md`. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.

# 3. Architecture and code quality

- [x] **ARC-001 · P1 · Phase 1:** Add a typed `config/` module and remove scattered environment parsing.
- [ ] **ARC-002 · P1 · Phase 1:** Define shared actor, organization scope, money, quantity and identifier types.
- [ ] **ARC-003 · P1 · Phase 1:** Create reusable resource policy interfaces and move authorization decisions out of controllers.
- [ ] **ARC-004 · P1 · Phase 1:** Extract evidence controller logic into service, policy, repository and infrastructure adapters.
- [x] **ARC-005 · P1 · Phase 1:** Extract offer acceptance and inventory reservation into one transactional trading use case. IMPLEMENTED: Offer acceptance, stock commitment and fulfillment creation are extracted into the trading module; native integration/CI validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **ARC-006 · P1 · Phase 2:** Extract payment-plan and installment state machines. IN PROGRESS: typed payment-term proposal/confirmation use cases and next-state mapping extracted, with transaction/audit and authorization regressions; founder confirms this wave merged/pulled; other payment state transitions remain open.
- [ ] **ARC-007 · P1 · Phase 2:** Extract shipment and delivery state machines.
- [ ] **ARC-008 · P1 · Phase 2:** Extract recall activation, notification and resolution use cases.
- [ ] **ARC-009 · P2 · Phase 2:** Split public product administration, public rendering and recall code into separate modules.
- [ ] **ARC-010 · P2 · Phase 2:** Replace duplicated provenance view/export logic with one provenance builder and response mappers.
- [ ] **ARC-011 · P2 · Phase 2:** Move SQL from migrated controllers into repositories/query modules.
- [x] **ARC-012 · P2 · Phase 2:** Introduce a transaction boundary abstraction used by application services. IMPLEMENTED: Shared trading transaction boundary commits business mutations and audit events together; rollback tests are implemented. Native validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [ ] **ARC-013 · P1 · Phase 2:** Write critical business changes, audit records and outbox events atomically.
- [ ] **ARC-014 · P2 · Phase 3:** Add a transactional outbox and idempotent worker for email, alerts and external callbacks.
- [ ] **ARC-015 · P2 · Phase 3:** Split `web/src/pages/DataPages.tsx` into feature-owned routes and components.
- [ ] **ARC-016 · P2 · Phase 3:** Split `web/src/api.ts` into a shared HTTP client and feature clients.
- [ ] **ARC-017 · P2 · Phase 3:** Split `web/src/types.ts` into module-owned schemas and domain types.
- [ ] **ARC-018 · P2 · Phase 3:** Refactor batch, contract and shipment route components into focused components and hooks.
- [-] **ARC-019 · P2 · Phase 3:** Replace compressed multi-operation functions with readable, named use cases. IN PROGRESS: contract payment-term handlers are HTTP adapters over named typed use cases; remaining controllers and native verification stay open.
- [ ] **ARC-020 · P2 · Phase 3:** Eliminate `any` from high-risk domain, authorization, payment, evidence and traceability paths.
- [ ] **ARC-021 · P2 · Phase 3:** Publish and maintain an OpenAPI specification.
- [ ] **ARC-022 · P2 · Phase 3:** Generate or strongly type the frontend API boundary from the OpenAPI contract.
- [ ] **ARC-023 · P2 · Phase 3:** Introduce stable error codes and a consistent API error envelope.
- [ ] **ARC-024 · P2 · Phase 3:** Add pagination and bounded queries to list/export endpoints.
- [ ] **ARC-025 · P2 · Phase 3:** Remove the unused sessions design or make it the authoritative revocable session system.
- [ ] **ARC-026 · P3 · Phase 4:** Add commodity policy/configuration interfaces before onboarding the second commodity.
- [ ] **ARC-027 · P3 · Phase 4:** Add transformation workflow ports and domain types only when a validated customer requires blending/repacking.
- [x] **ARC-028 · P2 · Phase 2:** Audit package-script entry points and remove or repair obsolete aliases. Discovered 2026-10-01: `api` scripts `db:migrate:js` and `db:seed:js` reference absent files. Done when documented commands resolve to supported runners and a lightweight script-contract check prevents recurrence. CLOSED 2026-10-05: founder reports quality gate/correction tested, merged and pulled.

# 4. Identity, registration and organizations

- [ ] **IDN-001 · P0 · Phase 1:** Remove every shared demo account from staging and production.
- [x] **IDN-002 · P1 · Phase 1:** Implement “Request access” for buyer and supplier organizations. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [-] **IDN-003 · P1 · Phase 1:** Add organization states: application pending, review pending, verified, rejected and suspended. IN PROGRESS: application approval/rejection and reviewer auditing implemented; full suspension lifecycle and real pilot enrollment remain open.
- [x] **IDN-004 · P1 · Phase 1:** Require email verification before an organization application can proceed. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [-] **IDN-005 · P1 · Phase 1:** Manually approve the first pilot organizations and record reviewer/time/reason. IN PROGRESS: approval/rejection and reviewer auditing are implemented; real pilot enrollment remains open.
- [x] **IDN-006 · P1 · Phase 1:** Create the first organization administrator only after organization approval. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-007 · P1 · Phase 1:** Keep additional users invitation-only during the pilot. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-008 · P1 · Phase 1:** Send invitation emails; add resend, revoke and expiry controls. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
  - Repository implementation now sends first-admin approval invitations, records invitation submission outcomes, hides bearer links outside demo/test, rotates verification/resend links, and prevents resend from reviving revocation. Local capture inbox and regression tests added. Windows PostgreSQL tests and staging inbox verification remain release gates. Local UI testing previously confirmed delivery was suppressed by the development adapter. Before pilot release, configure SMTP separately for staging/production, and verify recipient inbox delivery for email verification, first-admin invitation, team invitation/resend and password reset. Exercise delivery failure and safe retry; never report an email as sent when suppressed. See `docs/runbooks/IDENTITY_EMAIL_DELIVERY.md`.
- [x] **IDN-009 · P0 · Phase 1:** Implement password reset with single-use hashed tokens, uniform responses and rate limits. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-010 · P1 · Phase 1:** Implement password change and revoke other sessions after sensitive account changes. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
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
- [-] **IDN-021 · P1 · Phase 1:** Complete identity email delivery setup and end-to-end inbox verification. Done when verification, approval invitation, team invitation/resend and password reset arrive in the intended inbox in staging, expired/revoked/reused links are rejected, and delivery failures can be retried without creating duplicate organizations or accounts. Local demo links alone do not close this item. User reports all local identity/email checks passed on 2026-10-01; real provider and staging inbox verification remain open.

# 5. Authorization and application security

- [x] **SEC-001 · P0 · Phase 1:** Document route/resource authorization matrix with explicit network-wide permissions. See [`security/AUTHORIZATION_MATRIX.md`](security/AUTHORIZATION_MATRIX.md).
- [x] **SEC-002 · P0 · Phase 1:** Farm, certificate, batch, product-profile, provenance, evidence and indirect contract IDOR fixes pass the real-PostgreSQL two-tenant regression suite.
- [x] **SEC-003 · P0 · Phase 1:** Ordinary reads are tenant/relationship bounded, explicit `*.all`/`*.network` grants are exercised, and ordinary users cannot inherit network-wide reads.
- [x] **SEC-004 · P0 · Phase 1:** Provenance binds `contractId` to both the batch and an authorized contract party; direct and export splicing regressions pass against PostgreSQL.
- [x] **SEC-005 · P0 · Phase 1:** Contract document listing, attachment and download inherit contract-party authorization and reject unrelated organizations in PostgreSQL tests.
- [ ] **SEC-006 · P1 · Phase 1:** Decide whether unauthorized resources consistently return `403` or non-disclosing `404` and test it.
- [ ] **SEC-007 · P1 · Phase 1:** Add CSRF/origin tests for every cookie-authenticated state-changing request.
- [ ] **SEC-008 · P1 · Phase 1:** Add a restrictive Content Security Policy and verify public profile assets.
- [ ] **SEC-009 · P1 · Phase 1:** Review all outbound/tracking/hero URLs against allowlist and safe rendering rules.
- [ ] **SEC-010 · P1 · Phase 1:** Add request-body and query-size limits globally.
- [ ] **SEC-011 · P1 · Phase 1:** Add bounded rate limits for public scan, QR, login, reset, invitation and upload-intent endpoints.
- [ ] **SEC-012 · P1 · Phase 1:** Move production secrets to a managed secret store and rotate existing secrets.
- [ ] **SEC-013 · P1 · Phase 1:** Add secret scanning to CI and repository settings.
- [-] **SEC-014 · P1 · Phase 1:** Add dependency and container vulnerability scanning; remediate or accept findings explicitly. Founder npm ci output on 2026-10-05 reports 13 findings (6 moderate, 6 high, 1 critical); capture the detailed dependency paths and runtime exposure before choosing tested upgrades. IN PROGRESS: targeted patched dependencies, production/full audit CI and release gates, weekly review and exact expiring build-only exception implemented in this wave. Dependency fixes are founder-reported merged. This wave adds reduced runtime images, non-root assertions and OS/library scanning; actual Docker/CI verification, third-party images, digest promotion and removal of the unpatched build-tool tree remain open.
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

- [x] **DAT-001 · P0 · Phase 1 — VERIFIED:** Forward migration 021 replaces optimistic defaults with pending/self-declared/unknown. Workspace approval remains separate from independent verification. Native release validation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **DAT-002 · P0 · Phase 1 — VERIFIED:** Migration 021 downgrades unsupported legacy farm/plot/evidence decisions with a per-field correction ledger and read-only `trust:report`. Seed flags cannot grant effective verification. Native upgrade validation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **DAT-003 · P1 · Phase 1 — IN PROGRESS:** Independent certificate issuance/attestation records source, actual reviewer, method, time, expiry and audit atomically. Customer-facing trust summaries expose review provenance without private document URLs. A general origin/EUDR/evidence review workflow remains future work; native release validation pending.
- [x] **DAT-004 · P1 · Phase 1:** Certificate issue and attestation validate farmer organization against farm ownership, with a real-PostgreSQL cross-tenant regression.
- [-] **DAT-005 · P1 · Phase 1 — IN PROGRESS:** Attestation validates certificate subject, crop scope and harvest-date coverage. PostgreSQL regressions cover mismatched subject and crop; add an out-of-validity harvest-date regression before closing this item.
- [ ] **DAT-006 · P1 · Phase 1:** Prevent contradictory duplicate active certificates.
- [-] **DAT-007 · P1 · Phase 2:** Live batch/listing/passport/provenance trust now reflects suspension/revocation/expiry. Audited reinstatement applies only to valid suspended certificates. Deal protections and proactive alerts remain open.
- [x] **DAT-008 · P1 · Phase 2:** Marketplace and public product labels derive from current scoped certificates and documented reviews; API/UI regressions implemented. Native validation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **DAT-009 · P1 · Phase 2:** Shared claim presentation distinguishes declaration, independent review, expiry, revocation and unknown; details include source and reviewer. Native validation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [ ] **DAT-010 · P1 · Phase 2:** Add evidence requirements by claim type rather than accepting arbitrary labels.
- [ ] **DAT-011 · P2 · Phase 2:** Introduce configurable assurance schemes rather than hard-coded organic/EUDR assumptions.
- [ ] **DAT-012 · P2 · Phase 3:** Add history/effective dates so past decisions remain explainable after claim changes.
- [ ] **DAT-013 · P2 · Phase 3:** Add data-quality reports for missing, contradictory, stale and impossible records.
- [ ] **DAT-014 · P2 · Phase 3:** Define master-data ownership for organization, farm, plot, material and product identifiers.

# 8. Inventory, marketplace, offers and agreements

- [x] **TRD-001 · P0 · Phase 1:** Add transactional inventory reservation with row locks during offer acceptance. IMPLEMENTED: Holding locks and atomic commitment are implemented; competing native PostgreSQL acceptance tests remain a release gate. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-002 · P0 · Phase 1:** Deactivate or resize every incompatible listing sharing a committed holding. IMPLEMENTED: Shared reconciliation resizes/deactivates incompatible listings and rejects oversized competing offers in the transaction; partial acceptance preserves the unsold advertised quantity as a continuation listing; native validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-003 · P0 · Phase 1:** Reject acceptance when listing is inactive, offer expired or holding not available. IMPLEMENTED: Acceptance checks live offer expiry, listing activation, holding availability and ownership under locks; native validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-004 · P0 · Phase 1:** Prevent listing create/update above unreserved quantity. IMPLEMENTED: Listing create/edit and batch marketplace publication enforce the combined active-listing budget after requested transfer reservations; native validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-005 · P0 · Phase 1:** Prevent custody transfer or split of reserved/committed inventory. IMPLEMENTED: Committed holding mutations are refused; pending custody transfers reserve quantity and prevent splitting; native validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-006 · P0 · Phase 1:** Lock transfer and holding rows when accepting transfers. IMPLEMENTED: Transfer acceptance locks holdings, listings and transfer rows and preserves historical source quantities; native race validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-007 · P0 · Phase 1:** Add database constraints for positive quantities, legal statuses and one agreement per accepted offer. IMPLEMENTED: Forward migration 020 preflights existing rows and adds quantity/state checks plus unique offer-to-agreement enforcement without rewriting history; native migration validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-008 · P1 · Phase 1:** Add reconciliation invariants across source quantity, holdings, reservations, commitments and distributions. IMPLEMENTED: Independent read-only trade reconciliation and an operational command are implemented; legacy findings require review and native validation is pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-009 · P1 · Phase 1:** Add concurrency tests for simultaneous offers, listings, transfers and acceptance. IMPLEMENTED: Twenty-four trading integration tests cover races, quantity conservation, authorization, rollback, database constraints, batch publication and reconciliation. Native PostgreSQL/Docker execution is still pending; this item is not complete. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [ ] **TRD-010 · P1 · Phase 2:** Allow buyers to withdraw pending offers.
- [ ] **TRD-011 · P1 · Phase 2:** Add seller rejection reason and immutable history.
- [ ] **TRD-012 · P1 · Phase 2:** Implement a bounded counteroffer flow or explicitly mark negotiation external.
- [ ] **TRD-013 · P1 · Phase 2:** Enforce offer currency/validity rules and listing compatibility.
- [ ] **TRD-014 · P1 · Phase 2:** Snapshot accepted price, quantity, Incoterm, locations and assurance requirements.
- [ ] **TRD-015 · P1 · Phase 2:** Add agreement version, explicit acceptance by both parties and acceptance timestamp.
- [ ] **TRD-016 · P1 · Phase 2:** Rename “sales contract” where no legally executed contract exists, or add signed-document support.
- [-] **TRD-017 · P1 · Phase 2:** Add cancellation, dispute and administrator-resolution states. IN PROGRESS: bilateral unstarted cancellation with critical audit and exact stock release implemented; native verification, paid cancellation, broader disputes and administrator resolution remain open.
- [ ] **TRD-018 · P2 · Phase 2:** Award/close the originating sourcing request when appropriate.
- [ ] **TRD-019 · P2 · Phase 3:** Add marketplace pagination, search indexes and deterministic match explanations.
- [ ] **TRD-020 · P2 · Phase 3:** Add listing expiry and supplier renewal workflows.

# 9. Payments, fees and financial boundaries

- [x] **PAY-001 · P0 · Phase 1:** IMPLEMENTED: every-plan integration coverage, pickup/handover/loading/departure gates, scan-clean documents and five actual browser journeys. Authoring checks pass; native PostgreSQL concurrency and complete release gate confirmation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-002 · P1 · Phase 1:** Explicit no-funds/no-escrow copy in the deal room and payment schedule; external bank security is seller-accepted, not platform-authenticated. Browser journeys pass in authoring.
- [x] **PAY-003 · P1 · Phase 2:** IMPLEMENTED: supplier-selected, buyer-confirmed per-installment proof requirement, private scanned buyer uploads, contract/tenant/type checks, stored-file checks and proof reuse prevention. Existing agreed terms are preserved. Native release confirmation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-004 · P1 · Phase 2:** Separate buyer submission, seller confirmation, rejection and dispute histories. CLOSED 2026-10-02: payment operations wave tested and merged per founder confirmation; correction 7b2d5ce fixed the settlement SQL ambiguity.
- [x] **PAY-005 · P1 · Phase 2:** IMPLEMENTED: state-based retry safety for submission, confirmation, rejection, document presentation and bank security; atomic audits, contract-first locking and exact NUMERIC receipt totals. Native simultaneous-request regression remains pending execution. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-006 · P1 · Phase 2:** Prevent one party from unilaterally satisfying incompatible payment and delivery conditions. IMPLEMENTED: physical delivery no longer settles; buyer acceptance and seller receipt verification are both required. Founder confirmed tested and merged on 2026-10-02.
- [x] **PAY-007 · P1 · Phase 2:** IMPLEMENTED: five-plan policy in [`runbooks/PAYMENT_DOCUMENT_RULES.md`](runbooks/PAYMENT_DOCUMENT_RULES.md), contract/shipment download gating and safe document-presentation checks. Native release confirmation pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-008 · P1 · Phase 2:** Add overdue installment calculation and reminders. Founder reports release verification and merge/pull complete including the system-audit correction. Disabled email retains the queue; SMTP acceptance is distinct from inbox delivery.
- [x] **PAY-009 · P1 · Phase 2:** Add correction/reversal procedure without deleting history. CLOSED 2026-10-02: bilateral reference/receipt corrections and durable audit events tested and merged per founder confirmation; this records external payments and does not refund funds.
- [x] **PAY-010 · P1 · Phase 2:** Define how bank guarantees/LC references are independently checked or explicitly marked seller-accepted only. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **PAY-011 · P1 · Phase 2:** Define platform fee payer, tax treatment, invoice timing and collection process. IN PROGRESS: existing seller-paid policy is versioned on acceptance, exact fee amount is recorded and becomes due at trade completion; external payment references are explicitly separate from goods payment. Tax, bank/channel instructions and production commercial approval remain open.
- [-] **PAY-012 · P1 · Phase 2:** Implement platform fee invoice delivery and paid/write-off status. IN PROGRESS: in-app commercial statement/download, platform-only receipt verification/rejection, reasoned write-off and retained submission/audit history implemented. Native verification, official tax invoices and outbound email delivery remain open.
- [-] **PAY-013 · P2 · Phase 3:** Reconcile fee invoices against completed deals and finance exports. IN PROGRESS: read-only consistent-snapshot ledger report checks amount/currency/payer/state/receipt history and exports statements plus currency-separated totals as JSON. Native verification and actual bank/provider reconciliation remain open.
- [ ] **PAY-014 · P3 · Phase 4:** Evaluate regulated payment-provider integrations only after the manual workflow and demand are proven.

# 10. Logistics, delivery and external transport

- [ ] **LOG-001 · P1 · Phase 1:** Preserve Incoterm-based transport coordinator assignment and test every supported term.
- [ ] **LOG-002 · P1 · Phase 2:** Define which party may record each milestone and which may only observe it.
- [ ] **LOG-003 · P1 · Phase 2:** Require essential arrangement fields before departure-relevant milestones.
- [ ] **LOG-004 · P1 · Phase 2:** Decide whether milestone skipping is allowed; encode required predecessors explicitly.
- [x] **LOG-005 · P1 · Phase 2:** Add buyer delivery confirmation distinct from a reported delivery milestone. IMPLEMENTED: separate buyer inspection/acceptance, exact quantity, retry-safe auditable acceptance and settlement guard. Founder confirmed tested and merged on 2026-10-02. See runbooks/DELIVERY_ACCEPTANCE.md.
- [-] **LOG-006 · P1 · Phase 2:** Add shortages, damage, rejection and delivery-dispute flows. IN PROGRESS: evidence-backed reports, supplier proposal and buyer approval with settlement hold implemented; bilateral unstarted cancellation implemented with guarded stock release; native verification, partial settlement, refunds, paid cancellation and returned inventory remain explicit follow-up scope.
- [x] **LOG-007 · P1 · Phase 2:** Prevent automatic settlement while a delivery dispute is open. Implemented and founder-tested with delivery acceptance; founder confirmed release testing and merge on 2026-10-02.
- [ ] **LOG-008 · P1 · Phase 2:** Require reason, acknowledgement and notification for exceptional dispatch.
- [ ] **LOG-009 · P1 · Phase 2:** Attach transport documents through the controlled evidence workflow.
- [ ] **LOG-010 · P2 · Phase 3:** Add ETA changes, delay reasons and overdue milestone alerts.
- [ ] **LOG-011 · P2 · Phase 3:** Add optional provider tracking links with URL safety validation.
- [ ] **LOG-012 · P3 · Phase 4:** Add carrier/provider integrations only through optional adapters; keep manual external arrangements first-class.

# 11. Traceability and recall

- [x] **RCL-001 · P0 · Phase 2 — VERIFIED:** Migration 022 backfills active notices into explicit lot/holding safety holds; activation is atomic and quantities/ownership remain unchanged. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **RCL-002 · P0 · Phase 2 — VERIFIED:** Active recalled supply is withdrawn and server-gated across publication, offers, custody transfers/splits and physical dispatch, including payment-exception and milestone-skip attempts. Receipt containment remains available; resolution never auto-republishes. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **RCL-003 · P1 · Phase 2 — IN PROGRESS:** Actual owners, holders, contract counterparties and distribution recipients enter a durable leased email outbox. Native validation pending; SMTP acceptance is separate from acknowledgement. External nonmember recipients and delivery webhooks remain open.
- [-] **RCL-004 · P1 · Phase 2 — IN PROGRESS:** Own-organization acknowledgement and manager contacted/unreachable/escalated records implemented with transactional audit. Native validation pending; automated deadlines remain open.
- [-] **RCL-005 · P1 · Phase 2 — IN PROGRESS:** Holder-only recovery snapshots validate three-decimal quantities against current holdings, excluding transferred history. Returned/destroyed stock keeps the batch blocked after closure. Native validation and separate physical segregation/write-off workflow remain open.
- [x] **RCL-006 · P1 · Phase 2 — VERIFIED:** Closure requires authorized manager, reason, exact-recall clean evidence, all acknowledgements and complete nonquarantined accounting. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **RCL-007 · P1 · Phase 2 — VERIFIED:** Closed response records, decision proof references and public notice history retained; public pages reflect remaining safety holds. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
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
- [x] **QLT-004 · P0 · Phase 1:** Real-PostgreSQL integration tests cover linked-resource upload authorization, private quarantine, extension/MIME/signature validation, file and tenant quota limits, EICAR rejection and audit, quarantine deletion, scan-clean download gating and unauthenticated `/uploads` denial. The Docker harness additionally exercises S3-compatible storage and ClamAV.
- [x] **QLT-005 · P1 · Phase 1:** Test migrations from an empty database and from the current baseline snapshot. IMPLEMENTED: ten release-command scenarios cover fresh/no-op startup, concurrent startup, preserved upgrade records/history, real forward-failure rollback, occupied schemas, partial/unknown history and stale locks. Nine nonconcurrent scenarios passed against temporary WASM PostgreSQL; the full native Docker suite must pass. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **QLT-006 · P1 · Phase 1:** Add ESLint, formatting and typecheck commands to CI. CLOSED 2026-10-05: founder reports incremental gates and Windows LF correction tested, merged and pulled. Broader strict-module adoption remains QLT-007.
- [-] **QLT-007 · P1 · Phase 1:** Prohibit new `any` in changed high-risk modules. PARTIAL: enforced for payment/delivery/cancellation/fees; expansion to other high-risk modules remains open.
- [ ] **QLT-008 · P1 · Phase 1:** Add regression tests for every confirmed P0 defect before or with the fix.
- [ ] **QLT-009 · P1 · Phase 2:** Add Playwright buyer onboarding and sourcing journey.
- [ ] **QLT-010 · P1 · Phase 2:** Add Playwright supplier organic and conventional publishing journeys.
- [x] **QLT-011 · P1 · Phase 2:** IMPLEMENTED: real browser journeys for all five payment plans, including deposit/balance proof, security acceptance, trade documents, dispatch, delivery and exact settlement/fees. Five authoring journeys passed; prepayment also previously confirmed on founder Docker. Native execution of the four new journeys remains pending. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **QLT-012 · P1 · Phase 2:** Real recall response browser journey implemented and user reports passing; delivery exceptions and additional recovery scenarios remain open.
- [ ] **QLT-013 · P1 · Phase 2:** Add API idempotency and retry tests.
- [ ] **QLT-014 · P1 · Phase 2:** Add contract tests for storage, email, scanner and future provider adapters.
- [ ] **QLT-015 · P2 · Phase 3:** Establish critical-domain coverage reporting; focus on meaningful branch and failure coverage rather than a vanity percentage.
- [ ] **QLT-016 · P2 · Phase 3:** Add load tests for marketplace, trade actions, provenance and large trace graphs.
- [ ] **QLT-017 · P2 · Phase 3:** Add long-running migration and rollback rehearsal in staging.
- [ ] **QLT-018 · P2 · Phase 3:** Add test data builders/factories rather than coupling tests to the demo seed.
- [ ] **QLT-019 · P2 · Phase 3:** Add mutation or equivalent fault-injection testing for payment and inventory invariants.
- [ ] **QLT-020 · P3 · Phase 4:** Add cross-browser and visual-regression coverage for the investor and critical customer flows.
- [x] **QLT-021 · P1 · Phase 1:** Add an automated browser identity regression suite covering request access, captured verification/approval emails, invitation create/resend/revoke/accept, reset, password change and session revocation. Done when it runs against a disposable database/inbox in CI and locally through one command, rejects stale/revoked/reused links, and retains sanitized failure screenshots/reports without exposing bearer tokens in public artifacts. IMPLEMENTED: six real Chromium journeys passed against the app, SMTP capture and temporary WASM PostgreSQL on 2026-10-01; 139 API unit tests, API/web builds and browser typecheck also passed. The isolated Docker/PostgreSQL 16 run and new CI job must still pass before closure. See `docs/runbooks/BROWSER_REGRESSION.md`. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.

# 15. Observability, reliability and operations

- [ ] **OPS-001 · P0 · Phase 1:** Use managed PostgreSQL for staging/production with encryption, automated backups and point-in-time recovery.
- [-] **OPS-002 · P0 · Phase 1:** Disposable PostgreSQL custom-format dump/restore rehearsal implemented with schema, migration history, relational fixtures and evidence metadata verification. Native execution pending. Managed-provider staging restore and private object-byte restoration remain open; local rehearsal does not close this item.
- [ ] **OPS-003 · P0 · Phase 1:** Add centralized structured logs with request/correlation IDs and secret redaction.
- [ ] **OPS-004 · P0 · Phase 1:** Add backend and frontend error monitoring with release version and environment.
- [ ] **OPS-005 · P1 · Phase 1:** Add uptime checks for web, API liveness and API readiness.
- [ ] **OPS-006 · P1 · Phase 1:** Alert on elevated 5xx, failed login abuse, authorization failures, queue backlog, DB exhaustion and storage scan failures.
- [ ] **OPS-007 · P1 · Phase 1:** Define on-call/incident owner and escalation contacts for the pilot.
- [-] **OPS-008 · P1 · Phase 1 — IN PROGRESS:** Scanner outage and quarantine response are drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Assign provider-specific owners, add secret-rotation and customer-communication procedures, and exercise them before closing.
- [-] **OPS-009 · P1 · Phase 1 — IN PROGRESS:** The immutable-image rollback sequence is drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Adapt it to the selected hosting/database providers and record a successful staging exercise before closing.
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
| Untested authorization regressions in resource families outside the current two-tenant matrix | High | Farm, certificate, batch, profile, provenance, evidence and contract-document PostgreSQL regressions are green | SEC-006, QLT-002 |
| Staging evidence infrastructure is not yet independently provisioned or operationally monitored | Critical | Private upload, quarantine, scanning and controlled-download behavior is implemented and Docker-tested | ENV-004, UPL-002, OPS-006 |
| Self-entered records appear verified/approved | Critical | Organic attestation on batches only | DAT-001–010 |
| Same inventory can underpin inconsistent contracts | Critical | Some application quantity checks | TRD-001–009 |
| Recall deployment and recovery scope not yet fully evidenced | High | User-tested safety gates; response implementation awaits native CI; segregation and external-recipient recovery remain open | RCL-001–010 |
| Critical audit events can fail after business commit | High | Warning log | ARC-013–014 |
| Real users lack reset/MFA/revocation lifecycle | High | Invite and password login | IDN-008–014 |
| Empty-database bootstrap repair has not yet passed native container/CI validation | Critical | Normal release runner now bootstraps atomically; nine functional CLI scenarios passed against temporary WASM PostgreSQL, with native concurrency still unverified | ENV-019, ENV-007, QLT-005 |
| Full payment-plan and exception coverage remains incomplete | High | User reports the existing browser suite passed; new full prepayment trade journey requires native validation; CI run links not independently archived | QLT-021, QLT-009–012 |
| Large, coupled files slow safe inheritance | Medium | TypeScript build | ARC-004–023 |
| No restore/monitoring/incident proof | High | Health endpoints and structured logger | OPS-001–012 |
| Marketing claims exceed implemented transformations | Medium | Demo genealogy | PRD-001, RCL-011, INV-005 |

Payment/document hardening wave: apply [`releases/PAYMENT_DOCUMENT_HARDENING_WINDOWS.md`](releases/PAYMENT_DOCUMENT_HARDENING_WINDOWS.md), then record native release results before closing the pending payment checks. PAY-008 is now founder-verified and merged. Subsequent payment work includes fee invoicing/collection; real-provider integration remains deferred.
