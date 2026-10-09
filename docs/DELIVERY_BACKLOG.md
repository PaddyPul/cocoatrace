# BetterTrade delivery backlog

**Purpose:** Single source of truth for work required to move BetterTrade from a passion project to an investor-ready, pilot-safe and production-capable company.
**North Star:** [`NORTH_STAR.md`](./NORTH_STAR.md)
**Pilot launch plan:** [`BETTERTRADE_PILOT_PLAN.md`](BETTERTRADE_PILOT_PLAN.md)
**Progress audit:** [`BACKLOG_GROOMING_2026-10-06.md`](BACKLOG_GROOMING_2026-10-06.md)
**Architecture direction:** [`ARCHITECTURE_MODERNIZATION.md`](./ARCHITECTURE_MODERNIZATION.md)
**Last triaged:** 2026-10-07
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

## Progress snapshot — 2026-10-06 grooming

Run `npm run backlog:progress` for an exact recount. The generated counts are recorded in [the grooming audit](BACKLOG_GROOMING_2026-10-06.md). Named rows only are counted; decisions and BST runbook rows are included. Partial work gets no fractional credit. Full-roadmap completion differs from closed pre-pilot gates and does not measure valuation.

## Current execution queue

1. **Bounded tenant reads and pagination (PER-001 / ARC-024)**: inventory list/search/export endpoints, implement enforced page/search limits and cursor navigation in focused resource slices, set SQL timeouts and collect representative query plans. Trace-selector slice accepted 2026-10-07 02:09 UTC: founder confirms full release checks passed and merge/pull completed, including the exact-label correction. Scoped keyset pages, search/navigation and native large-workspace/query-plan cases are accepted. Inventory/marketplace slice accepted 2026-10-07 11:32 UTC after founder confirms release checks passed and merge/pull completed: server-filtered keyset pages, searchable inventory/publishing, exact supply aggregates, off-page published-listing lookup and bounded comparison. Native release acceptance recorded. Transfer-history slice accepted by founder 2026-10-07 17:18 UTC after release checks passed and merge/pull completed, including the fixture/response-validation correction: scoped max-100-row pages, incoming/outgoing/status/search filters, explicit read retry and receiving-party-only acceptance presentation. Native 1,005-transfer and browser acceptance/navigation checks accepted. Source-record slice accepted by founder 2026-10-07 19:17 UTC after full release pass and merge/pull: farm/batch pages, retained farm selection, farm-scoped history and full source totals. Evidence-library slice accepted by founder 2026-10-07 20:03 UTC after full release pass and merge/pull: scoped metadata paging/search, bounded relationship snapshots, safe projections, explicit overflow and retry. Evidence record selection, offers, contracts and shipments subsequently accepted by founder after full release passes and merge/pull (see delivery checkpoints below). Payment paging and full workflow counts accepted by founder 2026-10-08 after full release pass and merge/pull. Workspace aggregates accepted 2026-10-08 16:40 UTC after founder confirms release, merge and pull, including marketplace SQL and slim web runtime corrections. Next: remaining collections/exports. Next resource slices: remaining lists/exports and their aggregate/selection consumers. PER-002 bounded trace safety, PRD-004 supplier setup and PRD-006 shared actions are release-tested and merged; do not repeat them.
2. **Remaining security/operational acceptance**: SAF-004, IDN-012/018/019 and IDN-014. Physical/hosted factor review, actual reviewer independence, recovery drills, alerts and emergency bootstrap are separate pilot prerequisites. Shared abuse protection SEC-011, origin/session protection and all-term permissions LOG-001 are already merged.
3. **Core pilot product coherence**: PRD-003–006, PRD-010/011, QLT-009/010. Request-specific evidence checklists, saved-brief reopening/editing and remaining empty/error states. BetterTrade customer branding follows a compatibility inventory (BRD-001/002).
4. **Pilot operations and performance**: OPS-002–012, PER-001–004, ENV-004–014, IDN-021. Assign an owner, isolate hosted resources, prove private object-byte/database recovery, inbox delivery and monitored worker operation. Do not expose real data through the synthetic temporary preview.
5. **Pilot enrollment/commercial approval**: GEO-001, IDN-005, legal/fee/privacy controls and incident/support arrangements. Invite a small buyer–supplier cohort only when every core gate is closed.
6. **Provider-enabled fulfillment**: GEO-002–004 and SVC-001–012 as one staged vertical slice, after threat model and service contract/payer policy approval. No carrier API integration is required.

Keep at most three independent engineering slices active; finish failing releases before starting another. Infrastructure provisioning, legal/commercial decisions and design-partner recruitment can run alongside engineering. $0 hosting is an unresolved operating constraint, not a security exemption. If secure free resources cannot meet the pilot gates, continue synthetic demos and record the funding blocker.

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
- [x] **ENV-007 · P1 · Phase 0:** Ephemeral PostgreSQL and fresh/upgrade migration CI are implemented. CLOSED 2026-10-06 grooming: same founder-reported native release/merge evidence as QLT-005 (2026-10-02); .github/workflows/ci.yml and scripts/run-migration-tests.mjs. Independent CI URL archival remains open.
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
- [-] **ARC-003 · P1 · Phase 1:** Create reusable resource policy interfaces and move authorization decisions out of controllers. IN PROGRESS (grooming): Shared resourcePolicy checks exist; adoption and typed interfaces across all controllers remain incomplete.
- [-] **ARC-004 · P1 · Phase 1:** Extract evidence controller logic into service, policy, repository and infrastructure adapters. IN PROGRESS (grooming): Private storage/scanner adapters and upload service exist; controller/policy/repository separation is incomplete.
- [x] **ARC-005 · P1 · Phase 1:** Extract offer acceptance and inventory reservation into one transactional trading use case. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **ARC-006 · P1 · Phase 2:** Extract payment-plan and installment state machines. IN PROGRESS: typed payment-term proposal/confirmation use cases and next-state mapping extracted, with transaction/audit and authorization regressions; founder confirms this wave merged/pulled; other payment state transitions remain open.
- [-] **ARC-007 · P1 · Phase 2:** Extract shipment and delivery state machines. IN PROGRESS (grooming): Delivery and trading fulfillment modules exist; transport progression and policy ownership still require extraction and shared transitions.
- [-] **ARC-008 · P1 · Phase 2:** Extract recall activation, notification and resolution use cases. IN PROGRESS (grooming): Recall lifecycle, notifications, safety and response modules exist; complete policy/repository boundaries remain open.
- [ ] **ARC-009 · P2 · Phase 2:** Split public product administration, public rendering and recall code into separate modules.
- [-] **ARC-010 · P2 · Phase 2:** Replace duplicated provenance view/export logic with one provenance builder and response mappers. IN PROGRESS: shared bounded authorized builder candidate in audit/provenance wave; separate view/export network scopes and complete-report mappers retained. Exact release and founder acceptance pending.
- [ ] **ARC-011 · P2 · Phase 2:** Move SQL from migrated controllers into repositories/query modules.
- [x] **ARC-012 · P2 · Phase 2:** Introduce a transaction boundary abstraction used by application services. IMPLEMENTED: Shared trading transaction boundary commits business mutations and audit events together; rollback tests are implemented. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **ARC-013 · P1 · Phase 2:** Write critical business changes, audit records and outbox events atomically. IN PROGRESS (grooming): Trading/payment critical changes and audit writes share transactions; route-wide audit/outbox coverage needs an explicit matrix.
- [-] **ARC-014 · P2 · Phase 3:** Add a transactional outbox and idempotent worker for email, alerts and external callbacks. IN PROGRESS (grooming): Durable email/reminder outboxes and retries exist; worker ownership, scheduling and dead-letter operations remain open.
- [ ] **ARC-015 · P2 · Phase 3:** Split `web/src/pages/DataPages.tsx` into feature-owned routes and components.
- [ ] **ARC-016 · P2 · Phase 3:** Split `web/src/api.ts` into a shared HTTP client and feature clients.
- [ ] **ARC-017 · P2 · Phase 3:** Split `web/src/types.ts` into module-owned schemas and domain types.
- [ ] **ARC-018 · P2 · Phase 3:** Refactor batch, contract and shipment route components into focused components and hooks.
- [-] **ARC-019 · P2 · Phase 3:** Replace compressed multi-operation functions with readable, named use cases. IN PROGRESS: contract payment-term handlers are HTTP adapters over named typed use cases; remaining controllers and native verification stay open.
- [ ] **ARC-020 · P2 · Phase 3:** Eliminate `any` from high-risk domain, authorization, payment, evidence and traceability paths.
- [ ] **ARC-021 · P2 · Phase 3:** Publish and maintain an OpenAPI specification.
- [ ] **ARC-022 · P2 · Phase 3:** Generate or strongly type the frontend API boundary from the OpenAPI contract.
- [ ] **ARC-023 · P2 · Phase 3:** Introduce stable error codes and a consistent API error envelope.
- [ ] **ARC-024 · P2 · Phase 3 · IN PROGRESS:** Add pagination and bounded queries to list/export endpoints. 2026-10-07: trace selector gains opt-in keyset page API and searchable navigation; legacy summary callers retain explicit bounded overflow behavior. Trace-selector release and exact-label correction accepted by founder 2026-10-07 02:09 UTC. Inventory/marketplace pages and supply aggregate consumers accepted by founder 2026-10-07 11:32 UTC after full release pass and merge/pull. Transfer-history paging and focused Inventory component accepted by founder 2026-10-07 17:18 UTC after full release pass and merge/pull, including response-validation correction. Source-record pages/selectors/history/totals accepted by founder 2026-10-07 19:17 UTC after full release pass and merge/pull. Evidence-library paging/search accepted by founder 2026-10-07 20:03 UTC after full release pass and merge/pull. Evidence record selectors now use bounded source/trade option pages and exact permitted lookup; candidate native acceptance pending. Other lists/exports and summary semantics remain open.
- [x] **ARC-025 · P2 · Phase 3:** Authoritative database sessions, hashed tokens, live actor/organization checks and revocation are implemented. CLOSED 2026-10-06 grooming: authSessionService.ts and identity/session integration/browser regressions; founder previously tested and merged identity/email waves. MFA and admin suspension tooling remain separate IDN items.
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
- [x] **IDN-011 · P1 · Phase 1:** Implement user suspension/deactivation and immediate session revocation. CLOSED 2026-10-06: founder confirms privileged access lifecycle release checks passed and merge/pull completed. Ordinary audited HTTP suspension/restoration plus console-only two-reviewer user/organization suspension/restoration and user deactivation are implemented and release-tested. Fresh passkey review, target isolation, two usable-admin continuity, session/reset/challenge/invitation revocation and atomic auditing are covered. Old sessions never revive; deactivated users cannot receive recovery approval. Hosted operator acceptance, actual reviewer independence and emergency bootstrap remain tracked separately under SAF-004/IDN-018/IDN-019. See runbooks/PRIVILEGED_ACCESS_LIFECYCLE.md. CI URLs are not independently archived.
- [-] **IDN-012 · P1 · Phase 2:** Require MFA for platform admins, certifiers, regulators and organization admins. IN PROGRESS 2026-10-06: passkey enrollment, restricted sessions, fresh write gates, backup/removal and password-reset preservation implemented. Founder confirms merged on 2026-10-06 after the permission-probe and reset-wait corrections. Independent CI/report archival and physical/hosted verification remain pending; see runbooks/PRIVILEGED_PASSKEYS.md.
- [x] **IDN-013 · P1 · Phase 1:** Replace process-memory login throttling with shared, account-aware and IP-aware limits. CLOSED 2026-10-06: founder reports corrected auth-boundary release pulled and merged. Native prior run passed 191 integration tests; final corrected browser/recovery release completion is founder-reported, without independently archived CI URL. Public endpoint expansion remains SEC-011.
- [-] **IDN-014 · P1 · Phase 1:** Add security events for failed login, reset, MFA and session revocation. IN PROGRESS (grooming): Login/reset/revocation security events exist; MFA registration/assertion security events and atomic factor/recovery audits implemented in the passkey wave; operational alerts, notifications and retention remain incomplete.
- [ ] **IDN-015 · P1 · Phase 1:** Record terms/privacy version and acceptance timestamp per user.
- [ ] **IDN-016 · P2 · Phase 2:** Add organization member role changes with least-privilege constraints and audit.
- [ ] **IDN-017 · P2 · Phase 2:** Add an organization-admin member screen for invite, deactivate and role review.
- [-] **IDN-018 · P2 · Phase 2:** Add recovery procedures for lost MFA and locked accounts. IN PROGRESS 2026-10-06: two freshly verified independent platform-account reviewers, server-console approval, session/key revocation, single-consumption 30-minute replacement enrollment and a review runbook implemented. Founder confirms the passkey/recovery wave merged on 2026-10-06. Hosted rehearsal, owner-verification review, out-of-band notifications and emergency bootstrap recovery remain open.
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
- [-] **SEC-007 · P1 · Phase 1:** Add CSRF/origin tests for every cookie-authenticated state-changing request. IN PROGRESS: Global origin boundary and credential precedence regressions implemented in AUTHENTICATION_BOUNDARY.md; founder reports corrected authentication-boundary release tested, merged and pulled on 2026-10-06. Route-family coverage and future ingress changes remain open. No missing-origin/cookie fallback exemption.
- [-] **SEC-008 · P1 · Phase 1:** Add a restrictive Content Security Policy and verify public profile assets. IN PROGRESS (grooming): Helmet headers exist; deployed CSP, public assets and injection regressions remain unverified.
- [ ] **SEC-009 · P1 · Phase 1:** Review all outbound/tracking/hero URLs against allowlist and safe rendering rules.
- [-] **SEC-010 · P1 · Phase 1:** Add request-body and query-size limits globally. IN PROGRESS (grooming): JSON/upload size limits exist; query complexity, pagination, generic oversized-body error semantics and concurrency limits remain incomplete.
- [x] **SEC-011 · P1 · Phase 1:** Add bounded rate limits for public scan, QR, login, reset, invitation and upload-intent endpoints. CLOSED 2026-10-06: founder reports public-abuse limits tested, merged and pulled. Shared fixed-operation deployment/socket-peer budgets protect profiles, QR, scans, invitation previews/creation and upload intents/content; authenticated member/organization quotas and fail-closed pre-parser enforcement are regression-tested. Existing account/token authentication budgets remain. Reviewed hosted ingress/client attribution, measured capacity and centralized alerts remain SEC-007/010/017 and OPS/PER work.
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
- [-] **UPL-010 · P1 · Phase 1:** Add authorized expiring downloads with attachment disposition and release-condition checks. IN PROGRESS (grooming): Authenticated scan-clean attachment downloads enforce payment release. Explicit download-link expiration semantics and reauthorization tests remain open; upload URL expiration does not prove download expiration.
- [ ] **UPL-011 · P1 · Phase 2:** Add reviewer queues, rejection reasons and replacement/version history.
- [ ] **UPL-012 · P1 · Phase 2:** Add certificate/document expiry and renewal reminders.
- [ ] **UPL-013 · P1 · Phase 2:** Define retention, deletion, legal hold and backup behavior.
- [ ] **UPL-014 · P1 · Phase 2:** Audit upload intent, completion, scan, review, access and deletion.
- [ ] **UPL-015 · P2 · Phase 2:** Add storage quotas and abuse monitoring.
- [ ] **UPL-016 · P2 · Phase 3:** Add asynchronous extraction only behind human confirmation and without changing trust state.
- [ ] **UPL-017 · P2 · Phase 3:** Add a public/private field policy for product-profile evidence metadata.
- [ ] **UPL-018 · P2 · Phase 3:** Complete a restore test for evidence metadata and object versions.

# 7. Trust, certification and compliance data

- [x] **DAT-001 · P0 · Phase 1 — VERIFIED:** Forward migration 021 replaces optimistic defaults with pending/self-declared/unknown. Workspace approval remains separate from independent verification. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **DAT-002 · P0 · Phase 1 — VERIFIED:** Migration 021 downgrades unsupported legacy farm/plot/evidence decisions with a per-field correction ledger and read-only `trust:report`. Seed flags cannot grant effective verification. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **DAT-003 · P1 · Phase 1 — IN PROGRESS:** Independent certificate issuance/attestation records source, actual reviewer, method, time, expiry and audit atomically. Customer-facing trust summaries expose review provenance without private document URLs. A general origin/EUDR/evidence review workflow remains future work; native release validation pending.
- [x] **DAT-004 · P1 · Phase 1:** Certificate issue and attestation validate farmer organization against farm ownership, with a real-PostgreSQL cross-tenant regression.
- [-] **DAT-005 · P1 · Phase 1 — IN PROGRESS:** Attestation validates certificate subject, crop scope and harvest-date coverage. PostgreSQL regressions cover mismatched subject and crop; add an out-of-validity harvest-date regression before closing this item.
- [ ] **DAT-006 · P1 · Phase 1:** Prevent contradictory duplicate active certificates.
- [-] **DAT-007 · P1 · Phase 2:** Live batch/listing/passport/provenance trust now reflects suspension/revocation/expiry. Audited reinstatement applies only to valid suspended certificates. Deal protections and proactive alerts remain open.
- [x] **DAT-008 · P1 · Phase 2:** Marketplace and public product labels derive from current scoped certificates and documented reviews; API/UI regressions implemented. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **DAT-009 · P1 · Phase 2:** Shared claim presentation distinguishes declaration, independent review, expiry, revocation and unknown; details include source and reviewer. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [ ] **DAT-010 · P1 · Phase 2:** Add evidence requirements by claim type rather than accepting arbitrary labels.
- [ ] **DAT-011 · P2 · Phase 2:** Introduce configurable assurance schemes rather than hard-coded organic/EUDR assumptions.
- [ ] **DAT-012 · P2 · Phase 3:** Add history/effective dates so past decisions remain explainable after claim changes.
- [ ] **DAT-013 · P2 · Phase 3:** Add data-quality reports for missing, contradictory, stale and impossible records.
- [ ] **DAT-014 · P2 · Phase 3:** Define master-data ownership for organization, farm, plot, material and product identifiers.

# 8. Inventory, marketplace, offers and agreements

- [x] **TRD-001 · P0 · Phase 1:** Add transactional inventory reservation with row locks during offer acceptance. IMPLEMENTED: Holding locks and atomic commitment are implemented; competing native PostgreSQL acceptance tests remain a release gate. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-002 · P0 · Phase 1:** Deactivate or resize every incompatible listing sharing a committed holding. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-003 · P0 · Phase 1:** Reject acceptance when listing is inactive, offer expired or holding not available. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-004 · P0 · Phase 1:** Prevent listing create/update above unreserved quantity. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-005 · P0 · Phase 1:** Prevent custody transfer or split of reserved/committed inventory. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-006 · P0 · Phase 1:** Lock transfer and holding rows when accepting transfers. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-007 · P0 · Phase 1:** Add database constraints for positive quantities, legal statuses and one agreement per accepted offer. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-008 · P1 · Phase 1:** Add reconciliation invariants across source quantity, holdings, reservations, commitments and distributions. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **TRD-009 · P1 · Phase 1:** Add concurrency tests for simultaneous offers, listings, transfers and acceptance. IMPLEMENTED: Twenty-four trading integration tests cover races, quantity conservation, authorization, rollback, database constraints, batch publication and reconciliation. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [ ] **TRD-010 · P1 · Phase 2:** Allow buyers to withdraw pending offers.
- [ ] **TRD-011 · P1 · Phase 2:** Add seller rejection reason and immutable history.
- [ ] **TRD-012 · P1 · Phase 2:** Implement a bounded counteroffer flow or explicitly mark negotiation external.
- [x] **TRD-013 · P1 · Phase 2:** Offer currency must match the listing; deadlines are validated at creation and acceptance. CLOSED 2026-10-06 grooming: modules/trading/offers.ts and tradeCurrency/tradingIntegrity regressions; founder reports currency waves tested/merged/pulled.
- [ ] **TRD-014 · P1 · Phase 2:** Snapshot accepted price, quantity, Incoterm, locations and assurance requirements.
- [ ] **TRD-015 · P1 · Phase 2:** Add agreement version, explicit acceptance by both parties and acceptance timestamp.
- [ ] **TRD-016 · P1 · Phase 2:** Rename “sales contract” where no legally executed contract exists, or add signed-document support.
- [-] **TRD-017 · P1 · Phase 2:** Add cancellation, dispute and administrator-resolution states. IN PROGRESS: bilateral unstarted cancellation with critical audit and exact stock release implemented; founder reports unstarted cancellation tested/merged/pulled; paid cancellation, broader disputes and administrator resolution remain open.
- [ ] **TRD-018 · P2 · Phase 2:** Award/close the originating sourcing request when appropriate.
- [ ] **TRD-019 · P2 · Phase 3:** Add marketplace pagination, search indexes and deterministic match explanations.
- [ ] **TRD-020 · P2 · Phase 3:** Add listing expiry and supplier renewal workflows.

# 9. Payments, fees and financial boundaries

- [x] **PAY-001 · P0 · Phase 1:** IMPLEMENTED: every-plan integration coverage, pickup/handover/loading/departure gates, scan-clean documents and five actual browser journeys. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-002 · P1 · Phase 1:** Explicit no-funds/no-escrow copy in the deal room and payment schedule; external bank security is seller-accepted, not platform-authenticated. Browser journeys pass in authoring.
- [x] **PAY-003 · P1 · Phase 2:** IMPLEMENTED: supplier-selected, buyer-confirmed per-installment proof requirement, private scanned buyer uploads, contract/tenant/type checks, stored-file checks and proof reuse prevention. Existing agreed terms are preserved. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-004 · P1 · Phase 2:** Separate buyer submission, seller confirmation, rejection and dispute histories. CLOSED 2026-10-02: payment operations wave tested and merged per founder confirmation; correction 7b2d5ce fixed the settlement SQL ambiguity.
- [x] **PAY-005 · P1 · Phase 2:** IMPLEMENTED: state-based retry safety for submission, confirmation, rejection, document presentation and bank security; atomic audits, contract-first locking and exact NUMERIC receipt totals. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-006 · P1 · Phase 2:** Prevent one party from unilaterally satisfying incompatible payment and delivery conditions. IMPLEMENTED: physical delivery no longer settles; buyer acceptance and seller receipt verification are both required. Founder confirmed tested and merged on 2026-10-02.
- [x] **PAY-007 · P1 · Phase 2:** IMPLEMENTED: five-plan policy in [`runbooks/PAYMENT_DOCUMENT_RULES.md`](runbooks/PAYMENT_DOCUMENT_RULES.md), contract/shipment download gating and safe document-presentation checks. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **PAY-008 · P1 · Phase 2:** Add overdue installment calculation and reminders. Founder reports release verification and merge/pull complete including the system-audit correction. Disabled email retains the queue; SMTP acceptance is distinct from inbox delivery.
- [x] **PAY-009 · P1 · Phase 2:** Add correction/reversal procedure without deleting history. CLOSED 2026-10-02: bilateral reference/receipt corrections and durable audit events tested and merged per founder confirmation; this records external payments and does not refund funds.
- [x] **PAY-010 · P1 · Phase 2:** Define how bank guarantees/LC references are independently checked or explicitly marked seller-accepted only. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **PAY-011 · P1 · Phase 2:** Define platform fee payer, tax treatment, invoice timing and collection process. IN PROGRESS: existing seller-paid policy is versioned on acceptance, exact fee amount is recorded and becomes due at trade completion; external payment references are explicitly separate from goods payment. Tax, bank/channel instructions and production commercial approval remain open.
- [-] **PAY-012 · P1 · Phase 2:** Implement platform fee invoice delivery and paid/write-off status. IN PROGRESS: in-app commercial statement/download, platform-only receipt verification/rejection, reasoned write-off and retained submission/audit history implemented. Native verification, official tax invoices and outbound email delivery remain open.
- [-] **PAY-013 · P2 · Phase 3:** Reconcile fee invoices against completed deals and finance exports. IN PROGRESS: read-only consistent-snapshot ledger report checks amount/currency/payer/state/receipt history and exports statements plus currency-separated totals as JSON. Founder reports the fee wave tested/merged/pulled; actual bank/provider reconciliation and operational scheduling remain open.
- [ ] **PAY-014 · P3 · Phase 4:** Evaluate regulated payment-provider integrations only after the manual workflow and demand are proven.

# 10. Logistics, delivery and external transport

- [x] **LOG-001 · P1 · Phase 1:** Preserve Incoterm-based transport coordinator assignment and test every supported term. CLOSED 2026-10-06: founder reports Incoterm responsibilities bundle tested/merged. All 11 terms have contract-party milestone/arrangement checks, persisted origin prerequisites and DPU/DDP gates; API-derived UI/dashboard and unit/PostgreSQL/browser regressions. Exact named places, handover variants, modes and domestic policy remain LOG-002/003/004 and GEO-001; no full legal-compliance claim.
- [ ] **LOG-002 · P1 · Phase 2:** Define which party may record each milestone and which may only observe it.
- [ ] **LOG-003 · P1 · Phase 2:** Require essential arrangement fields before departure-relevant milestones.
- [ ] **LOG-004 · P1 · Phase 2:** Decide whether milestone skipping is allowed; encode required predecessors explicitly.
- [x] **LOG-005 · P1 · Phase 2:** Add buyer delivery confirmation distinct from a reported delivery milestone. IMPLEMENTED: separate buyer inspection/acceptance, exact quantity, retry-safe auditable acceptance and settlement guard. Founder confirmed tested and merged on 2026-10-02. See runbooks/DELIVERY_ACCEPTANCE.md.
- [-] **LOG-006 · P1 · Phase 2:** Add shortages, damage, rejection and delivery-dispute flows. IN PROGRESS: evidence-backed reports, supplier proposal and buyer approval with settlement hold implemented; bilateral unstarted cancellation implemented with guarded stock release; founder reports delivery acceptance and unstarted cancellation tested/merged; partial settlement, refunds, paid cancellation and returned inventory remain explicit follow-up scope.
- [x] **LOG-007 · P1 · Phase 2:** Prevent automatic settlement while a delivery dispute is open. Implemented and founder-tested with delivery acceptance; founder confirmed release testing and merge on 2026-10-02.
- [-] **LOG-008 · P1 · Phase 2:** Require reason, acknowledgement and notification for exceptional dispatch. IN PROGRESS (grooming): Exception reasons and audit exist; scoped notification/acknowledgement is incomplete.
- [x] **LOG-009 · P1 · Phase 2:** Shipment and contract transport documents use private evidence upload, scan-clean download and payment release controls. CLOSED 2026-10-06 grooming: evidenceController.ts, paymentWorkflow.integration.test.ts and paymentPlans.spec.ts; founder reports payment/document waves tested and merged. Hosting and service-provider grants remain separate gates.
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
- [-] **PRD-003 · P1 · Phase 1:** Remove generic “Contribute proof” as a starting task; anchor evidence contribution to a record and request. IN PROGRESS: Record picker, explicit document purpose and contextual farm/batch entry implemented; Founder confirms full release checks passed and merge/pull completed 2026-10-07. Record-based contribution is accepted; request-specific evidence checklist remains follow-up.
- [x] **PRD-004 · P1 · Phase 1:** Ensure supplier onboarding selects conventional versus source-traceable supply before record creation. CLOSED 2026-10-07: founder confirms full release checks passed and merge/pull completed. Shared permission-aware chooser covers supplier home, empty publication and evidence setup; conventional inventory and source/farm/plot/harvest browser journeys passed. Farm/plot creation does not invent saleable inventory or organic approval. Evidence is founder-reported; CI URL not independently archived.
- [-] **PRD-005 · P1 · Phase 1:** Ensure buyer sourcing requirements persist and drive marketplace matching. IN PROGRESS (grooming): Editable persisted sourcing and explicit request-aware matching are implemented and founder-tested; New reviewed creation/save/reload browser coverage passed in the 2026-10-07 founder-confirmed release. Reopening and editing an existing saved brief and consistent deep links remain open.
- [x] **PRD-006 · P1 · Phase 2:** Make the guided dashboard and deal room use one next-action source. CLOSED 2026-10-06: founder confirms release checks passed and merge/pull completed. Shared server fact repository and typed commercial/fulfilment/closeout/permission policy drive dashboard, deal room and contract guidance. Supplier proposal precedes buyer confirmation; payment/document/recall gates, exact money and Incoterm ownership are reflected. Unit/repository tests plus native API equivalence/isolation and real browser transition coverage added. Native release success is founder-reported; CI URLs are not independently archived. Other platform empty states remain tracked under PRD-011. See runbooks/TRADE_NEXT_ACTION_POLICY.md.
- [ ] **PRD-007 · P1 · Phase 2:** Add a notification center with read/unread, responsible party and deep link.
- [ ] **PRD-008 · P1 · Phase 2:** Send transactional emails for invitation, offer, terms, payment, dispatch, delivery, dispute and recall actions.
- [ ] **PRD-009 · P1 · Phase 2:** Add overdue/action-required filters for buyers and suppliers.
- [ ] **PRD-010 · P1 · Phase 2:** Provide document checklists based on payment plan, route and Incoterm.
- [-] **PRD-011 · P1 · Phase 2:** Give every empty state an explanation and permitted next action. IN PROGRESS 2026-10-06: trade action centre now explains a successful empty list separately from a failed refresh; source/sourcing setup stays distinct from active trade guidance. Other platform empty-state and permission coverage remains open.
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
- [x] **QLT-003 · P0 · Phase 1:** Inventory/offer concurrency tests are implemented. CLOSED 2026-10-06 grooming: duplicate coverage of completed TRD-009; tradingIntegrity.integration.test.ts and founder-reported 2026-10-02 native release/merge evidence.
- [x] **QLT-004 · P0 · Phase 1:** Real-PostgreSQL integration tests cover linked-resource upload authorization, private quarantine, extension/MIME/signature validation, file and tenant quota limits, EICAR rejection and audit, quarantine deletion, scan-clean download gating and unauthenticated `/uploads` denial. The Docker harness additionally exercises S3-compatible storage and ClamAV.
- [x] **QLT-005 · P1 · Phase 1:** Test migrations from an empty database and from the current baseline snapshot. IMPLEMENTED: ten release-command scenarios cover fresh/no-op startup, concurrent startup, preserved upgrade records/history, real forward-failure rollback, occupied schemas, partial/unknown history and stale locks. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **QLT-006 · P1 · Phase 1:** Add ESLint, formatting and typecheck commands to CI. CLOSED 2026-10-05: founder reports incremental gates and Windows LF correction tested, merged and pulled. Broader strict-module adoption remains QLT-007.
- [-] **QLT-007 · P1 · Phase 1:** Prohibit new `any` in changed high-risk modules. PARTIAL: enforced for payment/delivery/cancellation/fees; expansion to other high-risk modules remains open.
- [ ] **QLT-008 · P1 · Phase 1:** Add regression tests for every confirmed P0 defect before or with the fix.
- [-] **QLT-009 · P1 · Phase 2:** Add Playwright buyer onboarding and sourcing journey. IN PROGRESS (grooming): Real identity and trade journeys exist; Real source/farm/plot/harvest and reviewed sourcing creation/save/reload browser cases added; Founder confirms full release checks passed and merge/pull completed 2026-10-07. Reopening/editing an existing saved brief remains follow-up.
- [-] **QLT-010 · P1 · Phase 2:** Add Playwright supplier organic and conventional publishing journeys. IN PROGRESS (grooming): Conventional publication and trust presentation regressions exist; complete organic/source farm→plot→harvest and conventional creation browser journeys remain incomplete.
- [x] **QLT-011 · P1 · Phase 2:** IMPLEMENTED: real browser journeys for all five payment plans, including deposit/balance proof, security acceptance, trade documents, dispatch, delivery and exact settlement/fees. Five authoring journeys passed; prepayment also previously confirmed on founder Docker. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
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
- [-] **OPS-003 · P0 · Phase 1:** Add centralized structured logs with request/correlation IDs and secret redaction. IN PROGRESS (grooming): Structured request logs and redaction exist; centralized collection, access controls and retention are unprovisioned.
- [ ] **OPS-004 · P0 · Phase 1:** Add backend and frontend error monitoring with release version and environment.
- [-] **OPS-005 · P1 · Phase 1:** Add uptime checks for web, API liveness and API readiness. IN PROGRESS (grooming): Liveness/readiness probes exist; deployed external uptime checks and failure alert drills are unconfigured.
- [ ] **OPS-006 · P1 · Phase 1:** Alert on elevated 5xx, failed login abuse, authorization failures, queue backlog, DB exhaustion and storage scan failures.
- [ ] **OPS-007 · P1 · Phase 1:** Define on-call/incident owner and escalation contacts for the pilot.
- [-] **OPS-008 · P1 · Phase 1 — IN PROGRESS:** Scanner outage and quarantine response are drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Assign provider-specific owners, add secret-rotation and customer-communication procedures, and exercise them before closing.
- [-] **OPS-009 · P1 · Phase 1 — IN PROGRESS:** The immutable-image rollback sequence is drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Adapt it to the selected hosting/database providers and record a successful staging exercise before closing.
- [-] **OPS-010 · P1 · Phase 2:** Add a durable job queue with retries, dead-letter handling and idempotency. IN PROGRESS (grooming): Domain outboxes and lease/retry handling exist; always-running scheduling, dead-letter handling and monitored recovery remain incomplete.
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

- [-] **INV-001 · P0 · Phase 0:** Deploy an isolated, synthetic, resettable investor demo. IN PROGRESS (grooming): Email-gated synthetic temporary preview is founder-tested; stable hosted pilot and maintained investor presentation remain incomplete.
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


# 18. BetterTrade identity, geography, service marketplace and performance

See [BetterTrade pilot plan](BETTERTRADE_PILOT_PLAN.md) and [service marketplace boundary](BETTERTRADE_SERVICE_MARKETPLACE.md). P0/P1 here are required for the stated phase, not all for the first buyer–supplier pilot. Provider items gate the provider-enabled pilot.

- [ ] **BRD-001 · P1 · Phase 1:** Apply BetterTrade customer-facing name, navigation, emails and metadata with accessible buyer/supplier terms; completion: automated English/French identity and trade journeys, no misleading verification claims.
- [ ] **BRD-002 · P1 · Phase 1:** Inventory compatibility-sensitive names before internal rename: Compose volumes/projects, storage keys, issuer/audience, cookies, preferences, scripts, packages and GitHub URLs. Completion: versioned mapping and backup/restore/relogin tests; frozen migrations unchanged.
- [ ] **BRD-003 · P2 · Phase 2:** Migrate internal identifiers only through tested aliases and explicit data/session migration. Completion: old installations upgrade without new empty databases, lost evidence or silent session breakage.
- [ ] **BRD-004 · P1 · Phase 1:** Approve name/domain availability and customer terminology before public launch. Completion: founder records chosen identity and any professional legal review; no availability claim based on a code rename.
- [ ] **GEO-001 · P1 · Phase 1:** Approve first pilot commodity, country/corridor and delivery modes; completion: named invited organizations and supported/rejected cases. Broad raw-material capability is not universal regulatory readiness.
- [ ] **GEO-002 · P1 · Phase 2:** Model origin/destination country, administrative region, named place and route independently of economic-region membership. Completion: domestic, cross-border within-region and inter-region route tests.
- [ ] **GEO-003 · P1 · Phase 2:** Separate agreed payment schedule, delivery coordinator, service payer and Incoterm/risk allocation. Completion: domestic road delivery and sea-only FOB/CIF validation with named places and explicit agreement snapshots.
- [ ] **GEO-004 · P1 · Phase 2:** Create versioned commodity/route requirement policies: handling, restricted cargo, units and required documents. Completion: unsupported hazardous/regulated cargo fails explicitly; conventional supply never invents farms.
- [ ] **GEO-005 · P2 · Phase 3:** Validate expansion through actual regional customer workflows, customs/tax/privacy advice and route-specific document policies. Completion: approved corridor matrix; no platform legal-compliance guarantee.
- [ ] **SVC-001 · P1 · Phase 2:** Add logistics organization application and reviewer approval with capability/insurance/license scope and expiry. Completion: verified status is attributable, revocable and route-specific; ordinary organization approval cannot imply transport qualification.
- [ ] **SVC-002 · P1 · Phase 2:** Publish provider capabilities, operating areas, modes and cargo constraints. Completion: eligible provider search explains matches, stale records are excluded and access is tenant-bounded.
- [ ] **SVC-003 · P1 · Phase 2:** Generate scoped fulfillment RFQs from agreed versioned goods terms. Completion: only necessary route/cargo/window fields shared; bank, goods price and unrelated evidence hidden.
- [ ] **SVC-004 · P1 · Phase 2:** Support immutable expiring service quotations including currency, taxes, insurance, exclusions and collection window. Completion: invalid/expired/replaced quotes cannot be awarded.
- [ ] **SVC-005 · P0 · Phase 2:** Award one active service order atomically with provider acceptance and explicit payer/coordinator authority. Completion: concurrent awards, retries, quote changes and expired verification cannot double-book the contract.
- [ ] **SVC-006 · P0 · Phase 2:** Enforce least-privilege assigned-job grants, unrelated-provider denial and access revocation. Completion: provider cannot confirm goods payment, override holds, accept buyer delivery or browse unassigned private records.
- [ ] **SVC-007 · P1 · Phase 2:** Implement provider job progress/POD and party acknowledgement. Completion: customer delivery acceptance remains authoritative; domestic jobs do not require vessel/container/BOL.
- [ ] **SVC-008 · P1 · Phase 2:** Support provider rejection, cancellation, delay, replacement and dispute with versioned history and notifications. Completion: replacement preserves prior evidence and outstanding commercial liability.
- [ ] **SVC-009 · P1 · Phase 2:** Keep logistics service charges, service payments and any service commission separate from goods installments/platform trade fees. Completion: approved policy, currency reconciliation and no hidden/double commission.
- [ ] **SVC-010 · P1 · Phase 2:** Extend private evidence policy to service orders and provider verification. Completion: scan-clean, expiry, download, reassignment and unrelated-provider tests.
- [ ] **SVC-011 · P1 · Phase 2:** Automate complete three-persona provider fulfillment plus adversarial concurrency/access journeys. Completion: real PostgreSQL and buyer/supplier/provider browser tests with empty/new accounts.
- [ ] **SVC-012 · P1 · Phase 2:** Run an invited provider pilot after core pilot gates, signed service terms and incident contacts. Completion: real provider accepts and fulfills a supervised job; portal works without carrier APIs.
- [ ] **PER-001 · P1 · Phase 1 · IN PROGRESS:** Enforce cursor pagination, bounded search/export and SQL timeouts with measured query plans. Completion: documented cardinality/limits and representative benchmark; no unbounded tenant lists. 2026-10-07: trace-selector candidate searches authorized records before LIMIT, returns maximum 100 rows, binds cursor scope and rechecks access each page under existing SQL deadlines. PostgreSQL 2,501-record pagination/authorization and EXPLAIN cases plus browser navigation/error checks added; native run accepted by founder 2026-10-07 02:09 UTC after full release pass and merge/pull, including the exact-label correction. Inventory/marketplace candidate now adds max-100-row pages, bounded literal filtering, certificate-derived organic filtering before LIMIT, shared read deadlines, max-1,000 legacy compatibility reads with explicit overflow, full supply aggregates and off-page selection. Native 1,005-record/hold/query-plan and organic-predicate parity cases plus browser paging/count/error cases added. Native release accepted by founder 2026-10-07 11:32 UTC after full release pass and merge/pull. Transfer-history slice adds max-100-row party-filtered pages, typed cursor parameters, legacy overflow refusal and explicit retry; native large-history/acceptance and browser checks accepted by founder 2026-10-07 17:18 UTC after full release pass and merge/pull. Source-record pages/selection/totals accepted by founder 2026-10-07 19:17 UTC after full release pass and merge/pull. Evidence-library paging/search accepted by founder 2026-10-07 20:03 UTC after full release pass and merge/pull. Paged evidence record selector candidate adds four permitted resource kinds, exact off-page lookup and retained selection; native release pending. Universal remaining list/export coverage, hosted plans/index tuning and load benchmarks remain outstanding; no completion credit.
- [x] **PER-002 · P0 · Phase 1:** Bound trace/recall nodes, edges, depth and computation; replace recursive/high-copy scans where needed. Completion: oversized/cyclic graphs report incomplete analysis and never falsely clear safety. IN PROGRESS 2026-10-07: connected-component reads with row/depth/time limits, iterative cycle checks, work budget, linear indexing/aggregation and atomic bulk recall scope writes implemented. Incomplete responses carry no safety clearance; suspect goods require isolation/escalation. Unit/capacity checks and native API/browser regressions added. CLOSED 2026-10-07 01:15 UTC: founder confirms full release checks passed and merge/pull completed. Native atomicity/isolation and browser error acceptance are founder-reported; hosted concurrent capacity remains a separate requirement.
- [ ] **PER-003 · P1 · Phase 1:** Bound upload/download memory, tenant concurrency, scanner timeouts and worker backpressure. Completion: parallel maximum-size file stress test stays within declared memory budget and fails safely.
- [ ] **PER-004 · P1 · Phase 1:** Set pilot capacity/SLO budgets and automate read/write/trace load scenarios. Completion: archived hardware/data/concurrency plus p95/p99 results; targets are not claimed measurements.
- [ ] **PER-005 · P1 · Phase 2:** Split heavy frontend routes and establish mobile performance/accessibility budgets. Completion: measured production bundles and buyer/supplier mobile journey with regression thresholds.
- [ ] **PER-006 · P2 · Phase 3:** Validate multi-instance locks, shared throttles, scheduler leases and scaling. Completion: no duplicate reminder/service award/settlement under process crashes and concurrent workers.
- [x] **SAF-001 · P0 · Phase 1:** Close browser-cookie origin/proxy boundary threat cases with exploit regressions. CLOSED 2026-10-06: authoritative credentials and missing/null/foreign-Origin/forged-forwarding regressions, plus corrected real Playwright header and inbox isolation probes; founder reports successful prescribed release/merge/pull. Express trusts no forwarded proxy headers. Any future ingress change needs a fresh review under SEC-007.
- [ ] **SAF-002 · P0 · Phase 1:** Inventory all secret-bearing URLs/logs/emails, rotate deployment keys and exercise revocation. Completion: secret-scan and redaction tests plus owner-recorded deployment rotation.
- [ ] **SAF-003 · P1 · Phase 1:** Review pilot threat model against OWASP ASVS 5 Level 2-focused controls and NIST SSDF. Completion: mapped test/evidence register and reviewed exceptions, not a certification claim.
- [-] **SAF-004 · P0 · Phase 1:** Protect administrators with phishing-resistant MFA or a reviewed isolated administration mechanism before real customer access. IN PROGRESS 2026-10-06: phishing-resistant WebAuthn with required user verification and mandatory deployed enforcement implemented; Founder confirms the implementation and browser corrections merged on 2026-10-06; privileged-access/physical-device/hosted review and independently archived release evidence remain pending. Completion: login/recovery/revocation/audit tests and privileged access review; coordinates IDN-012.
- [ ] **SAF-005 · P1 · Phase 2:** Preserve artifact provenance/SBOM, reviewed dependencies and time-limited exceptions through immutable deployment. Completion: approved release digest, third-party images and incident patch drill; coordinates SEC-014 and ENV-009.

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

# Known current risks — groomed 2026-10-06

| Risk | Severity | Existing mitigation / remaining gap | Closure items |
| --- | --- | --- | --- |
| Cookie/origin/proxy edge cases | Critical | Origin middleware exists; bypass combinations are unverified, not a proven exploit | SAF-001, SEC-007 |
| Abuse or privileged-account takeover | Critical | Revocable sessions/reset exist; shared throttling merged; MFA and privileged recovery/suspension remain | IDN-011–014, SAF-004 |
| Real data exposed through demo/hosting mistakes | Critical | Demo guards and private uploads tested; hosted isolation and secrets are unprovisioned | ENV-004–006, IDN-001, SAF-002 |
| Private files or database unrecoverable | Critical | Local recovery/scanner regressions exist; hosted DB plus object-byte restore not evidenced | OPS-001/002, UPL-002 |
| Incorrect stock/payment/service awards under retries | High | Goods trading/payment concurrency tests exist; general coverage and future service awards remain | QLT-002/013, SVC-005/006 |
| Claims exceed evidence or commodity suitability | High | Live claim-source/status labels tested; claim policies and corridor-specific requirements remain | DAT-010/011, GEO-004/005 |
| Unbounded lists/graphs/files exhaust resources | High | Trace graph bounds and refusal behavior are accepted; hosted capacity, file concurrency and universal pagination remain open | PER-001–004, ARC-024 |
| Notifications stop without customer/owner awareness | High | Durable outboxes exist; scheduling, monitoring and real inbox delivery incomplete | OPS-006/010, IDN-021, PRD-008 |
| Navigation disagrees with permitted next step | High | Shared dashboard/deal-room policy release-tested and merged; remaining source/empty-state coherence pending | PRD-003–006 |
| External logistics grant reveals goods/bank data | Critical for provider pilot | Provider portal and service-order authorization not yet implemented | SVC-003/005/006/010 |
| Professional team cannot safely inherit code | Medium | Feature modules, quality gates and tests exist; monolithic pages/direct SQL/untyped boundaries remain | ARC-003–023 |
| Investor narrative outpaces traction/control evidence | High | Synthetic preview and engineering history exist; design partners, retention, economics and independent review remain | INV-*, GOV-006, SEC-018 |

Owners and risk-review dates must be assigned under GOV-002/008; this table is a risk inventory, not completed operational ownership. Historical test evidence is in RELEASE_EVIDENCE.md; current launch gates are in pilot-gates.json.


## Delivery checkpoint — 2026-10-08

- Founder accepted paged evidence selection and inventory-summary correction: full release passed, merge/pull complete.
- PER-001 / ARC-024: offers page and home offer totals are the next candidate slice, native release/merge pending. Max-100 pages, same party boundaries, separate full counts, explicit unavailable/retry states and legacy overflow refusal.
- Remaining: contracts, shipments, payments, compare-offer consumers, control-tower aggregates, embedded detail arrays/exports and representative hosted concurrent-load acceptance. Do not check these broad items complete based on this slice.


## Delivery checkpoint — contracts slice, 2026-10-08

- Founder accepted offers paging/counts and fixture corrections: release passed, merge/pull complete.
- PER-001 / ARC-024 next candidate: contracts paging and home active-order aggregate/latest active shortcut; native release/merge pending.
- Remaining: shipment/payment pages, legacy persona/control-tower aggregates, comparison consumers, detail collections/exports and hosted load/query-plan acceptance. Broad items stay IN PROGRESS.


## Delivery checkpoint — shipments slice, 2026-10-08

- Founder accepted contract paging/totals: release passed, merge/pull complete.
- PER-001 / ARC-024 shipment slice accepted 2026-10-08: founder confirms full release checks passed and merge/pull completed. Paged shipment list and full transport totals are verified. Existing Incoterm action ownership unchanged; regression cases cover all eleven terms.
- Remaining: payment pages, legacy persona/control-tower aggregates, comparisons, detail collections/exports and hosted load/query-plan acceptance. Broad items stay IN PROGRESS. Provider-marketplace access is separate future SVC work.


## Delivery checkpoint — payments slice, 2026-10-08

- Founder accepted shipment paging/totals: full release checks passed and merge/pull completed. Earlier browser failure is superseded by this acceptance.
- PER-001 / ARC-024 payment slice accepted 2026-10-08 15:05 UTC: founder confirms release checks passed and merge/pull completed. Max-100 scoped payment pages, literal server search, purchase/sale/status/currency filters and complete workflow counts are verified. Verification, document release, dispatch and settlement policies remain authoritative.
- Counts are payment workflows, not confirmed funds; currencies are never summed together. No migration or data reset.
- Remaining: legacy persona/control-tower aggregates, comparison consumers, detail collections/exports and hosted concurrent-load/query-plan acceptance. Broad items remain IN PROGRESS; provider service-market work is separate.


## Delivery checkpoint — workspace aggregates, 2026-10-08

- Payment paging/counts accepted by founder at 15:05 UTC: full release checks passed and merge/pull completed.
- PER-001 / ARC-024 workspace aggregates accepted 2026-10-08 16:40 UTC: founder confirms release, merge and pull, including marketplace eligibility assessment and slim-runtime corrections. Bounded aggregate-only overview, permission-scoped summaries, fail-closed retry and SQL-only readiness counts verified.
- Removed unused duplicate persona dashboard and hard-coded corridor/readiness/healthy-network claims from the control tower. Evidence totals explicitly describe metadata records, not approvals; product safety totals include retained holds after resolution.
- Remaining: comparison consumers, product/certificate/recall and other detail collections/exports, representative hosted concurrent-load/query plans and broader readiness recommendation policy. No broad completion credit or provider authorization introduced.

## Delivery checkpoint — certificate register candidate, 2026-10-08

- Certificate register accepted by founder 2026-10-08 17:21 UTC: release checks passed and merge/pull completed. Scoped max-100 pages, server filters, full recorded-state counts and legacy overflow verified. No certification mandate introduced.
- PER-001/ARC-024 remain IN PROGRESS. Embedded detail collections, products/recalls, exports and hosted performance acceptance remain open.

## Delivery checkpoint — embedded certificates candidate, 2026-10-08

- Farm detail opts out of embedded certificate arrays and uses independently authorized farm-scoped pages/totals. Legacy farm certificates respect certificate permission/list relationships and explicit overflow. Batch attestation selector pages/searches with retained selections and visible failures. Accepted by founder 2026-10-08 18:10 UTC: full release checks passed and merge/pull completed.
- Broad PER-001/ARC-024 remain IN PROGRESS: plots, batch evidence, product/recall collections, exports and hosted load/query-plan verification remain open.

## Delivery checkpoint — source detail collections candidate, 2026-10-08

- Farm plot pages/totals and batch evidence pages/totals replace embedded histories. Legacy detail arrays explicitly refuse overflow; evidence requires its own read permission and entity relationship. Accepted by founder 2026-10-08 18:55 UTC: full release checks passed and merge/pull completed.
- PER-001/ARC-024 remain IN PROGRESS: other embedded source metadata, product/recall collections, exports and hosted performance acceptance remain open.

## Delivery checkpoint — product register candidate, 2026-10-08

- Product-profile pages and full scoped totals replace complete-history UI reads. Literal search/filtering precedes page limits; retained recall holds remain visible, and evidence metadata counts no longer imply approval. Accepted by founder 2026-10-08 21:04 UTC: full release checks passed and merge/pull completed.
- PER-001/ARC-024 remain IN PROGRESS: public product detail histories, recall collections, exports and hosted performance acceptance remain open.

- Product register candidate correction: founder Windows unit run hit the default five-second CRLF fixture/process test timeout (not a reported hash mismatch). Added local suite/hook allowances and bounded checker subprocess diagnostics; unchanged integrity assertions. Superseded by founder release/merge/pull acceptance at 21:04 UTC.

- Product register native candidate: founder reports 317/317 integration assertions passed; teardown failed on the retained-hold fixture's non-cascading notice FK. Corrected child-before-parent fixture cleanup and guaranteed pool close. Superseded by founder full-release/merge/pull acceptance on 2026-10-08 at 21:04 UTC; no production constraint or data change.

## Delivery checkpoint — recall register accepted, 2026-10-09

- Authenticated recall pages and full scoped totals replace unbounded history/nested-array UI reads. Register exposes linked counts; recipient/manager response actions remain independently authorized. Founder confirms release checks passed and merge/pull completed on 2026-10-09 at 15:01 UTC.
- PER-001/ARC-024 remain IN PROGRESS: recall response detail collections, public product histories, exports and hosted performance acceptance remain open.

- Recall register candidate correction: founder browser output identified ambiguous totals headings and response form detachment during background refresh. Named totals selectors and opt-in same-page row retention preserve drafts while pending; failed reads and changed contexts clear stale actions. Two browser regressions added. Explicit holding/textarea accessible names stabilize exact selectors; lightweight legacy inventory/transfer ID preflights reject overflow before recall projection without changing read deadlines. Full exact-candidate release/merge/pull accepted by founder on 2026-10-09 at 15:01 UTC.

- Next focused slice: bounded recall response detail collections and recovery/evidence selectors, preserving recipient/manager scope, unsaved drafts, safety holds and fail-closed read behavior. Public product histories, exports and hosted performance acceptance follow; broad items receive no completion credit yet.

## Delivery checkpoint — recall response pages accepted, 2026-10-09

- PER-001 / ARC-024: independently scoped keyset pages and full scoped totals for recall recipients, affected holdings, recovery history and clean evidence metadata. Search precedes limits; page size is capped at 100. Legacy overflow rejects before expensive response projection.
- One selected holding is re-read by exact scoped ID independently of its current page. Recovery snapshots, bounded evidence selection and unsaved drafts survive successful paging/focus refresh; failed reads or revoked membership remove actions. Mutation authorization, whole-recall resolution checks and retained safety holds remain authoritative.
- Author validation: 609 API unit assertions passed; quality, workspace/browser type checks and API/web builds passed. Added six PostgreSQL cases and five browser cases; Founder confirms exact-candidate release checks passed and merge/pull completed on 2026-10-09 at 16:48 UTC, including JSON quantity and scoped recovery-journey selector corrections.
- Broad PER-001 / ARC-024 remain IN PROGRESS. Remaining public product histories, exports and hosted performance acceptance are still open; this slice is accepted; broad items remain open until remaining collections and hosted performance acceptance are complete.

- Recall response candidate correction: founder PostgreSQL run passed 326/327 assertions; one new assertion expected a driver-level numeric string inside `row_to_json`. PostgreSQL emits a JSON number there. Corrected the expected value to numeric 1, retaining exact quantity, holding and note checks. No application, schema, timeout or authorization change. Superseded by founder full-release/merge/pull acceptance on 2026-10-09 at 16:48 UTC.

- Recall response browser correction: the real recovery journey matched the same quantities in affected inventory and the new recovery-history section. Named the affected-inventory region and scoped both returned/destroyed assertions to it. No `.first()` workaround, write-path or safety-policy change. Superseded by founder full-release/merge/pull acceptance on 2026-10-09 at 16:48 UTC.

## Delivery checkpoint — public reviewed evidence accepted, 2026-10-09

- PER-001 / ARC-024: anonymous published-profile evidence pages with literal search, max-100 rows, profile/search-bound cursors, full eligible totals and explicit embedded first-page metadata. Public responses contain metadata only; no storage or uploader fields or download tokens.
- Eligibility uses the latest review, independent reviewer identity, unexpired approval, validated evidence and a clean scan. Archived/draft profile reads fail on every request, even with a previously valid cursor. Public proof paging has separate failure/retry states; active recall/retained hold presentation remains independent of proof pages.
- Author validation: 618 API unit assertions passed; quality, workspace/browser types and API/web builds passed. Added native 1,005-record/eligibility/publication/cursor regressions and browser page/search/failure/revocation checks. Founder confirms full release checks passed and merge/pull completed on 2026-10-09 at 17:41 UTC. This evidence slice is accepted; broader public history and hosted performance work remain open.
- PER-001 / ARC-024 remain IN PROGRESS: public journey and notice histories, remaining exports and hosted performance acceptance follow. Evidence paging is not completion of all public profile history work.

## Delivery checkpoint — public journey pages accepted, 2026-10-09

- PER-001 / ARC-024: published-profile timeline pages capped at 100 with literal search, full event counts and time/ID keyset navigation. Lightweight source rows precede page-only display hydration across harvest, current attestation, accepted custody, shipment and recall events. Embedded profile journey is a 50-row first page with explicit metadata.
- Profile/batch/search-bound time cursors preserve equal timestamps using stable namespaced IDs and exact numeric time keys; pre-1970 dates remain pageable. Publication and expected profile association are rechecked on each read. Existing review semantics and separate recall/hold warnings remain authoritative.
- Author validation: 627 API unit assertions passed, quality, workspace/browser types, API/web builds and strict native-test source compilation passed. Five PostgreSQL and three browser cases added. Founder confirms release checks passed and merge/pull completed on 2026-10-09; native acceptance is founder-reported, without an independently archived CI link.
- Broad PER-001 / ARC-024 remain IN PROGRESS. Next: public recall notice paging/aggregate safety, then remaining exports and hosted performance/query-plan acceptance. This is not completion of all public profile read work.


## Delivery checkpoint — public safety and audit export boundaries accepted, 2026-10-09

- PER-001 / ARC-024: parallel implementation of published-profile notice paging and complete bounded audit exports; independent security review followed by integrated delivery.
- Recall relationships cover affected batches/lots, retained holding holds and returned/destroyed recoveries without duplicate notices. Full active/resolved/severity counts and retained-stock warnings stay independent of page/search/status. Public journeys use the same relation scope. Published profile association is rechecked before returning assembled data.
- Public notice UI supports search/status/navigation and explicit unavailable/retry states; read failure must not present a cached clear safety badge.
- Audit export retains its complete JSON-array contract and organization/explicit network permission boundaries. ID-first preflight caps reports at 1,000 records and 4 MiB, refuses overflow without a partial attachment, and awaits durable export attribution.
- Candidate author verification and native release acceptance are recorded in the release instructions. No schema, dependency, configuration or data reset.
- PER-001 / ARC-024 remain IN PROGRESS: audit register paging, provenance export/remaining embedded collections, public-field consent policy and hosted plans/load acceptance remain open. Founder confirms full release checks passed and merge/pull completed on 2026-10-09 at 19:14 UTC. These two slices are accepted; broad items remain open.


## Delivery checkpoint — audit register and provenance report boundaries candidate, 2026-10-09

- PER-001 / ARC-024 / ARC-010: parallel audit register paging/full totals and a shared bounded provenance view/export builder, with an independent security review.
- Audit register must filter authorized records before limiting, use scoped cursors and preserve full totals independent of the displayed page. Explicit errors/retry replace misleading empty history.
- Provenance reports must preserve batch/contract authority and complete report semantics within collection/byte budgets; oversized reports fail explicitly rather than dropping proof.
- Forward migration 034 adds organization/global audit chronology indexes. Pre-pilot ordinary index creation locks audit writes; large live installations require a separate concurrent deployment plan.
- Release acceptance is pending. No broad completion credit; hosted query plans/load measurements and remaining architecture work stay open.
