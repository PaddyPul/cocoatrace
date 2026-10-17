# BetterTrade delivery backlog

**Purpose:** Single source of truth for work required to move BetterTrade from a passion project to an investor-ready, pilot-safe and production-capable company.
**North Star:** [`NORTH_STAR.md`](./NORTH_STAR.md)
**Pilot launch plan:** [`BETTERTRADE_PILOT_PLAN.md`](BETTERTRADE_PILOT_PLAN.md)
**Progress audit:** [`BACKLOG_GROOMING_2026-10-13.md`](BACKLOG_GROOMING_2026-10-13.md) (supersedes the 2026-10-06 snapshot)
**Architecture direction:** [`ARCHITECTURE_MODERNIZATION.md`](./ARCHITECTURE_MODERNIZATION.md)
**Last triaged:** 2026-10-15
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

Status markers in the named rows are authoritative. Earlier candidate/checkpoint paragraphs are historical and may be superseded by later acceptance and grooming records. Founder-reported local release acceptance is distinguished from independently archived CI and hosted evidence.

Current zero-budget implementation: **BST-001** supervised synthetic preview runner and email-restricted temporary HTTPS. See [`runbooks/ZERO_COST_DEMO_PREVIEW.md`](runbooks/ZERO_COST_DEMO_PREVIEW.md). Founder confirmed native preview startup and allowed-email PIN access on 2026-10-02; anonymous probe denial passed. Live staging and an independently tested unlisted visitor remain separate.

## Bootstrap budget and expansion constraints

Hosting budget is **USD 0/month** until the founder explicitly changes it. Do not activate paid plans, auto-upgrades, metered overages or trial-dependent infrastructure. See [`runbooks/FREE_STAGING_PLAN.md`](runbooks/FREE_STAGING_PLAN.md). Provider signup and account verification belong to the founder; repository configuration and automation belong to the implementation work. Free hosting does not waive private uploads, malware scanning, tenant isolation or restore gates.

Hosting follow-ups **BST-001–003** and their completion tests are maintained in the linked free-staging runbook; include them when counting the backlog.

### Multi-currency

- [-] **CUR-001 · IN PROGRESS · P1 · Phase 2:** Agree pilot currencies and document a currency policy. One explicit ISO currency per listing, offer and accepted contract; distinguish trade currency from display preferences. Completion: approved supported-currency matrix and mismatch rules.
- [-] **CUR-002 · IN PROGRESS · P1 · Phase 2:** Carry contract currency through payment installments, fees, invoices, refunds and reconciliation; API rejects incompatible offers/payments. Preserve existing recorded currencies during migration. Completion: end-to-end tests prove no silent currency changes.
- [x] **CUR-003 · P1 · Phase 2:** Centralize exact monetary arithmetic and rounding by currency minor units; never use floating-point money calculations. Completion: boundary tests cover two-decimal and zero-decimal currencies, installments and fee totals. CLOSED 2026-10-13 grooming: Exact BigInt/NUMERIC totals, deposits, balances and fees use snapshotted two-decimal/JPY precision. Native and browser currency waves are founder accepted. Refund/FX/commercial approval remain CUR-001/002/004/005, not missing arithmetic.
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

## Progress snapshot — 2026-10-13 reconciliation

Run `npm run backlog:progress` for an exact recount. The generated counts are recorded in [the grooming audit](BACKLOG_GROOMING_2026-10-13.md). Named rows only are counted; decisions and BST runbook rows are included. Partial work gets no fractional credit. Full-roadmap completion differs from closed pre-pilot gates and does not measure valuation.

## Current execution queue

**Active combined closure candidate (2026-10-17):** ARC-008 recall activation/notification/response repository boundaries and RCL-010 operation authority. Evidence/payment wave accepted:140/343 (40.8%). Two targets yield142/343 (41.4%) after full release/review/merge. Core11/28 and provider-inclusive11/40 unchanged.

1. **Finish monitored durable operations (OPS-010 / OPS-006):** scheduled scanning/cleanup/reminder/recall jobs, deployment locks, durable status, private monitor and audited cleanup retries are accepted through the founder's 2026-10-13 completion report. Reviewed terminal-email recovery and the per-batch listings-summary correction are founder release/merge accepted 2026-10-13; validation is recorded in [the handoff](releases/TERMINAL_EMAIL_RECOVERY_WINDOWS.md) and [the correction](releases/LISTING_SUMMARY_READ_FIX_WINDOWS.md). Bounded cleanup/reminder/recall backlog and incident visibility, including isolated administrator fixtures, is founder workflow accepted 2026-10-13. The founder reports the opt-in operator-alert workflow done on 2026-10-14. Reviewed terminal-operator-alert recovery is founder release/merge/pull accepted 2026-10-14. The authorization register is founder release/merge/pull accepted 2026-10-14; engineering now moves to paired resource/role checks; real external inbox/ownership/hosted acceptance remain separate. Remaining: scanner/DB/HTTP/abuse signals, external alert routing, a named incident owner and hosted failure drills. Do not rebuild the scheduler or repeat manual identity/trade journeys.
2. **Close the pilot security evidence matrix (QLT-002 / SEC-006/007/014 / SAF-002/003/004):** map every protected route/resource and negative case; record consistent nondisclosure/error policy, deployed secrets/CSP/private-storage checks and third-party image/privileged operator review. Shared abuse limits, origin boundary, passkey enforcement and suspension implementation are accepted; deployment-specific acceptance remains separate.
3. **BetterTrade compatibility map and customer identity (BRD-002 then BRD-001):** inventory database/volume/storage/session/cookie/preference/package/remote identifiers before a customer-facing rename. Preserve existing installations and frozen migrations. Name/domain/legal approval remains BRD-004; no global replacement.
4. **Product completion and remaining boundary audit (PRD-003/005/010/011, PER-001 / ARC-024):** saved-brief reopening/editing, request/route-specific evidence guidance and unreviewed legacy collection/export/error paths. The accepted source/inventory/marketplace/evidence/trade/payment/certificate/product/recall/public/audit/provenance/sourcing/admin/review register slices must not be counted as unimplemented. Finish the endpoint inventory and measured hosted plans before claiming universal bounds.
5. **Hosted pilot acceptance (ENV-004–014, UPL-002/018, OPS-001/002/007–012, PER-004, IDN-021):** secure free-capacity/account decision, isolated services, real inbox delivery, full database plus private-byte recovery, representative combined-worker/transfer load, incident owner and archived release evidence. Local synthetic access is not hosted staging.
6. **Commercial enrollment, then service marketplace (GEO-001, IDN-005, LEG/DEC items, SVC-001–012):** agree named participants, supported commodity/corridor/mode, fee/terms/privacy and support boundaries. Build provider qualification/RFQ/quote/award/minimal job grants only after their policy is agreed; core pilot and provider launch remain separate.

Keep at most three independent engineering slices active; finish failing releases before starting another. Infrastructure provisioning, legal/commercial decisions and design-partner recruitment can run alongside engineering. $0 hosting is an unresolved operating constraint, not a security exemption. If secure free resources cannot meet the pilot gates, continue synthetic demos and record the funding blocker.

---

# 1. Governance and delivery discipline

- [x] **GOV-001 · P0 · Phase 0:** Put the North Star, roadmap, architecture direction and delivery backlog in the repository.
- [ ] **GOV-002 · P1 · Phase 0:** Assign a named owner to every active P0/P1 item. Done when no active item is ownerless.
- [ ] **GOV-003 · P1 · Phase 0:** Add a weekly 30-minute product/engineering risk review. Record decisions, blocked items, incidents and changed priorities in this backlog.
- [x] **GOV-004 · P1 · Phase 0:** Create docs/adr and record hosting, session, tenant isolation, storage, jobs, onboarding and payment decisions. CLOSED 2026-10-15 16:32 UTC: founder reports corrected full release passed and merged. Implemented: indexed ADR003–009 supply current engineering decisions, alternatives/consequences and actual evidence; historical001/proposed002 retain their status. Publication accepted; hosted provisioning remains separate.
- [ ] **GOV-005 · P2 · Phase 1:** Add CODEOWNERS after maintainers are known. Sensitive modules require review from their named owner.
- [ ] **GOV-006 · P1 · Phase 0:** Protect `main`: require pull requests, green CI and resolved review comments.
- [x] **GOV-007 · P2 · Phase 1:** Define release naming, changelog and semantic versioning conventions. CLOSED 2026-10-15: founder reports corrected integrated release passed and merged. Implemented: CHANGELOG.md and governance/RELEASE_AND_COMPATIBILITY_POLICY.md define explicit initial version choice, rc/release naming, immutable SHA/artifact evidence and per-release changelog review without fabricating historical releases. Founder review/release accepted.
- [x] **GOV-008 · P1 · Phase 1:** Maintain a visible risk register with likelihood, impact, mitigation, owner and review date. CLOSED 2026-10-15 16:32 UTC: founder reports corrected full release passed and merged. Implemented: eight risks with coordinating founder owner, likelihood/impact, mitigation/backlog/evidence and next review2026-10-22. Generated visible view is checked against JSON in CI/release; due review is reported without closing risk automatically. Founder publication/release accepted.
- [x] **GOV-009 · P2 · Phase 2:** Publish a customer-facing known-limitations page for every pilot release. CLOSED 2026-10-15: founder reports corrected integrated release passed and merged. Implemented: versioned signed-in /pilot/limitations page, sidebar discovery, honest payment/trust/transport/currency/language/security limits and mandatory every-release review procedure; browser discovery/reload/no-write regression supplied. Release accepted.
- [x] **GOV-010 · P2 · Phase 2:** Establish a deprecation policy for API fields, statuses and customer workflows. CLOSED 2026-10-15: founder reports corrected integrated release passed and merged. Implemented: published notice/version/consumer-migration/unknown-state rules, in-flight trade protection and reviewed security exception handling. Current pre-pilot rejection-body tightening is explicitly called out. Founder review/release accepted.

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
- [x] **ENV-012 · P1 · Phase 1:** Add migration compatibility rules for rolling deployment and rollback. CLOSED 2026-10-15: founder reports release passed and merged. Reviewed expand/transition/contract, mixed-version API/worker, lock/backfill and rollback policy includes older-artifact ledger-startup refusal. No migration-skip mode or rolling infrastructure claimed.
- [ ] **ENV-013 · P1 · Phase 1:** Add staging and production readiness smoke tests after every deployment.
- [-] **ENV-014 · P1 · Phase 1:** Publish deployed Git SHA, build time and environment in a protected diagnostics endpoint. IN PROGRESS 2026-10-15: wildcard-only no-store /operations/deployment with strict build-artifact projection, real build timestamp and supplied full BUILD_GIT_SHA; missing/invalid stamp explicitly incomplete. Docker and host build stamping + nine unit/native boundary cases supplied. Current Compose does not supply stamp by default; actual stamped deployment/readback remains required, so no closure credit.
- [ ] **ENV-015 · P2 · Phase 2:** Add pull-request preview deployments without production secrets or persistent customer data.
- [x] **ENV-016 · P1 · Phase 1:** Add a safe, explicit demo reset job that cannot address staging or production. CLOSED 2026-10-15: founder reports integrated release passed and merged. Pre-pool guard refuses staging/production and all unrecognized/remote PostgreSQL targets, including driver query/fragment overrides; legacy override cannot bypass safety. Regression/runbook accepted; no reset executed during handoff.
- [ ] **ENV-017 · P1 · Phase 1:** Add deployment concurrency controls so an older release cannot overwrite a newer one.
- [x] **ENV-018 · P2 · Phase 2:** Document domain, DNS, TLS, cookie and CORS configuration for every environment. CLOSED 2026-10-15: founder reports release passed and merged. Source-checked local/preview/staging/production ingress contract, DNS/TLS checks, exact cookie/origin/passkey settings and proxy trust limitations accepted. Hosted provisioning/verification remains separate.
- [x] **ENV-019 · P0 · Phase 1:** Repair empty-database bootstrap and rehearse both fresh startup and existing-database upgrade. Discovered 2026-10-01: migration 001 loads the frozen schema snapshot through 010, then migration 009 attempts to add an existing `batches.source_mode` column. Done when the normal release migration command succeeds from empty PostgreSQL and upgrades an existing ledger without resetting data or changing frozen migrations/checksums. The browser/API test baseline preparation does not close this production release blocker. IMPLEMENTED: normal-runner bootstrap repair and production-configured fresh/upgrade regressions are implemented. API build, 144 unit tests, migration integrity and nine nonconcurrent CLI scenarios passed locally against temporary WASM PostgreSQL. Native PostgreSQL/container CI evidence, including concurrency, remains required. See ADR 001 and `docs/runbooks/MIGRATION_STARTUP.md`. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.

# 3. Architecture and code quality

- [x] **ARC-001 · P1 · Phase 1:** Add a typed `config/` module and remove scattered environment parsing.
- [-] **ARC-002 · P1 · Phase 1:** Define shared actor, organization scope, money, quantity and identifier types. IN PROGRESS 2026-10-13 grooming: Shared authenticated actor, assurance actor and exact money helpers exist; shared organization-scope/quantity/identifier types are not adopted throughout.
- [-] **ARC-003 · P1 · Phase 1:** Create reusable resource policy interfaces and move authorization decisions out of controllers. IN PROGRESS (grooming): Shared resourcePolicy checks exist; adoption and typed interfaces across all controllers remain incomplete.
- [x] **ARC-004 · P1 · Phase 1:** Extract evidence controller logic into service, policy, repository and infrastructure adapters. COMPLETE — Evidence download policy, metadata repository, storage and response lease adapters accepted after founder-reported full release and merge.
- [x] **ARC-005 · P1 · Phase 1:** Extract offer acceptance and inventory reservation into one transactional trading use case. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **ARC-006 · P1 · Phase 2:** Extract payment-plan and installment state machines. COMPLETE — Payment creation and shared five-plan policy join existing terms/installment/document/security/issue/settlement use cases; founder reports full release and merge.
- [x] **ARC-007 · P1 · Phase 2:** Extract shipment and delivery state machines. CLOSED 2026-10-17: founder confirms full release passed and merged. Typed transport transitions and complete registered cookie-write origin matrix accepted; existing native/browser behavior retained. Broader resource authorization and hosted ingress remain separate.
- [-] **ARC-008 · P1 · Phase 2:** Extract recall activation, notification and resolution use cases. IN PROGRESS — typed activation, participant/outbox and response repositories with pure operation policy; exact-commit runtime release/review/merge pending.
- [x] **ARC-009 · P2 · Phase 2:** Split public product administration, public rendering and recall code into separate modules. CLOSED 2026-10-15: founder reports integrated release passed and merged. Separate rendering/administration/recalls owners, shared publicUrl helper and compatibility barrel preserve routes/policies; seven behavior regressions plus native release accepted.
- [x] **ARC-010 · P2 · Phase 2:** Replace duplicated provenance view/export logic with one provenance builder and response mappers. Shared bounded authorized builder and separate view/export network scopes accepted by founder 2026-10-10 14:58 UTC after full release pass and merge/pull, including fixture cleanup and audit browser authentication corrections.
- [-] **ARC-011 · P2 · Phase 2:** Move SQL from migrated controllers into repositories/query modules. IN PROGRESS 2026-10-13 grooming: Migrated catalog reads use query/repository modules; remaining controller mutation SQL and full boundary adoption are open.
- [x] **ARC-012 · P2 · Phase 2:** Introduce a transaction boundary abstraction used by application services. IMPLEMENTED: Shared trading transaction boundary commits business mutations and audit events together; rollback tests are implemented. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **ARC-013 · P1 · Phase 2:** Write critical business changes, audit records and outbox events atomically. IN PROGRESS (grooming): Trading/payment critical changes and audit writes share transactions; route-wide audit/outbox coverage needs an explicit matrix.
- [-] **ARC-014 · P2 · Phase 3:** Durable payment/recall outboxes, retries, scheduled ownership and cleanup recovery are accepted. Reviewed terminal-email recovery with transactional assurance/auditing and bounded monitor reads is founder release/merge accepted 2026-10-13. Opt-in operator incident episodes/outbox, bounded retries and private delivery status are founder workflow accepted 2026-10-14. Reviewed terminal-alert recovery is founder release/merge/pull accepted 2026-10-14. Real external inbox acceptance, external callbacks and hosted failure operation remain open.
- [x] **ARC-015 · P2 · Phase 3:** Split `web/src/pages/DataPages.tsx` into feature-owned routes and components. CLOSED 2026-10-13 grooming: DataPages.tsx is a compatibility export barrel; inventory, source, contract, shipment, payment, evidence, audit, certificate and organization routes now have feature-owned components and accepted page regressions. Broader component/client/type cleanup remains ARC-016/017/018.
- [x] **ARC-016 · P2 · Phase 3:** Split `web/src/api.ts` into a shared HTTP client and feature clients. CLOSED 2026-10-14 20:25 UTC: founder reports integrated release checks passed and merge/pull completed. Implemented: singleton HTTP/session/MFA transport and ten feature clients, compatibility exports preserved, six transport regressions required in release/CI. Founder local release accepted; independent CI URL not archived; see releases/SECURITY_ARCHITECTURE_CLOSURE_WINDOWS.md.
- [x] **ARC-017 · P2 · Phase 3:** Split `web/src/types.ts` into module-owned schemas and domain types. CLOSED 2026-10-14 20:25 UTC: founder reports integrated release checks passed and merge/pull completed. Implemented: all 35 existing declarations moved unchanged to 14 domain owners with type-only acyclic dependencies, compatibility barrel and 27 consumer migrations. No runtime schemas existed to relocate. Founder local release accepted; no hosted claim.
- [-] **ARC-018 · P2 · Phase 3:** Refactor batch, contract and shipment route components into focused components and hooks. IN PROGRESS 2026-10-13 grooming: Feature-owned contract/shipment/source record routes exist; complete focused workflow hook/component extraction remains open.
- [-] **ARC-019 · P2 · Phase 3:** Replace compressed multi-operation functions with readable, named use cases. IN PROGRESS: contract payment-term handlers are HTTP adapters over named typed use cases; remaining controller extraction stays open; the applicable native release is founder accepted.
- [-] **ARC-020 · P2 · Phase 3:** Eliminate `any` from high-risk domain, authorization, payment, evidence and traceability paths. IN PROGRESS 2026-10-13 grooming: Strict no-any enforcement covers migrated security/MFA/transport/payment/delivery/trace/catalog/operations modules; legacy evidence/auth/controller paths still require cleanup.
- [ ] **ARC-021 · P2 · Phase 3:** Publish and maintain an OpenAPI specification.
- [ ] **ARC-022 · P2 · Phase 3:** Generate or strongly type the frontend API boundary from the OpenAPI contract.
- [-] **ARC-023 · P2 · Phase 3:** Introduce stable error codes and a consistent API error envelope. IN PROGRESS 2026-10-13 grooming: Shared AppError and stable bounded-resource codes exist; manual login/controller responses still omit codes, so a universal envelope is incomplete.
- [-] **ARC-024 · P2 · Phase 3 · IN PROGRESS:** Accepted feature-owned paged/query modules cover the resource slices listed under PER-001 and delivery checkpoints. Remaining: explicit all-route/list/export inventory and any unreviewed legacy boundaries; hosted capacity remains PER-004. Earlier evidence-selector/native-pending text is superseded by founder acceptance.
- [x] **ARC-025 · P2 · Phase 3:** Authoritative database sessions, hashed tokens, live actor/organization checks and revocation are implemented. CLOSED 2026-10-06 grooming: authSessionService.ts and identity/session integration/browser regressions; founder previously tested and merged identity/email waves. MFA and admin suspension tooling remain separate IDN items.
- [ ] **ARC-026 · P3 · Phase 4:** Add commodity policy/configuration interfaces before onboarding the second commodity.
- [ ] **ARC-027 · P3 · Phase 4:** Add transformation workflow ports and domain types only when a validated customer requires blending/repacking.
- [x] **ARC-028 · P2 · Phase 2:** Audit package-script entry points and remove or repair obsolete aliases. Discovered 2026-10-01: `api` scripts `db:migrate:js` and `db:seed:js` reference absent files. Done when documented commands resolve to supported runners and a lightweight script-contract check prevents recurrence. CLOSED 2026-10-05: founder reports quality gate/correction tested, merged and pulled.

# 4. Identity, registration and organizations

- [ ] **IDN-001 · P0 · Phase 1:** Remove every shared demo account from staging and production.
- [x] **IDN-002 · P1 · Phase 1:** Implement “Request access” for buyer and supplier organizations. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-003 · P1 · Phase 1:** Add organization states: application pending, review pending, verified, rejected and suspended. CLOSED 2026-10-13 grooming: Application/review/verified/rejected states and audited ordinary/two-reviewer privileged suspension/restoration are implemented and founder accepted. Actual pilot enrollment is separately IDN-005/GEO-001.
- [x] **IDN-004 · P1 · Phase 1:** Require email verification before an organization application can proceed. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [-] **IDN-005 · P1 · Phase 1:** Manually approve the first pilot organizations and record reviewer/time/reason. IN PROGRESS: approval/rejection and reviewer auditing are implemented; real pilot enrollment remains open.
- [x] **IDN-006 · P1 · Phase 1:** Create the first organization administrator only after organization approval. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-007 · P1 · Phase 1:** Keep additional users invitation-only during the pilot. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-008 · P1 · Phase 1:** Send invitation emails; add resend, revoke and expiry controls. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
  - Repository implementation now sends first-admin approval invitations, records invitation submission outcomes, hides bearer links outside demo/test, rotates verification/resend links, and prevents resend from reviving revocation. Local capture inbox and regression tests added. Windows PostgreSQL tests and staging inbox verification remain release gates. Local UI testing previously confirmed delivery was suppressed by the development adapter. Before pilot release, configure SMTP separately for staging/production, and verify recipient inbox delivery for email verification, first-admin invitation, team invitation/resend and password reset. Exercise delivery failure and safe retry; never report an email as sent when suppressed. See `docs/runbooks/IDENTITY_EMAIL_DELIVERY.md`.
- [x] **IDN-009 · P0 · Phase 1:** Implement password reset with single-use hashed tokens, uniform responses and rate limits. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-010 · P1 · Phase 1:** Implement password change and revoke other sessions after sensitive account changes. Verified by implemented API/browser regressions and user-reported local testing; identity/email branches reported merged.
- [x] **IDN-011 · P1 · Phase 1:** Implement user suspension/deactivation and immediate session revocation. CLOSED 2026-10-06: founder confirms privileged access lifecycle release checks passed and merge/pull completed. Ordinary audited HTTP suspension/restoration plus console-only two-reviewer user/organization suspension/restoration and user deactivation are implemented and release-tested. Fresh passkey review, target isolation, two usable-admin continuity, session/reset/challenge/invitation revocation and atomic auditing are covered. Old sessions never revive; deactivated users cannot receive recovery approval. Hosted operator acceptance, actual reviewer independence and emergency bootstrap remain tracked separately under SAF-004/IDN-018/IDN-019. See runbooks/PRIVILEGED_ACCESS_LIFECYCLE.md. CI URLs are not independently archived.
- [x] **IDN-012 · P1 · Phase 2:** Require MFA for platform admins, certifiers, regulators and organization admins. CLOSED 2026-10-13 grooming: Deployed privileged-role MFA, restricted password sessions, fresh writes, passkey enrollment/revocation and reset preservation are implemented and founder accepted. Physical/hosted operator review and emergency recovery remain SAF-004/IDN-018/019; no hosted verification is inferred.
- [x] **IDN-013 · P1 · Phase 1:** Replace process-memory login throttling with shared, account-aware and IP-aware limits. CLOSED 2026-10-06: founder reports corrected auth-boundary release pulled and merged. Native prior run passed 191 integration tests; final corrected browser/recovery release completion is founder-reported, without independently archived CI URL. Public endpoint expansion remains SEC-011.
- [x] **IDN-014 · P1 · Phase 1:** Add security events for failed login, reset, MFA and session revocation. CLOSED 2026-10-13 grooming: Failed login, reset, MFA ceremony and session-revocation security events are implemented and release accepted. External alert routing, immutable retention and recovery notifications remain SEC-017/OPS-006/IDN-018.
- [ ] **IDN-015 · P1 · Phase 1:** Record terms/privacy version and acceptance timestamp per user.
- [x] **IDN-016 · P2 · Phase 2:** Add organization member role changes with least-privilege constraints and audit. CLOSED 2026-10-16: founder confirms corrected full release passed and merged; bounded member administration, real-passkey native fixtures and privileged-review/browser corrections accepted. See releases/TEAM_ACCESS_REVIEW_PR.md. Hosted operator exercises remain separate.
- [x] **IDN-017 · P2 · Phase 2:** Add an organization-admin member screen for invite, deactivate and role review. CLOSED 2026-10-16: founder confirms corrected full release passed and merged; bounded member administration, real-passkey native fixtures and privileged-review/browser corrections accepted. See releases/TEAM_ACCESS_REVIEW_PR.md. Hosted operator exercises remain separate.
- [-] **IDN-018 · P2 · Phase 2:** Add recovery procedures for lost MFA and locked accounts. IN PROGRESS 2026-10-06: two freshly verified independent platform-account reviewers, server-console approval, session/key revocation, single-consumption 30-minute replacement enrollment and a review runbook implemented. Founder confirms the passkey/recovery wave merged on 2026-10-06. Hosted rehearsal, owner-verification review, out-of-band notifications and emergency bootstrap recovery remain open.
- [x] **IDN-019 · P2 · Phase 3:** Add periodic privileged-access review and stale-account reporting. CLOSED 2026-10-16: founder confirms corrected full release passed and merged; bounded member administration, real-passkey native fixtures and privileged-review/browser corrections accepted. See releases/TEAM_ACCESS_REVIEW_PR.md. Hosted operator exercises remain separate.
- [ ] **IDN-020 · P3 · Phase 4:** Evaluate enterprise SSO only after customer demand is validated.
- [-] **IDN-021 · P1 · Phase 1:** Complete identity email delivery setup and end-to-end inbox verification. Done when verification, approval invitation, team invitation/resend and password reset arrive in the intended inbox in staging, expired/revoked/reused links are rejected, and delivery failures can be retried without creating duplicate organizations or accounts. Local demo links alone do not close this item. User reports all local identity/email checks passed on 2026-10-01; real provider and staging inbox verification remain open.

# 5. Authorization and application security

- [x] **SEC-001 · P0 · Phase 1:** Document route/resource authorization matrix with explicit network-wide permissions. See [`security/AUTHORIZATION_MATRIX.md`](security/AUTHORIZATION_MATRIX.md).
- [x] **SEC-002 · P0 · Phase 1:** Farm, certificate, batch, product-profile, provenance, evidence and indirect contract IDOR fixes pass the real-PostgreSQL two-tenant regression suite.
- [x] **SEC-003 · P0 · Phase 1:** Ordinary reads are tenant/relationship bounded, explicit `*.all`/`*.network` grants are exercised, and ordinary users cannot inherit network-wide reads.
- [x] **SEC-004 · P0 · Phase 1:** Provenance binds `contractId` to both the batch and an authorized contract party; direct and export splicing regressions pass against PostgreSQL.
- [x] **SEC-005 · P0 · Phase 1:** Contract document listing, attachment and download inherit contract-party authorization and reject unrelated organizations in PostgreSQL tests.
- [-] **SEC-006 · P1 · Phase 1:** IN PROGRESS 2026-10-14: missing/invalid credentials use 401 and missing declared permissions use 403 before payload processing; the route register and native permission/recall nondisclosure cases are founder release/merge/pull accepted 2026-10-14. Source/plot/batch/certificate/holding and contract/payment/shipment private-read conventions and regression slices are founder release/merge accepted 2026-10-14, including post-guard UUID validation and snapshot consistency. Complete resource-existence convention and endpoint-by-endpoint foreign-ID acceptance remain open; see security/ROUTE_SECURITY_REVIEW_2026-10-14.md.
- [x] **SEC-007 · P1 · Phase 1:** Add CSRF/origin tests for every cookie-authenticated state-changing request. CLOSED 2026-10-17: founder confirms full release passed and merged. Typed transport transitions and complete registered cookie-write origin matrix accepted; existing native/browser behavior retained. Broader resource authorization and hosted ingress remain separate.
- [-] **SEC-008 · P1 · Phase 1:** Add a restrictive Content Security Policy and verify public profile assets. IN PROGRESS (grooming): Helmet headers exist; deployed CSP, public assets and injection regressions remain unverified.
- [x] **SEC-009 · P1 · Phase 1:** Review all outbound/tracking/hero URLs against allowlist and safe rendering rules. CLOSED 2026-10-14 20:25 UTC: founder reports integrated release checks passed and merge/pull completed. Implemented: complete source inventory, HTTPS/public-host authority rule, unsafe legacy link/hero suppression, safe same-origin profile navigation, no-referrer/opener isolation, storage validation and browser regressions. Founder local release accepted; independent CI URL not archived; see security/OUTBOUND_URL_REVIEW_2026-10-14.md.
- [-] **SEC-010 · P1 · Phase 1:** Add request-body and query-size limits globally. IN PROGRESS 2026-10-15: explicit 100KiB JSON limit, redacted malformed/oversized-body envelopes and bounded pre-parser raw/decoded query budgets added with HTTP regressions. Signed evidence retains capability/admission-before-parser and its existing transfer concurrency. Broader ordinary-request admission, deployed edge limits and load evidence remain open; see security/REQUEST_INGRESS_LIMITS.md.
- [x] **SEC-011 · P1 · Phase 1:** Add bounded rate limits for public scan, QR, login, reset, invitation and upload-intent endpoints. CLOSED 2026-10-06: founder reports public-abuse limits tested, merged and pulled. Shared fixed-operation deployment/socket-peer budgets protect profiles, QR, scans, invitation previews/creation and upload intents/content; authenticated member/organization quotas and fail-closed pre-parser enforcement are regression-tested. Existing account/token authentication budgets remain. Reviewed hosted ingress/client attribution, measured capacity and centralized alerts remain SEC-007/010/017 and OPS/PER work.
- [ ] **SEC-012 · P1 · Phase 1:** Move production secrets to a managed secret store and rotate existing secrets.
- [ ] **SEC-013 · P1 · Phase 1:** Add secret scanning to CI and repository settings.
- [-] **SEC-014 · P1 · Phase 1:** Add dependency and container vulnerability scanning; remediate or accept findings explicitly. IN PROGRESS 2026-10-13 grooming: mandatory production/full dependency and first-party API/web runtime scans, non-root/runtime assertions and exact expiring exceptions are implemented; the latest full release completion is founder-reported. Third-party service-image review, maintained provenance/SBOM and immutable deployment promotion remain SEC-014/SAF-005/ENV-009 acceptance. Earlier npm finding counts and pending first-party-image execution are historical, not the current status.
- [x] **SEC-015 · P1 · Phase 2:** Threat-model account takeover, tenant breakout, fraudulent claims, malicious files, payment-reference fraud and recall abuse. CLOSED 2026-10-14 20:25 UTC: founder reports integrated release checks passed and merge/pull completed. Implemented: published security/THREAT_MODEL.md covers six scenario families, assets/trust boundaries, actual control/evidence references, prioritized gaps/accountable roles and future logistics boundary. Founder review/release accepted; remediation and independent review remain their own items.
- [ ] **SEC-016 · P2 · Phase 2:** Add PostgreSQL RLS to the highest-risk tenant tables after application policies stabilize.
- [ ] **SEC-017 · P1 · Phase 2:** Add immutable security-event retention and alerts for abnormal authorization failures.
- [ ] **SEC-018 · P2 · Phase 3:** Commission an independent authorization/security review before public production.
- [-] **SEC-019 · P2 · Phase 3:** Create a vulnerability-reporting policy and private security contact. IN PROGRESS 2026-10-14: SECURITY.md and runbooks/SECURITY_REPORTS.md publish safe private-report handling and triage. Private channel activation, monitored owner/backup and synthetic intake/ack verification are not established; item cannot close yet.
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
- [-] **UPL-014 · P1 · Phase 2:** Audit upload intent, completion, scan, review, access and deletion. IN PROGRESS 2026-10-13 grooming: Upload/security/infection decisions and reviewed cleanup retries are audited; a complete scan/review/download/physical-deletion event matrix is not yet proved.
- [-] **UPL-015 · P2 · Phase 2:** Add storage quotas and abuse monitoring. IN PROGRESS: accepted quota accounting and abuse budgets exist; operational monitoring and alerts remain open.
- [ ] **UPL-016 · P2 · Phase 3:** Add asynchronous extraction only behind human confirmation and without changing trust state.
- [x] **UPL-017 · P2 · Phase 3:** Add a public/private field policy for product-profile evidence metadata. CLOSED 2026-10-13 grooming: Published evidence uses an explicit metadata-only projection and current independent review/clean-validation eligibility; private access remains entity/party authorized. Native and browser public-field/eligibility cases are founder accepted. Hosted storage provisioning remains UPL-002.
- [ ] **UPL-018 · P2 · Phase 3:** Complete a restore test for evidence metadata and object versions.

# 7. Trust, certification and compliance data

- [x] **DAT-001 · P0 · Phase 1 — VERIFIED:** Forward migration 021 replaces optimistic defaults with pending/self-declared/unknown. Workspace approval remains separate from independent verification. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **DAT-002 · P0 · Phase 1 — VERIFIED:** Migration 021 downgrades unsupported legacy farm/plot/evidence decisions with a per-field correction ledger and read-only `trust:report`. Seed flags cannot grant effective verification. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **DAT-003 · P1 · Phase 1 — IN PROGRESS:** Independent certificate issuance/attestation records source, actual reviewer, method, time, expiry and audit atomically. Customer-facing trust summaries expose review provenance without private document URLs. A general origin/EUDR/evidence review workflow remains future work; local native release accepted by founder; general workflow acceptance remains open.
- [x] **DAT-004 · P1 · Phase 1:** Certificate issue and attestation validate farmer organization against farm ownership, with a real-PostgreSQL cross-tenant regression.
- [x] **DAT-005 · P1 · Phase 1 — IN PROGRESS:** Attestation validates certificate subject, crop and inclusive harvest-date coverage. CLOSED 2026-10-15 16:32 UTC: founder reports corrected full release passed and merged. Implemented: seven new PostgreSQL cases cover both invalid sides, both inclusive dates, farm/owner/crop mismatch, unchanged denied state and idempotent attributed review. Existing production policy needed no change; Native release accepted.
- [x] **DAT-006 · P1 · Phase 1:** Prevent contradictory duplicate active certificates. CLOSED 2026-10-15 16:32 UTC: founder reports corrected full release passed and merged. Implemented: same farm row lock serializes issuance/reinstatement; same issuer/subject/standard with intersecting crop and inclusive validity intervals conflicts. Independent issuer/standard/crop/nonoverlap remain allowed. Five native cases cover races and audit rollback; no historical rewrite or DB-admin constraint claim. Integrated release accepted.
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
- [x] **TRD-010 · P1 · Phase 2:** Allow buyers to withdraw pending offers. CLOSED 2026-10-15: founder reports corrected integrated release passed and merged. Implemented: buyer-only pending-to-cancelled transaction shares acceptance lock order, duplicate withdrawal is idempotent, atomic audit/rollback and competing acceptance regressions supplied; sent-offer confirmation and history refresh implemented. Corrected release accepted.
- [x] **TRD-011 · P1 · Phase 2:** Add seller rejection reason and immutable history. CLOSED 2026-10-15: founder reports corrected integrated release passed and merged. Implemented: mandatory bounded seller reason stored atomically in immutable application audit, first decision projected only to scoped offer parties, legacy/automatic missing reasons distinguished; rejection concurrency/rollback/visibility and retained form regressions supplied. Release accepted.
- [x] **TRD-012 · P1 · Phase 2:** Implement a bounded counteroffer flow or explicitly mark negotiation external. CLOSED 2026-10-15: founder reports corrected integrated release passed and merged. Implemented: explicit external-negotiation notice on offer entry and offer register, verified-contact guidance, no implicit amendment of recorded offers or accepted trades; known-limitations page repeats the boundary. Release accepted.
- [x] **TRD-013 · P1 · Phase 2:** Offer currency must match the listing; deadlines are validated at creation and acceptance. CLOSED 2026-10-06 grooming: modules/trading/offers.ts and tradeCurrency/tradingIntegrity regressions; founder reports currency waves tested/merged/pulled.
- [-] **TRD-014 · P1 · Phase 2:** Snapshot accepted price, quantity, Incoterm, locations and assurance requirements. IN PROGRESS 2026-10-13 grooming: Accepted goods price/quantity/currency, Incoterm and locations are preserved through the transactional trade/fulfillment path; full immutable assurance-requirement snapshots remain open.
- [x] **TRD-015 · P1 · Phase 2:** Add agreement version, explicit acceptance by both parties and acceptance timestamp. CLOSED 2026-10-16: founder reports corrected full release passed and merged; immutable bilateral base-record acknowledgement and private current-state read/unread notice center accepted. Pending checkbox failure/retry correction included. No legal signature or historical inbox claim.
- [x] **TRD-016 · P1 · Phase 2:** Rename “sales contract” where no legally executed contract exists, or add signed-document support. CLOSED 2026-10-16: founder confirms full release passed and merge completed; customer heading/navigation/download presentation uses trade agreement and explicit unsigned platform-record notice, preserving agreed commercial terms and qualifying legal effect. Routes/DB/audit/export filename remain compatible. Browser presentation/export regression supplied; founder-reported release/review accepted. No signature or legal-review service introduced.
- [-] **TRD-017 · P1 · Phase 2:** Add cancellation, dispute and administrator-resolution states. IN PROGRESS: bilateral unstarted cancellation with critical audit and exact stock release implemented; founder reports unstarted cancellation tested/merged/pulled; paid cancellation, broader disputes and administrator resolution remain open.
- [x] **TRD-018 · P2 · Phase 2:** Award/close the originating sourcing request when appropriate. CLOSED 2026-10-16: founder confirms corrected full release passed and merged; sourcing manual closeout/immutable receipts and reviewed listing expiry/renewal accepted, including native fixture and browser envelope corrections. Existing agreements preserved. See releases/SUPPLY_DEMAND_LIFECYCLE_PR.md.
- [-] **TRD-019 · P2 · Phase 3:** Add marketplace pagination, search indexes and deterministic match explanations. IN PROGRESS 2026-10-13 grooming: Server-filtered deterministic marketplace keyset pages and native plan cases are accepted; complete search-index/capacity acceptance and match-explanation policy remain open.
- [x] **TRD-020 · P2 · Phase 3:** Add listing expiry and supplier renewal workflows. CLOSED 2026-10-16: founder confirms corrected full release passed and merged; sourcing manual closeout/immutable receipts and reviewed listing expiry/renewal accepted, including native fixture and browser envelope corrections. Existing agreements preserved. See releases/SUPPLY_DEMAND_LIFECYCLE_PR.md.

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
- [x] **LOG-002 · P1 · Phase 2:** Define which party may record each milestone and which may only observe it. CLOSED 2026-10-15 reconciliation: accepted all-eleven-term responsibilities and transportResponsibilities native/browser controls define party action versus observation; no new legal risk-transfer claim.
- [x] **LOG-003 · P1 · Phase 2:** Require essential arrangement fields before departure-relevant milestones. CLOSED 2026-10-15 16:32 UTC: founder reports corrected full release passed and merged. Implemented: actual departed requires provider OR booking reference, known mode and origin/destination; structured409 missingFields after authority/recall/payment guards. Draft/loading and later recovery remain possible. Native/browser evidence supplied; Integrated release accepted.
- [x] **LOG-004 · P1 · Phase 2:** Decide whether milestone skipping is allowed; encode required predecessors explicitly. CLOSED 2026-10-15 reconciliation: accepted responsibilities.ts and persisted shipment milestone prerequisites explicitly allow optional steps while enforcing origin before departure/arrival and DPU/DDP receipt requirements; all-eleven native regressions.
- [x] **LOG-005 · P1 · Phase 2:** Add buyer delivery confirmation distinct from a reported delivery milestone. IMPLEMENTED: separate buyer inspection/acceptance, exact quantity, retry-safe auditable acceptance and settlement guard. Founder confirmed tested and merged on 2026-10-02. See runbooks/DELIVERY_ACCEPTANCE.md.
- [-] **LOG-006 · P1 · Phase 2:** Add shortages, damage, rejection and delivery-dispute flows. IN PROGRESS: evidence-backed reports, supplier proposal and buyer approval with settlement hold implemented; bilateral unstarted cancellation implemented with guarded stock release; founder reports delivery acceptance and unstarted cancellation tested/merged; partial settlement, refunds, paid cancellation and returned inventory remain explicit follow-up scope.
- [x] **LOG-007 · P1 · Phase 2:** Prevent automatic settlement while a delivery dispute is open. Implemented and founder-tested with delivery acceptance; founder confirmed release testing and merge on 2026-10-02.
- [x] **LOG-008 · P1 · Phase 2:** Require reason, acknowledgement and notification for exceptional dispatch. CLOSED 2026-10-17: founder confirms corrected full release passed and merged. Reviewed ETA/delay history, overdue current notices and buyer exception-awareness receipts accepted, including shipment fixture and stable label corrections. See releases/TRANSPORT_AWARENESS_PR.md.
- [x] **LOG-009 · P1 · Phase 2:** Shipment and contract transport documents use private evidence upload, scan-clean download and payment release controls. CLOSED 2026-10-06 grooming: evidenceController.ts, paymentWorkflow.integration.test.ts and paymentPlans.spec.ts; founder reports payment/document waves tested and merged. Hosting and service-provider grants remain separate gates.
- [x] **LOG-010 · P2 · Phase 3:** Add ETA changes, delay reasons and overdue milestone alerts. CLOSED 2026-10-17: founder confirms corrected full release passed and merged. Reviewed ETA/delay history, overdue current notices and buyer exception-awareness receipts accepted, including shipment fixture and stable label corrections. See releases/TRANSPORT_AWARENESS_PR.md.
- [x] **LOG-011 · P2 · Phase 3:** Add optional provider tracking links with URL safety validation. CLOSED 2026-10-15 reconciliation: optional tracking field, current-party arrangement controls, HTTPS/public-host input validation and safe legacy rendering accepted in SEC-009 release; no independent provider verification claimed.
- [ ] **LOG-012 · P3 · Phase 4:** Add carrier/provider integrations only through optional adapters; keep manual external arrangements first-class.

# 11. Traceability and recall

- [x] **RCL-001 · P0 · Phase 2 — VERIFIED:** Migration 022 backfills active notices into explicit lot/holding safety holds; activation is atomic and quantities/ownership remain unchanged. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **RCL-002 · P0 · Phase 2 — VERIFIED:** Active recalled supply is withdrawn and server-gated across publication, offers, custody transfers/splits and physical dispatch, including payment-exception and milestone-skip attempts. Receipt containment remains available; resolution never auto-republishes. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **RCL-003 · P1 · Phase 2 — IN PROGRESS:** Actual owners, holders, contract counterparties and distribution recipients enter a durable leased email outbox. Local native release accepted by founder; SMTP acceptance is separate from acknowledgement. External nonmember recipients and delivery webhooks remain open.
- [-] **RCL-004 · P1 · Phase 2 — IN PROGRESS:** Own-organization acknowledgement and manager contacted/unreachable/escalated records implemented with transactional audit. Local native release accepted by founder; automated deadlines remain open.
- [-] **RCL-005 · P1 · Phase 2 — IN PROGRESS:** Holder-only recovery snapshots validate three-decimal quantities against current holdings, excluding transferred history. Returned/destroyed stock keeps the batch blocked after closure. Local native release accepted by founder; separate physical segregation/write-off workflow remains open.
- [x] **RCL-006 · P1 · Phase 2 — VERIFIED:** Closure requires authorized manager, reason, exact-recall clean evidence, all acknowledgements and complete nonquarantined accounting. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **RCL-007 · P1 · Phase 2 — VERIFIED:** Closed response records, decision proof references and public notice history retained; public pages reflect remaining safety holds. User reports successful testing and merge on 2026-10-02; CI artifacts are not independently archived. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [ ] **RCL-008 · P1 · Phase 2:** Add tabletop recall tests covering partial, commingled and distributed material.
- [ ] **RCL-009 · P1 · Phase 2:** Add reconciliation warnings as actionable blocking tasks where safety is uncertain.
- [-] **RCL-010 · P1 · Phase 2:** Define who can investigate versus activate versus resolve recalls. IN PROGRESS — current permission/resource matrix and policy/route regression coverage; no new role grants or dual-review claim. Runtime release/review/merge pending.
- [ ] **RCL-011 · P2 · Phase 3:** Add a genuine customer transformation/blending workflow or remove transformation claims.
- [ ] **RCL-012 · P2 · Phase 3:** Add chain-of-custody event correction through superseding records rather than destructive edits.
- [ ] **RCL-013 · P2 · Phase 3:** Add drill reports with elapsed time, completeness, unresolved recipients and quantity reconciliation.
- [ ] **RCL-014 · P3 · Phase 4:** Evaluate standards-based traceability exports after customer format requirements are known.

# 12. Product experience and notifications

- [-] **PRD-001 · P0 · Phase 0:** Remove or flag all unsupported claims, dead controls and incoherent demo records. IN PROGRESS 2026-10-16: BetterTrade branding batch qualifies sourcing/onboarding/transformation and agreement presentation. Global claim/control/demo-record inventory and acceptance remain open; no whole-item credit.
- [x] **PRD-002 · P0 · Phase 0:** Keep demo, staging and production content/data visually distinguishable. CLOSED 2026-10-16: founder reports corrected integrated release passed and merged. persistent bilingual server-environment notice on public/authenticated routes, honest unknown fallback, credential-free bounded probe and existing synthetic-preview warning. No assertion that a label proves resource isolation or synthetic data. Founder native/browser release accepted; hosted acceptance remains separate.
- [-] **PRD-003 · P1 · Phase 1:** Remove generic “Contribute proof” as a starting task; anchor evidence contribution to a record and request. IN PROGRESS: Record picker, explicit document purpose and contextual farm/batch entry implemented; Founder confirms full release checks passed and merge/pull completed 2026-10-07. Record-based contribution is accepted; request-specific evidence checklist remains follow-up.
- [x] **PRD-004 · P1 · Phase 1:** Ensure supplier onboarding selects conventional versus source-traceable supply before record creation. CLOSED 2026-10-07: founder confirms full release checks passed and merge/pull completed. Shared permission-aware chooser covers supplier home, empty publication and evidence setup; conventional inventory and source/farm/plot/harvest browser journeys passed. Farm/plot creation does not invent saleable inventory or organic approval. Evidence is founder-reported; CI URL not independently archived.
- [x] **PRD-005 · P1 · Phase 1:** Ensure buyer sourcing requirements persist and drive marketplace matching. CLOSED 2026-10-16: founder reports corrected integrated release passed and merged. existing accepted creation/matching plus canonical saved-brief edit links, owner/mutable-state validated PATCH with atomic audit, same-record reload and preserved unrepresented specifications. Native/browser regressions accepted through the corrected founder release.
- [x] **PRD-006 · P1 · Phase 2:** Make the guided dashboard and deal room use one next-action source. CLOSED 2026-10-06: founder confirms release checks passed and merge/pull completed. Shared server fact repository and typed commercial/fulfilment/closeout/permission policy drive dashboard, deal room and contract guidance. Supplier proposal precedes buyer confirmation; payment/document/recall gates, exact money and Incoterm ownership are reflected. Unit/repository tests plus native API equivalence/isolation and real browser transition coverage added. Native release success is founder-reported; CI URLs are not independently archived. Other platform empty states remain tracked under PRD-011. See runbooks/TRADE_NEXT_ACTION_POLICY.md.
- [x] **PRD-007 · P1 · Phase 2:** Add a notification center with read/unread, responsible party and deep link. CLOSED 2026-10-16: founder reports corrected full release passed and merged; immutable bilateral base-record acknowledgement and private current-state read/unread notice center accepted. Pending checkbox failure/retry correction included. No legal signature or historical inbox claim.
- [-] **PRD-008 · P1 · Phase 2:** Send transactional emails for invitation, offer, terms, payment, dispatch, delivery, dispute and recall actions. IN PROGRESS 2026-10-13 grooming: Identity/invitation/reset, overdue reminders and recall delivery are implemented; offer/terms/payment/dispatch/delivery/dispute lifecycle email coverage and external inbox acceptance are incomplete.
- [x] **PRD-009 · P1 · Phase 2:** Add overdue/action-required filters for buyers and suppliers. CLOSED 2026-10-16: founder reports corrected integrated release passed and merged. all/action-required/overdue-payment filters over the complete loaded next-action set, retained on refresh. Durable due_at and server clock determine overdue; buyer/seller powers remain unchanged. Policy and both-persona browser regressions accepted through the corrected founder release.
- [-] **PRD-010 · P1 · Phase 2:** Provide document checklists based on payment plan, route and Incoterm. IN PROGRESS 2026-10-13 grooming: Payment-plan protected-document rules and current evidence guidance exist; complete route/mode/named-place/Incoterm checklists remain open.
- [-] **PRD-011 · P1 · Phase 2:** Give every empty state an explanation and permitted next action. IN PROGRESS 2026-10-06: trade action centre now explains a successful empty list separately from a failed refresh; source/sourcing setup stays distinct from active trade guidance. Other platform empty-state and permission coverage remains open.
- [x] **PRD-012 · P1 · Phase 2:** Add customer-visible activity history to deals. CLOSED 2026-10-16: founder reports corrected integrated release passed and merged. on-demand guided-room/contract activity, bounded scoped cursor and fixed customer event projection with no raw metadata or individual identities. Every page rechecks current contract parties; historical coverage is explicitly partial. Native isolation/pagination and browser failure/retry regressions accepted through the corrected founder release.
- [x] **PRD-013 · P2 · Phase 3:** Add saved filters and search for organizations with meaningful record volume. Accepted: founder reports corrected full release and merge 2026-10-16.
- [ ] **PRD-014 · P2 · Phase 3:** Add product analytics without collecting unnecessary personal data.
- [x] **PRD-015 · P2 · Phase 3:** Add contextual support/contact flow and issue reference IDs. Accepted: founder reports corrected full release and merge 2026-10-16.
- [ ] **PRD-016 · P3 · Phase 4:** Validate second-commodity schemas with customer research before building them.

# 13. UX, accessibility and frontend quality

- [ ] **UX-001 · P1 · Phase 1:** Test all P0/P1 workflows at mobile, tablet and desktop widths.
- [ ] **UX-002 · P1 · Phase 1:** Ensure all controls have accessible names, keyboard access and visible focus.
- [-] **UX-003 · P1 · Phase 1:** Ensure errors appear near the failed action and preserve entered data. IN PROGRESS 2026-10-13 grooming: Accepted access-review, recall-recovery and operations forms retain drafts with explicit errors; whole-application action/form retention remains unverified.
- [-] **UX-004 · P1 · Phase 1:** Stop converting material API failures into misleading empty states. IN PROGRESS 2026-10-13 grooming: Accepted paged register, aggregate and selection reads distinguish failure from empty results; a whole-route legacy failure audit remains open.
- [-] **UX-005 · P1 · Phase 2:** Add loading, empty, partial failure, offline/retry and permission-denied states consistently. IN PROGRESS 2026-10-13 grooming: Loading/empty/read-retry/permission states exist in accepted feature pages; universal offline and consistent whole-app treatment remain open.
- [ ] **UX-006 · P1 · Phase 2:** Add confirmation for destructive or irreversible actions.
- [ ] **UX-007 · P1 · Phase 2:** Make status labels and colors consistent across dashboard, deal, payment and shipment views.
- [ ] **UX-008 · P2 · Phase 2:** Run an automated accessibility check in CI and manually test core keyboard journeys.
- [x] **UX-009 · P2 · Phase 3:** Add route-level code splitting and keep initial bundle within an agreed budget. CLOSED 2026-10-15: founder reports integrated release passed and merged. Lazy route loading with loading/error recovery; transitive initial JS72,214 gzip bytes against enforced90KiB budget in CI/release. Budget regression cases accepted. Mobile latency/accessibility remains PER-005.
- [ ] **UX-010 · P2 · Phase 3:** Add browser support policy and test the agreed mobile browsers.
- [ ] **UX-011 · P2 · Phase 3:** Add safe unsaved-change warnings to long forms.
- [ ] **UX-012 · P3 · Phase 4:** Conduct structured usability sessions and close repeated friction patterns.

# 14. Testing and engineering quality gates

- [x] **QLT-001 · P0 · Phase 1:** Add real-PostgreSQL API integration tests with at least two unrelated organizations. The disposable PostgreSQL harness, safety guard, two-tenant API tests and CI job have completed a green run.
- [-] **QLT-002 · P0 · Phase 1:** IN PROGRESS 2026-10-14: existing resource-family negative suites are linked to a checked 195-route inventory. Actual registration, all 178 protected credential boundaries and 155 live-session permission gates receive systematic coverage. The entry register is founder release/merge/pull accepted 2026-10-14. Paired source/inventory/certificate evidence and private trade-read/payment-party/Incoterm slices are founder release/merge accepted 2026-10-14. The complete per-action/resource/field matrix remains open.
- [x] **QLT-003 · P0 · Phase 1:** Inventory/offer concurrency tests are implemented. CLOSED 2026-10-06 grooming: duplicate coverage of completed TRD-009; tradingIntegrity.integration.test.ts and founder-reported 2026-10-02 native release/merge evidence.
- [x] **QLT-004 · P0 · Phase 1:** Real-PostgreSQL integration tests cover linked-resource upload authorization, private quarantine, extension/MIME/signature validation, file and tenant quota limits, EICAR rejection and audit, quarantine deletion, scan-clean download gating and unauthenticated `/uploads` denial. The Docker harness additionally exercises S3-compatible storage and ClamAV.
- [x] **QLT-005 · P1 · Phase 1:** Test migrations from an empty database and from the current baseline snapshot. IMPLEMENTED: ten release-command scenarios cover fresh/no-op startup, concurrent startup, preserved upgrade records/history, real forward-failure rollback, occupied schemas, partial/unknown history and stale locks. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [x] **QLT-006 · P1 · Phase 1:** Add ESLint, formatting and typecheck commands to CI. CLOSED 2026-10-05: founder reports incremental gates and Windows LF correction tested, merged and pulled. Broader strict-module adoption remains QLT-007.
- [-] **QLT-007 · P1 · Phase 1:** Strict no-new-any rules now include trace, catalog, security, MFA, access controls, transport, trade actions, payments, delivery, cancellation, fees and operations. Legacy evidence/auth/controller adoption remains open.
- [ ] **QLT-008 · P1 · Phase 1:** Add regression tests for every confirmed P0 defect before or with the fix.
- [x] **QLT-009 · P1 · Phase 2:** Add Playwright buyer onboarding and sourcing journey. CLOSED 2026-10-13 grooming: Actual buyer onboarding and sourcing creation/changed-commodity/reviewed-quantity/save/reload browser journeys exist and are founder release accepted. Saved-brief reopening/editing remains PRD-005; it is product follow-up, not an absent creation regression.
- [-] **QLT-010 · P1 · Phase 2:** Add Playwright supplier organic and conventional publishing journeys. IN PROGRESS (grooming): Conventional publication and trust presentation regressions exist; complete organic/source farm→plot→harvest and conventional creation browser journeys remain incomplete.
- [x] **QLT-011 · P1 · Phase 2:** IMPLEMENTED: real browser journeys for all five payment plans, including deposit/balance proof, security acceptance, trade documents, dispatch, delivery and exact settlement/fees. Five authoring journeys passed; prepayment also previously confirmed on founder Docker. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.
- [-] **QLT-012 · P1 · Phase 2:** Real recall response browser journey implemented and user reports passing; delivery exceptions and additional recovery scenarios remain open.
- [x] **QLT-013 · P1 · Phase 2:** Add API idempotency and retry tests. CLOSED 2026-10-13 grooming: API retry/idempotency regressions cover critical offer acceptance, installment submission/confirmation, terms agreement, reminder generation and recovery concurrency without duplicate effects. Founder accepted the applicable releases. This does not claim every possible route/future provider operation is covered.
- [-] **QLT-014 · P1 · Phase 2:** Add contract tests for storage, email, scanner and future provider adapters. IN PROGRESS 2026-10-13 grooming: Real local/S3-compatible storage, TCP scanner and SMTP adapter tests exist; a complete maintained adapter contract matrix and future provider contracts remain open.
- [ ] **QLT-015 · P2 · Phase 3:** Establish critical-domain coverage reporting; focus on meaningful branch and failure coverage rather than a vanity percentage.
- [ ] **QLT-016 · P2 · Phase 3:** Add load tests for marketplace, trade actions, provenance and large trace graphs.
- [ ] **QLT-017 · P2 · Phase 3:** Add long-running migration and rollback rehearsal in staging.
- [x] **QLT-018 · P2 · Phase 3:** Add test data builders/factories rather than coupling tests to the demo seed. CLOSED 2026-10-17: founder confirms full release passed and merged. Typed disposable native fixtures, current architecture/security overview and checked23-capability matrix accepted. Source traceability is not independent hosted assurance.
- [x] **QLT-019 · P2 · Phase 3:** Add mutation or equivalent fault-injection testing for payment and inventory invariants. CLOSED 2026-10-13 grooming: Equivalent fault injection is implemented: forced downstream fulfillment insertion and payment audit failures prove complete inventory/payment rollback. The founder accepted the native release containing these tests; no mutation-score or exhaustive formal proof is claimed.
- [ ] **QLT-020 · P3 · Phase 4:** Add cross-browser and visual-regression coverage for the investor and critical customer flows.
- [x] **QLT-021 · P1 · Phase 1:** Add an automated browser identity regression suite covering request access, captured verification/approval emails, invitation create/resend/revoke/accept, reset, password change and session revocation. Done when it runs against a disposable database/inbox in CI and locally through one command, rejects stale/revoked/reused links, and retains sanitized failure screenshots/reports without exposing bearer tokens in public artifacts. IMPLEMENTED: six real Chromium journeys passed against the app, SMTP capture and temporary WASM PostgreSQL on 2026-10-01; 139 API unit tests, API/web builds and browser typecheck also passed. The isolated Docker/PostgreSQL 16 run and new CI job must still pass before closure. See `docs/runbooks/BROWSER_REGRESSION.md`. CLOSED 2026-10-02: founder reports the applicable automated release checks and merge/pull completed; this status supersedes earlier pending-native-validation wording. CI run links are not independently archived.

# 15. Observability, reliability and operations

- [ ] **OPS-001 · P0 · Phase 1:** Use managed PostgreSQL for staging/production with encryption, automated backups and point-in-time recovery.
- [-] **OPS-002 · P0 · Phase 1:** Local disposable dump/restore schema/history/relational/evidence-metadata rehearsal is founder release accepted. Private object bytes/versions, managed-provider restore and agreed RPO/RTO remain unverified; metadata-only restoration does not close this item.
- [-] **OPS-003 · P0 · Phase 1:** Add centralized structured logs with request/correlation IDs and secret redaction. IN PROGRESS (grooming): Structured request logs and redaction exist; centralized collection, access controls and retention are unprovisioned.
- [ ] **OPS-004 · P0 · Phase 1:** Add backend and frontend error monitoring with release version and environment.
- [-] **OPS-005 · P1 · Phase 1:** Add uptime checks for web, API liveness and API readiness. IN PROGRESS (grooming): Liveness/readiness probes exist; deployed external uptime checks and failure alert drills are unconfigured.
- [-] **OPS-006 · P1 · Phase 1:** Scheduled-job failure/staleness records, redacted errors and private operator monitor are founder accepted 2026-10-13. Bounded cleanup/reminder/recall backlog monitoring is founder workflow accepted 2026-10-13. Opt-in durable operator alerts are founder workflow accepted 2026-10-14; reviewed terminal-alert recovery is founder release/merge/pull accepted 2026-10-14. Complete 5xx/abuse/authorization/pool/scanner signals, external inbox delivery, named ownership and hosted drills remain open.
- [ ] **OPS-007 · P1 · Phase 1:** Define on-call/incident owner and escalation contacts for the pilot.
- [-] **OPS-008 · P1 · Phase 1 — IN PROGRESS:** Scanner outage and quarantine response are drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Assign provider-specific owners, add secret-rotation and customer-communication procedures, and exercise them before closing.
- [-] **OPS-009 · P1 · Phase 1 — IN PROGRESS:** The immutable-image rollback sequence is drafted in [`runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md`](runbooks/EVIDENCE_SCANNER_AND_DEPLOYMENT_ROLLBACK.md). Adapt it to the selected hosting/database providers and record a successful staging exercise before closing.
- [-] **OPS-010 · P1 · Phase 2:** Durable email/reminder/object-cleanup queues, leases/retries/terminal states, independent scheduled jobs and audited cleanup recovery are founder accepted 2026-10-13. Reviewed terminal-email recovery for payment reminders and recalls is founder release/merge accepted 2026-10-13, with bounded private reads, fresh assurance, atomic audit and concurrency/authorization/browser regressions. Bounded cleanup/reminder/recall backlog monitoring is founder workflow accepted 2026-10-13. Opt-in operator alert delivery is founder workflow accepted 2026-10-14. Reviewed terminal-alert recovery is founder release/merge/pull accepted 2026-10-14; wider signals and hosted failure acceptance remain open; see [implementation validation](releases/TERMINAL_EMAIL_RECOVERY_WINDOWS.md).
- [ ] **OPS-011 · P1 · Phase 2:** Add database pool, query latency, HTTP latency and queue metrics.
- [ ] **OPS-012 · P1 · Phase 2:** Define pilot SLOs, initial alert thresholds, RPO and RTO.
- [ ] **OPS-013 · P2 · Phase 2:** Add data export and deletion operations with authorization and audit.
- [ ] **OPS-014 · P2 · Phase 3:** Add capacity budgets for database, storage, uploads and trace graph size.
- [ ] **OPS-015 · P2 · Phase 3:** Run a controlled incident exercise and capture follow-up work.
- [ ] **OPS-016 · P2 · Phase 3:** Add a public or customer-facing service-status mechanism before wider launch.
- [ ] **OPS-017 · P2 · Phase 3:** Test regional/data-residency requirements with actual pilot contracts.
- [-] **OPS-018 · P3 · Phase 4:** Add horizontal-scaling validation and multi-instance rate-limit/job tests. IN PROGRESS 2026-10-13 grooming: Multi-session shared-limit/job ownership regressions exist; complete horizontal deployment/restart and crash validation remains open.

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
- [x] **INV-004 · P1 · Phase 1:** Produce a one-page architecture and security overview that matches reality. CLOSED 2026-10-17: founder confirms full release passed and merged. Typed disposable native fixtures, current architecture/security overview and checked23-capability matrix accepted. Source traceability is not independent hosted assurance.
- [x] **INV-005 · P1 · Phase 1:** Maintain a current-versus-roadmap capability matrix to prevent overclaiming. CLOSED 2026-10-17: founder confirms full release passed and merged. Typed disposable native fixtures, current architecture/security overview and checked23-capability matrix accepted. Source traceability is not independent hosted assurance.
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

- [x] **BRD-001 · P1 · Phase 1:** Apply BetterTrade customer-facing name, navigation, emails and metadata with accessible buyer/supplier terms. CLOSED 2026-10-16: founder confirms full release passed and merge completed; web/auth/onboarding/public presentation, EN/FR shell catalogs and current identity/reminder/recall templates renamed; evidence/review claims qualified. Buyer/supplier x EN/FR brand/session/preference/trade-view browser matrix and captured identity email checks supplied. Founder-reported release accepted; complete French workflow translation remains LNG scope.
- [x] **BRD-002 · P1 · Phase 1:** Inventory compatibility-sensitive names before internal rename: Compose volumes/projects, storage keys, issuer/audience, cookies, preferences, scripts, packages and GitHub URLs. CLOSED 2026-10-16: founder confirms full release passed and merge completed; versioned 23-anchor map and fail-closed source guard in release/CI; existing real auth/passkey, fresh/upgrade and backup/restore gates retained, with new browser continuity matrix. No internal identifier, volume, domain or account migration. Founder-reported full release accepted; see branding/BETTERTRADE_COMPATIBILITY.md.
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
- [-] **PER-001 · P1 · Phase 1 · IN PROGRESS:** Accepted max-100 scoped pages/searches, explicit legacy/export overflow, SQL deadlines and native query plans now cover source, inventory/marketplace, evidence, trade/payment, certificates/products, recalls/responses, public histories, audit/provenance, sourcing, organizations/members/invitations and review/feedback registers. Remaining: explicit universal endpoint inventory and any uncovered legacy/detail/export paths, representative hosted indexes/concurrent SLO benchmarks. Do not repeat accepted slices or infer universal coverage from this list.
- [x] **PER-002 · P0 · Phase 1:** Bound trace/recall nodes, edges, depth and computation; replace recursive/high-copy scans where needed. Completion: oversized/cyclic graphs report incomplete analysis and never falsely clear safety. IN PROGRESS 2026-10-07: connected-component reads with row/depth/time limits, iterative cycle checks, work budget, linear indexing/aggregation and atomic bulk recall scope writes implemented. Incomplete responses carry no safety clearance; suspect goods require isolation/escalation. Unit/capacity checks and native API/browser regressions added. CLOSED 2026-10-07 01:15 UTC: founder confirms full release checks passed and merge/pull completed. Native atomicity/isolation and browser error acceptance are founder-reported; hosted concurrent capacity remains a separate requirement.
- [x] **PER-003 · P1 · Phase 1:** Bound upload/download memory, tenant concurrency, scanner timeouts and worker backpressure. Completion: parallel maximum-size file stress test stays within declared memory budget and fails safely. CLOSED 2026-10-13 grooming: Declared single-process global-four/tenant-two admissions, bounded reads/deadlines, capped scanner work/backpressure and four maximum-size upload/download RSS/rejection canaries are founder accepted. This closes the original bounded-memory criterion, not distributed or hosted capacity. Cross-instance/crash scaling remains PER-006, representative combined workload/SLOs PER-004, streaming efficiency PER-007.
- [ ] **PER-004 · P1 · Phase 1:** Set pilot capacity/SLO budgets and automate read/write/trace load scenarios. Completion: archived hardware/data/concurrency plus p95/p99 results; targets are not claimed measurements.
- [ ] **PER-005 · P1 · Phase 2:** Split heavy frontend routes and establish mobile performance/accessibility budgets. Completion: measured production bundles and buyer/supplier mobile journey with regression thresholds.
- [-] **PER-006 · P2 · Phase 3:** Validate multi-instance locks, shared throttles, scheduler leases and scaling. Completion: no duplicate reminder/service award/settlement under process crashes and concurrent workers. IN PROGRESS 2026-10-13 grooming: Shared abuse budgets, business row locks/outbox leases and deployment job locks have concurrency tests; actual multi-process crash/lease/scaling acceptance remains open.
- [ ] **PER-007 · P2 · Phase 3:** Stream evidence transfers end to end to reduce retained buffers while preserving checksum, admission, provider deadline, abort and scan-clean release controls. Completion: checksum/size/abort/stalled-provider tests plus combined-worker RSS comparison against the accepted bounded-buffer baseline. This is efficiency follow-up; PER-003's bounded single-process safety is already accepted.
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
- [x] **DEC-002:** Revocable session architecture CLOSED 2026-10-15 reconciliation: corresponding ADR004–007 publication and architecture decisions founder release/merge accepted. This closes the technical decision, not deferred provisioning, RLS rollout or external provider acceptance.
- [x] **DEC-003:** Application policies versus PostgreSQL RLS boundaries CLOSED 2026-10-15 reconciliation: corresponding ADR004–007 publication and architecture decisions founder release/merge accepted. This closes the technical decision, not deferred provisioning, RLS rollout or external provider acceptance.
- [x] **DEC-004:** Object storage, malware scanner and evidence lifecycle CLOSED 2026-10-15 reconciliation: corresponding ADR004–007 publication and architecture decisions founder release/merge accepted. This closes the technical decision, not deferred provisioning, RLS rollout or external provider acceptance.
- [ ] **DEC-005:** Email provider and transactional notification ownership
- [x] **DEC-006:** Background job/queue implementation CLOSED 2026-10-15 reconciliation: corresponding ADR004–007 publication and architecture decisions founder release/merge accepted. This closes the technical decision, not deferred provisioning, RLS rollout or external provider acceptance.
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


## Provenance integration fixture cleanup correction — 2026-10-09

Founder native release run passed 363/365 integration assertions. The byte-overflow case cleanup wrote NULL to evidence_items.claim_description despite its NOT NULL constraint; the retained oversized field then caused the following durable-attribution case to return 422. Restore the exact original description in finally, including mutation inside the cleanup-protected block. No application, schema, report limit or permission change. Native rerun and merge acceptance remain pending.


## Accepted checkpoint — audit register and shared provenance reports, 2026-10-10

- Founder confirms full release checks passed and merge/pull completed at 14:58 UTC, including required-description fixture cleanup and signed-in audit browser fixtures. This supersedes the pending acceptance notes above.
- Audit paging, exact filters, full totals, error/retry behavior and complete authorized provenance view/export boundaries accepted. Migration 034 and native/browser checks are covered by the reported release pass.
- ARC-010 is complete. PER-001 / ARC-024 remain IN PROGRESS; this acceptance does not establish universal collection bounds or measured pilot capacity.
- Next: inventory remaining list/export/detail collection boundaries before declaring PER-001 / ARC-024 complete; prepare PER-004 representative capacity scenarios and PER-003 upload/download concurrency and backpressure verification. Hosted measurements remain pending.


## Candidate checkpoint — sourcing request pages and dashboard totals, 2026-10-10

- PER-001 / ARC-024: source request reads were still unbounded, marketplace selection loaded an entire array, and dashboard read failures became empty demand. Add scoped page/search/exact ID/own filters, retained selection, complete independent summaries and explicit failure/retry.
- Preserve own-request and foreign open-matched demand visibility; legacy overflow refuses complete-list claims. Native/browser acceptance pending; broad items remain IN PROGRESS.
- Remaining administration collections and hosted performance/file stress acceptance are next, not assumed complete.


## Accepted checkpoint — sourcing request pages and totals, 2026-10-10

- Founder confirms full release checks passed and merge/pull completed at 15:50 UTC, including explicit selector label correction. This supersedes sourcing candidate pending acceptance above.
- Server search/paging, retained selected request, exact scoped lookup, own/open-demand totals and explicit failure states accepted. Buyer next actions preserve older open requests despite a newer draft; general buyer demand is not called an inventory match.
- PER-001 / ARC-024 remain IN PROGRESS: administration/history and detail collection boundaries, file concurrency and hosted capacity remain open.

## Candidate checkpoint — administration records and tenant scope, 2026-10-10

- Parallel organization/member and invitation paging, complete totals, literal search and retry work. Tenant organization.admin no longer grants global directory access; wildcard retains platform scope. Member authority stays own organization unless wildcard. Safe projections omit organization legal/operator details and invitation token hashes.
- Invitation legacy history previously silently stopped at 100; complete bounded legacy reads now reject overflow. Organization/member legacy arrays are bounded before hydration. No write-lifecycle change or migration.
- PER-001 / ARC-024 acceptance pending exact release/merge; security boundary regression cases required. Broad completion remains open.


## Accepted checkpoint — administration records and tenant scope, 2026-10-10

- Founder confirms release checks passed and merge/pull completed at 16:39 UTC. Organization/member/invitation paging, full totals, explicit failures and tenant directory isolation accepted. This supersedes the pending administration checkpoint.
- PER-001 / ARC-024 remain IN PROGRESS: access review and pilot feedback collections, remaining embedded histories, upload/download concurrency and representative hosted capacity remain open.

## Candidate checkpoint — access review and pilot feedback queues, 2026-10-10

- Parallel read boundaries and UI work remove silent 200-application and 500-feedback truncation. Search/filter precedes page limits; full scoped summaries stay independent of search/page. Failure is unavailable, never empty history.
- Access applications remain platform wildcard only; feedback remains own-tenant organization.admin unless wildcard. Existing email verification/approval/invitation mutations remain authoritative.
- No broad completion credit. Native release and founder merge/pull acceptance pending.

- Architecture follow-ups from this review: define expired/unverified application retention and resubmission behavior under identity/operations policy; review dedicated tenant feedback grants without broad organization.admin elevation; extend authenticated feedback submission budgets and monitoring; measure queue indexes and consider chronological keysets under PER-001 / PER-004. Current stable ID order is not a recency claim.
- Author verification: 704 API unit assertions passed, quality/types/builds/migration integrity/backlog checks passed. Added twelve PostgreSQL HTTP cases and six browser cases. Native execution remains founder release acceptance, not an author-side pass.


## Product legacy overflow preflight correction — 2026-10-10

Founder review-queue release passed 393/394 integration tests. The product legacy list performed correlated recall/scan/evidence metadata computation for 1,001 records before rejecting the complete response; it returned 503 instead of the expected 422. Use the unchanged authorization scope to select only candidate IDs first, refuse overflow before hydration, and hydrate only the bounded ID set. SQL deadlines, authorization and limits stay unchanged. Add unit assertions that overflow never executes metadata hydration and a native small-history success assertion. Review-queue release acceptance remains pending rerun; no broad backlog completion credit.


## Access review browser interaction correction — 2026-10-10

Founder release reached browser journeys after the product overflow correction. The new queue test manipulated background filter controls after opening a modal that intentionally closes on backdrop interaction, then expected the dismissed form to remain. Correct the sequence to search/filter first, reopen the off-page applicant, and enter/assert its review note within the active dialog. No application permission, decision, dismissal or data change. Native browser/release acceptance remains pending rerun.


## Stable access review label correction — 2026-10-10

The reordered browser sequence still failed after text entry. Source inspection of ReactDOM and Playwright identifies the actual cause: React updates controlled textarea defaultValue/textContent, while Playwright reads the wrapping label's descendant text. The exact label becomes input-dependent. Separate the visible label using htmlFor/id so it stays stable after editing; assert dialog visibility and one exact labelled control after fill. This supersedes the earlier speculative backdrop explanation. Decision/dismissal/authorization policies remain unchanged. Founder native release acceptance remains pending rerun.


## Accepted checkpoint — access review and pilot feedback queues, 2026-10-12

- Founder confirms full release checks passed and merge/pull completed at 11:25 UTC, including ID-only product overflow and stable review textarea label corrections. This supersedes review queue pending acceptance above.
- Access application and feedback pages, full scoped summaries, safe metadata, failure/retry and regression checks accepted.
- PER-001 / ARC-024 remain IN PROGRESS: universal query-plan/capacity evidence and remaining collection inventory are not assumed complete.

## Candidate checkpoint — evidence transfer budgets, 2026-10-12

- PER-003: cap simultaneous buffered uploads/downloads per process and tenant, reject without queuing before signed upload body parsing, hold download capacity through response completion/disconnect, and release on parser/controller failures.
- Bound local/S3 reads by maximum file bytes and finite operation/body deadlines; reject oversized stored objects without returning partial bytes. Sanitize signed capability query URLs in request logging.
- These are prerequisite controls, not completion of PER-003. Durable cross-instance leases, maintenance scanner claims, quota-accounted cleanup, transactional existence checks and maximum-size RSS/backpressure stress remain open. No measured memory/SLO claim; native release and merge/pull acceptance pending.

- Author validation: 739 API unit assertions passed; quality, workspace/browser types, builds, migration integrity and backlog checks passed. Ten new PostgreSQL/API cases compile strictly. Docker/native execution remains pending founder release acceptance.


## Accepted checkpoint — evidence transfer budgets, 2026-10-12

- Founder confirms full release checks passed and merge/pull completed at 12:09 UTC. Process/tenant admission, signed pre-body capability validation, JSON-parser bypass prevention, download disconnect lifetime, bounded local/S3 reads, storage deadlines and capability-log sanitation are accepted. This supersedes candidate native acceptance above.
- PER-003 remains IN PROGRESS: durable scanner claims, quota-accounted object cleanup, transactional existence checks, maximum-size RSS/backpressure stress and distributed leases remain outstanding. SAF-002 remains open for deployment secret inventory, rotation and revocation evidence.
- Next implementation batch: bounded maintenance-scanner jobs and storage existence checks that avoid downloading complete files inside trade transactions; follow with durable cleanup and memory stress evidence.


## Candidate checkpoint — bounded scanner maintenance and metadata-only file checks, 2026-10-12

- PER-003: replace unbounded maintenance scan selection with a capped sequential batch and an exclusive PostgreSQL session job lock. A concurrent job refuses duplicate work; session crash/disconnect releases the lock. This is not a durable per-record queue/lease implementation.
- Record infected status before attempting deletion so cleanup failure cannot turn known infected material back into an ambiguous retry state. Bounded private reads and sanitized result summaries remain authoritative.
- Replace full-file existence reads in payment/delivery checks with local stat/S3 HEAD metadata; preserve party authority, scan/review and payment release rules. Provider I/O inside trade locks remains a follow-up.
- Remove whole-file ClamAV framing copies; honor socket backpressure and cap scanner response bytes under an absolute deadline.
- Native release/merge acceptance pending. PER-003 remains IN PROGRESS for durable cleanup/quota accounting, transaction I/O, multi-instance transfer admission and measured maximum-size memory stress.

- Author verification: 759 API unit assertions passed, including real TCP frame/backpressure/deadline checks; quality/types/builds/migration integrity/backlog checks passed. Eight native PostgreSQL/storage cases compile strictly. Native execution remains pending founder release acceptance.


## Accepted checkpoint — scanner maintenance and metadata-only checks, 2026-10-12

Founder confirms full release checks passed and merge/pull completed at 12:55 UTC. Bounded serialized maintenance scans, metadata-only proof checks and ClamAV backpressure/deadlines are accepted. This supersedes pending acceptance above. Broad PER-003 / OPS-010 remain open.

## Candidate checkpoint — durable quota-accounted object cleanup, 2026-10-12

- Forward migration 035 records object ownership before provider writes. Quarantine and final-copy reservations, terminal cleanup, leased retry and dead-letter states remain charged until acknowledged deletion. Live clean evidence is never deletion work.
- Upload completion atomically retains the final object and clears the removed quarantine reservation. Early malformed replays cannot cancel an already claimed upload. Infection state and cleanup obligations commit together.
- Historical objects without known provider ownership require operator inventory; legacy noncompleted reservations remain conservatively charged. Automatic cleanup scheduling, operator dead-letter recovery, remote transaction I/O and peak RSS stress remain open. Native release/merge acceptance pending.

- Author verification: 771 API unit assertions passed; quality, workspace/browser types, builds, migration integrity and backlog checks passed. Fifteen native PostgreSQL cases compile strictly. Native Docker/migration/storage/browser execution remains pending founder release acceptance.


## Container maintenance command correction — 2026-10-12

Founder startup verification found npm absent from the hardened runtime image, as designed. Correct deployment instructions to run `node --import tsx api/scripts/migrate.ts` and `node --import tsx api/scripts/cleanup-evidence.ts` directly. The failure occurred before migration execution; no database repair/reset or runtime-image dependency restoration is needed. Cleanup release merge/startup acceptance remains unconfirmed until founder reports completion.


## Accepted checkpoint — durable evidence cleanup, 2026-10-12

Founder confirms release checks passed and merge/pull completed at 16:57 UTC. Durable ownership, quota-accounted retry/dead states and hardened runtime maintenance commands are accepted. This supersedes pending cleanup acceptance above. PER-003 and OPS-010 remain IN PROGRESS.

## Candidate checkpoint — trade proof preflight and memory stress

Move provider HEAD/stat outside trade write transactions, then lock and revalidate authority and full evidence metadata including cleanup eligibility. Add a disposable 10 MiB upload/download stress gate with sampled API RSS and a 512 MiB budget. Native execution and founder acceptance pending; this is one-process canary evidence, not hosted capacity or distributed admission completion.

Next security work: recall resolution must reject rejected/deleting/unavailable proof; public evidence availability wording and eligibility need review. Remaining performance work: streaming transfers, multi-instance admission, slow/abort/crash canaries and hosted measurements.

Author validation: 777 API assertions pass; workspace/browser types, API/web builds, migration integrity and backlog tests pass. Nine native PostgreSQL race/authority tests and guarded stress source compile strictly. Native Docker, browser and measured RSS execution remain pending.


## Correction checkpoint — stress startup isolation, 2026-10-12

Founder stress API exited before transfers because the synthetic S3 bucket lacked the required `test` environment marker. Correct the fixture bucket, exercise the actual configuration parser in runner regression tests, and expose only allowlisted startup stage codes via IPC. No production isolation bypass or RSS-budget change. Candidate release acceptance remains pending.


## Correction checkpoint — stress fixture migrations

Founder configuration validation passed, then disposable fixture creation failed. Fixture Knex connection lacked a migration-directory configuration; configure the canonical TypeScript source and test real Knex file enumeration. Stage diagnostics distinguish database/migrations/actor failures without exposing SQL or fixture credentials. Docker stress and wave acceptance remain pending.


## Correction checkpoint — deterministic download observation

Founder stress run completed four maximum uploads and one busy rejection; sampled API peak 327,065,600 bytes was below the 512 MiB budget. Downloads failed the four-active observation before the second phase completed; this is not an accepted memory-stress pass. Replace OS receive-window timing assumptions with guarded child IPC barrier after real provider bytes are read, prove four held buffers/admissions before fifth rejection, then release for slow HTTP downloads and checksum verification. Production admission and budget remain unchanged.


## Accepted checkpoint — trade evidence preflight and local RSS gate, 2026-10-12

Founder confirms release checks passed and merge/pull completed at 18:54 UTC. Scoped metadata preflight outside trade write locks, transactional proof revalidation and the deterministic four-upload/four-download RSS/admission gate are accepted. This supersedes pending acceptance of the implementation and correction checkpoints above. PER-003 and OPS-010 remain IN PROGRESS for streaming, cross-instance admission, hosted capacity and automated operations.

## Candidate checkpoint — recall resolution proof boundary

Require current validated, clean, nonrejected, storage-backed and cleanup-eligible proof on the exact recall before manager resolution. Run bounded provider existence checks outside write locks, then revalidate proof fingerprint and manager authority inside the safety mutation. Add native denial/race/lock tests. No inventory hold release is implied by closing a notice. Release acceptance pending.

Author verification: 777 API assertions, quality, workspace/browser types, both builds, migration integrity, backlog checks and 16 runner checks pass. Eleven new native recall resolution cases compile strictly and review found no blockers. PostgreSQL/browser/release execution remains pending founder acceptance; no native pass is inferred from compilation.


## Correction checkpoint — legacy marketplace limit query

Founder release passed 446 native cases; legacy listings timed out before its 1,001-ID sentinel rejection. Replace per-listing repeated recall graph evaluation with one materialized assessment per distinct batch, select only eligible IDs before the legacy cap and hydrate/enrich only under-limit results. Production 2-second statement and 5-second request guards remain unchanged. Native regression also verifies recalled batches are excluded before the sentinel. Recall-security wave acceptance remains pending.

Correction author validation: 779 API assertions, quality, workspace/browser types, API build and backlog tests pass. Updated native pagination case compiles strictly; native timing/SQL/browser execution remains pending the founder release rerun.


## Correction checkpoint — public recall association reads

Latest founder native run passed 446 cases, with a 503 on resolved retained public stock. Enumerate batch/lot/retained-hold/disposal notice IDs as a deduplicated batch-scoped union for public notice pages and journey reads, rather than correlating association probes per notice. Keep unfiltered active totals and independent retained/disposal existence authoritative; never turn resolved retained stock clear. Add safe response-body diagnostics to the native assertion. Production deadlines and MFA remain unchanged. Candidate acceptance pending.

Correction author checks: 780 API assertions, quality, workspace/browser type checks, API build and backlog tests pass. Updated native notice case compiles strictly; actual PostgreSQL timing/browser execution awaits founder verification.


## Correction checkpoint — holdings candidate-first recall assessment

Latest native failure read an error envelope as `body.items` and reported undefined. Filter holdings by tenant/cursor/basic availability/literal search before graph assessment, assess once per distinct matching batch and preserve recall filtering before the page limit. Native assertions now validate status/code before item shape and plan evidence checks bounded root output plus one assessed batch rather than a specific root node type. Production deadlines remain unchanged; no timeout/retry bypass. Candidate acceptance pending.

Author correction verification: 780 API assertions, quality, workspace/browser types, API build and backlog tests pass; updated native catalog case compiles strictly. Actual PostgreSQL timing and full release execution remain pending.


## Diagnostic checkpoint — multi-tenant upload fixture 503

Latest founder run passed the other 417 cases; multi-tenant setup returned 503 and skipped its 30 cases. The original assertion omitted the upload error code. Add safe intent/content stage and uppercase code diagnostics, and optional exact-existing-filename selection to the disposable native runner. Full release still runs every suite; no service bypass, automatic retry, deadline increase or accepted wave claim.

Diagnostic author validation: quality and 18 runner checks pass; modified native multi-tenant fixture compiles strictly. No production error cause or repair is inferred. One-suite founder execution must provide stage/code evidence; full release remains required before merge.


## Diagnostic checkpoint — isolated storage deadline and real adapter readiness

Founder error identifies EVIDENCE_STORAGE_TIMEOUT during upload content. Disposable integration settings previously inherited storage timeout from the shell/local .env while fixing scanner timing. Pin the existing 15-second default in the harness and Vitest integration config; production is unchanged. Before Vitest, verify guarded loopback S3 bucket readiness, write/read/head, real promotion, source removal and deletion through the actual adapter. Fail with safe phase/code/deadline fields before seeding 52 suites. This closes an isolation/readiness gap; it does not establish the unknown timeout's complete cause or claim a release pass.

Author readiness validation: quality and 20 runner checks pass; real adapter promotion/deletion succeeds against a local HTTP test server and foreign endpoint use is refused. Probe source compiles strictly. Actual Docker/Moto timing and full native release remain pending; no provider outage or slow-host result is converted into a pass.


## Correction checkpoint — set-based product safety and full totals

Founder storage/multi-tenant cases passed, with a product-page CATALOG_READ_TIMEOUT remaining. Bound ordinary candidate IDs before safety/count hydration; attention filtering assesses matching keys before limiting. Shared scoped batch safety computes active batch/lot severity and retained/disposal sets through joins, used by both product pages and full totals. Preserve exact party scope, cursor/filter contracts and warnings without affected edges. Native bulk fixtures remain cold; no ANALYZE warm-up, test timeout increase or retry is used to hide the failure. Release acceptance pending.

Author product correction checks: 781 API assertions, quality, workspace/browser types, API build and backlog tests pass. Updated native product case compiles strictly. PostgreSQL cold-query timing and full release execution remain pending founder verification.


## Diagnostic checkpoint — S3 backend HTTP health

Founder confirms targeted product suite passes, but full release fails in bucket readiness at the fixed 15-second storage deadline before Vitest. Moto health previously checked only socket acceptance. Integration and stress Compose health now require bounded HTTP 200 S3 list-bucket XML, preventing a generic/startup page or listening socket from passing backend readiness. Signed adapter probe and 15-second default remain required. Native Docker startup behavior is pending; this closes a known readiness gap without claiming it explains every host timeout.

Author HTTP-health verification: both actual health command strings reject generic HTTP 200 and accept S3 XML on a local HTTP server; quality and 20 runner checks pass. Actual Docker/Moto/Windows routing remains pending founder verification.


## Accepted checkpoint — recall proof and scoped safety reads, 2026-10-13

Founder reports the latest correction workflow done. Record founder-reported acceptance of the recall proof boundary and its catalog/public-notice/product safety and disposable storage-readiness corrections. This supersedes pending founder acceptance above; independent CI URLs and hosted measurements are not supplied. Production safety deadlines and retained-stock holds remain enforced. Broader performance, worker scheduling and operational gates remain incomplete. Next batch: bounded automatic cleanup/scanning and delivery jobs, heartbeat/failure visibility and audited recovery under OPS-010/OPS-006.


## Candidate checkpoint — scheduled operations, failure visibility and reviewed cleanup recovery

Group bounded independent scanner/cleanup/reminder/recall delivery loops, cross-instance session job locks, durable last-success/failure records, private administrator monitoring and audited dead-cleanup requeueing. Keep existing domain leases and safety checks. Missing/stale/failed status remains unhealthy; suppressed email is not successful delivery. Recovery preserves quota until physical deletion and refuses unsafe references/keys/provider mismatches. Shutdown drains provider work under the existing finite deadline. Native PostgreSQL concurrency, fresh-assurance, rollback and negative-authorization cases plus browser monitor/recovery/failure cases are added; founder full release acceptance pending. OPS-006 and OPS-010 remain IN PROGRESS for external alerts, terminal-email recovery and hosted acceptance. See runbooks/OPERATIONS_JOBS.md.

Author candidate verification: all 788 API assertions pass on a sequential full-suite run, quality and workspace/browser types pass, both builds and migration integrity pass, and backlog checks pass. One existing trace-budget unit timed out while builds ran concurrently; the full sequential rerun passed without changing its deadline. Nine native cases and three browser cases are added; runtime acceptance remains pending.


## Correction checkpoint — stable operations recovery label

Founder browser run cannot locate the exact recovery explanation label after refresh. Separate the textarea from label text and associate it through an explicit stable htmlFor/id. Keep selected record and unsaved explanation state intact. Strengthen the existing browser case with a textbox accessible-name assertion and explanation retention across both successful and failed monitor refreshes. No authorization, retry/audit, worker or database behavior changes. Full candidate release acceptance remains pending.


## Accepted checkpoint — operations correction and formal backlog reconciliation, 2026-10-13

Founder reports the prescribed operations correction workflow done at 13:59 UTC. Treat local release/merge acceptance as founder-reported, without inventing a CI URL, founder commit SHA or hosted report. Formal grooming reconciles ten fully met original criteria, eighteen overlooked partial implementations and the bounded-trace pilot gate. Separate streaming efficiency under PER-007 and keep cross-instance/hosted capacity, external alerts, terminal-email recovery, legal/enrollment and provider work open. See BACKLOG_GROOMING_2026-10-13.md and backlog-reconciliation.json for criterion/file evidence and exact counts.

## Terminal-email recovery candidate — 2026-10-13

Extends the accepted Operations monitor with reviewed per-record retry for both terminal email outboxes. No migration, recipient override or direct send is introduced. Preserves local files, business records and deduplication identity. Native concurrency/authorization/audit-failure and browser coverage plus actual release results are recorded in [the handoff](releases/TERMINAL_EMAIL_RECOVERY_WINDOWS.md). OPS-006/OPS-010/ARC-014 and CORE-workers remain partial for broader monitoring, external alerts and hosted acceptance. This candidate is not recorded as founder-tested or merged.


## Terminal-email recovery acceptance — 2026-10-13

At 17:49 UTC the founder reports release checks passed and the feature merged, including the per-batch listings-summary correction. This supersedes the pending acceptance above. No exact founder SHA, CI URL, main pull or hosted evidence is inferred. Reviewed terminal payment-reminder/recall retries are accepted; OPS-006/OPS-010/ARC-014 and CORE-workers remain partial for complete backlog/failure monitoring, external alerts, incident ownership and hosted drills. The next engineering batch is bounded queue-backlog and incident visibility with automated negative/failure coverage. Existing backlog counts receive no partial credit and remain unchanged.


## Queue backlog and incident visibility candidate — 2026-10-13

Adds bounded, snapshot-consistent platform-admin queue observations for object cleanup and both notification outboxes, with lower-bound count labels, overdue/expired/terminal/limit incidents and explicit unavailable reads. Migration 037 adds partial indexes without changing queue records. Browser drafts remain intact during observation failures. Native permission, capped/read-only state and blocked-read recovery cases plus browser/contract coverage are added; see releases/OPERATIONS_BACKLOG_WINDOWS.md for actual validation. OPS-006/OPS-010/ARC-014 and CORE-workers remain partial for broader scanner/DB/HTTP/abuse monitoring, external alerts, owner assignment and hosted drills. No founder acceptance or completion percentage increase is inferred.


## Accepted checkpoint — bounded operations backlog, 2026-10-13

The founder reports the monitoring correction workflow done at 22:23 UTC after the push/merge/pull instructions. Record founder-reported workflow acceptance for indexed, bounded queue probes, incident visibility and administrator-fixture isolation. This supersedes pending acceptance for that slice. No founder SHA, independent CI URL, real inbox receipt or hosted evidence is inferred. Broader operations gates remain partial.

## Opt-in durable operator alert candidate — 2026-10-14

Adds migration 038, fixed incident episodes, per-current-operator unique outbox rows, serialized one-minute polling, bounded batches, leases and finite retries. Current user/organization/role eligibility is rechecked before submission. Incomplete monitoring cannot resolve old incidents. SMTP transport failure retains work; private alert status never claims inbox receipt. New accounts, real recipients, paid providers and secrets are not configured. Synthetic demo and disposable fixtures explicitly keep alerts disabled.

Author verification and founder commands are recorded in [OPERATIONS_ALERTS_WINDOWS.md](releases/OPERATIONS_ALERTS_WINDOWS.md). Native PostgreSQL and browser regressions are supplied; compilation is not runtime acceptance. OPS-006/OPS-010/ARC-014 and CORE-workers remain IN PROGRESS for native acceptance of this candidate, actual external inbox/incident ownership, broader signals, reviewed terminal-alert recovery and hosted drills. No named backlog item closes; 88/343 roadmap rows, 11/28 core gates and 11/40 provider-inclusive gates remain complete (25.7%, 39.3%, 27.5%).


## Accepted checkpoint — operator incident alerts, 2026-10-14

The founder reports the operator-alert handoff workflow done and asks to proceed. Record founder-reported workflow acceptance for the default-off incident/outbox worker, current-recipient checks and private delivery status. This supersedes pending workflow acceptance of that slice; no exact founder commit, independently archived CI report, real external inbox receipt or hosted drill is inferred.

## Reviewed operator-alert recovery candidate — 2026-10-14

Adds a private bounded terminal-alert register and reviewed retry action using the existing operator/passkey assurance and audit transaction boundary. Only recognized delivery failures with no lease or recorded submission may be queued. Alerts must be enabled, the original operator must remain configured and eligible, and the incident must remain open. The worker still checks eligibility before eventual submission. Retry preserves record, incident, recipient and creation identity; concurrent reviews produce one transition and one audit. Unknown/unsafe, resolved, disabled, withdrawn and already submitted cases remain refused. No direct send, recipient override, incident resolution, recall release or domain mutation is introduced.

Fourteen unit cases, twenty native PostgreSQL cases and two additional browser scenarios cover negative states, current authority, concurrency, recipient suspension while waiting, audit rollback, bounded/redacted reads, conflict/assurance handling and retained explanations. Actual author validation and Windows commands are in releases/OPERATIONS_ALERT_RECOVERY_WINDOWS.md. Native/browser runtime acceptance remains pending. No new dependency, schema or secret is required. OPS-006/OPS-010/ARC-014 remain IN PROGRESS for this candidate and broader external/hosted requirements; completion counts remain 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%). Next engineering priority after acceptance is the pilot authorization/resource evidence matrix; do not repeat accepted identity/trade journeys.


## Accepted checkpoint — reviewed operator-alert recovery, 2026-10-14

At 12:19 UTC the founder reports release checks passed and merge/pull completed. Record founder-reported acceptance of the bounded terminal-alert register, original-recipient checks, fresh assurance and atomic audited retry. This supersedes pending native/workflow acceptance of that slice. No exact founder SHA, independent CI URL, real inbox delivery or hosted drill is inferred. Broad OPS-006/OPS-010/ARC-014 and CORE-workers remain partial for wider operational/deployment requirements.

## Authorization route-register candidate — 2026-10-14

Maps 195 explicit routes and their ordered entry guards: 178 session-protected, 155 with declared permission gates, 16 reviewed public/token flows and one signed upload-capability endpoint. Fails on unreviewed anonymous surfaces, unsupported router DSL, duplicate routes, source/register drift or missing policy/test pointers. Actual Express registration equality and missing/invalid credential/implicit-HEAD denials run without a database. A new native suite checks all declared permission routes with a live zero-permission account, access-review rejection before malformed payload validation, self identity and foreign/absent recall nondisclosure. Existing resource-family suites are linked rather than counted as nonexistent.

Access application review already required platform authority in services; adding the same route-level wildcard guard moves rejection ahead of request validation. It is defense in depth, not a claim that the former service authorized ordinary users. API service/transaction resource checks remain unchanged. The release and CI now check the register before application/infrastructure acceptance. See security/ROUTE_SECURITY_REVIEW_2026-10-14.md and releases/AUTHORIZATION_ROUTE_REGISTER_WINDOWS.md for evidence and limitations. Universal QLT-002/SEC-006 remain IN PROGRESS. No full-item completion credit: roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%).


## Accepted checkpoint — authorization route register, 2026-10-14

At 13:58 UTC the founder reports the release/merge/pull workflow complete. Earlier supplied reports passed every gate before browser journeys; one browser navigation returned ERR_NETWORK_CHANGED while the other 161 scenarios passed. The founder subsequently reports the rerun workflow done. Record founder-reported acceptance of the checked 195-route inventory, credential/permission cases and early access-review guards; no exact final founder SHA or independent CI URL is inferred. This supersedes pending candidate/native acceptance above. Universal resource/field/role and deployment acceptance stays partial.

## Paired source/inventory/certificate boundary candidate — 2026-10-14

Private farm, plot page/summary, batch, certificate and holding reads return indistinguishable foreign/absent 404 bodies. Farm/batch/certificate narrow relationship checks precede private hydration; all four detail builders share one bounded repeatable-read executor with their policy, trust and collection queries. Farm/batch/certificate/holding direct IDs are UUID-validated after authentication and permission checks. The session middleware establishes Cache-Control:no-store for session-bound responses and denials. Existing relationship/network rules and holder-only holding access are retained.

Adds 21 focused unit cases and 34 native cases covering both organizations' positive/foreign/missing reads, collections/exact foreign search/full totals, role unions without accidental network scope, explicit network positives, malformed-ID ordering, current role removal/suspension/revocation and a consistent holding read during concurrent reassignment. Existing expected foreign-read statuses are updated only for these endpoint classes; unrelated evidence/provenance/profile and mutation conventions are untouched. Author evidence and full Windows handoff: releases/SOURCE_RESOURCE_BOUNDARIES_WINDOWS.md. Native runtime acceptance remains pending. SEC-006/QLT-002/ARC-011 remain IN PROGRESS; no full-item or hosted capacity claim. Completion stays 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%).


## Source resource boundary acceptance — 2026-10-14 18:54 UTC

Founder supplied successful focused MFA/source-collection runs, an exact-commit full release pass and push for `f74f290f3bb0c72762adf19fb4b958a3fee77352`, followed by main fast-forward to `606da5bd0`. Record the source/plot/batch/certificate/holding slice as accepted, superseding its earlier pending native status. No independent CI URL or hosted acceptance is inferred. SEC-006/QLT-002/ARC-011 remain IN PROGRESS for other resource/action/field boundaries. The next batch addresses contract/payment/shipment reads and party-specific writes. No full-row completion credit: roadmap 88/343 (25.7%), core 11/28 (39.3%), provider-inclusive 11/40 (27.5%).


## Trade resource boundary candidate — 2026-10-14

Contract/payment/shipment direct reads are scoped to current buyer/seller parties before hydration, with matching foreign/absent 404 and post-guard UUID checks. Linked detail/action data shares a bounded snapshot; oversized child arrays fail explicitly. New payment regressions cover wildcard callers' party constraints and unchanged state/audit on denials; transport regressions preserve all eleven Incoterm responsibility rules. See releases/TRADE_RESOURCE_BOUNDARIES_WINDOWS.md and security/TRADE_RESOURCE_BOUNDARIES_2026-10-14.md. No migration or dependency changes. Author static/unit verification is distinct from pending founder native/browser release. SEC-006/QLT-002/ARC-011 remain IN PROGRESS; no percentage increase for a partial item. Field-level evidence/fee/admin/provenance review and hosted operational/security proof remain open.

## Accepted trade boundaries and larger closure batch — 2026-10-14 19:38 UTC

Founder reports the trade-boundary release and merge done. Record that engineering slice as accepted; no exact founder SHA or independent CI URL was supplied in this acknowledgement. Existing trade snapshot/party, payment denial and eleven-Incoterm regressions remain accepted. SEC-006/QLT-002/ARC-011 stay partial for remaining field/action and hosted evidence; their rows must not continue describing source/trade as the next unimplemented candidate.

At the founder's explicit request, this bundle groups four independent closeable outcomes rather than the default three-item work limit: SEC-009, SEC-015, ARC-016 and ARC-017. All engineering criteria are supplied in one candidate; keep rows IN PROGRESS until the integrated release/CI is accepted. SEC-019 is a fifth advanced item with a concrete external blocker, not a claimed completion. Current accepted totals remain 88/343 (25.7%); accepting all four produces 92/343 (26.8%). Core pilot 11/28 (39.3%) and provider-inclusive 11/40 (27.5%) do not change from these four alone.

## Four security/architecture closures accepted — 2026-10-14 20:25 UTC

Founder reports release checks passed and merge/pull complete for the combined security/architecture bundle. SEC-009, SEC-015, ARC-016 and ARC-017 are now complete in the authoritative rows; 92/343 (26.8%). SEC-019 remains partial for real private-intake verification. No exact founder SHA, independent CI URL, hosted or external channel evidence is inferred. Core gates remain 11/28 (39.3%) and provider-inclusive 11/40 (27.5%).

## Pending-offer and pilot communication closure batch — 2026-10-14

At the founder's explicit request for more whole outcomes per bundle, this candidate groups TRD-010/011/012 and GOV-007/009/010. Three offer/participant outcomes, a versioned customer limitations page and two publication policies share one apply/release/PR cycle. All six remain IN PROGRESS until full release/CI and founder review/merge acceptance. Current accepted 92/343 (26.8%); accepting all six yields 98/343 (28.6%). Pilot gates remain 11/28 and 11/40. Native/browser runtime is not inferred from author compilation. See releases/OFFER_LIFECYCLE_CLOSURE_WINDOWS.md. Hosted readiness, legal agreement/signature, internal counteroffers and logistics-provider marketplace are not claimed.

## Accepted offers, transport reconciliation and five new closures — 2026-10-15 15:27 UTC

Founder reports corrected offer lifecycle release passed and merged; close TRD-010/011/012 and GOV-007/009/010 (98/343). Criteria audit also reconciles previously accepted LOG-002 milestone authority, LOG-004 explicit predecessor/skip policy and LOG-011 safe optional tracking (101/343,29.4%). No new runtime execution is invented for these accepted slices. Remaining named places/domestic policy belongs to GEO-001, not the already satisfied authority rows.

The current bundle targets LOG-003, DAT-005, DAT-006, GOV-004 and GOV-008: five complete outcomes pending integrated release/review acceptance. This covers eight backlog rows through three verified reconciliations and five new closures. After all five,106/343 (30.9%); core11/28 and provider-inclusive11/40 stay unchanged because hosted and corridor approval gates remain. Certificate legacy contradictions are not rewritten; DAT-013 reporting and independent review remain separate. Current limitations copy2026-10-14.1 was reviewed and remains accurate. See releases/PILOT_INTEGRITY_CLOSURE_WINDOWS.md.

## Integrity accepted and architecture/release batch — 2026-10-15 16:32 UTC

Founder reports corrected pilot-integrity release passed and merged: close LOG-003, DAT-005/006 and GOV-004/008 to106/343 (30.9%). Acceptance of ADR004–007 also resolves the four technical decision rows DEC-002/003/004/006:110/343 (32.1%). These decisions do not imply RLS deployment, storage provisioning or external queue operation. Review docs/security/ACCEPTANCE_RECONCILIATION_2026-10-15.md.

Next three complete-outcome targets: ARC-009 public module ownership, UX-009 initial JS route splitting/budget, ENV-016 guarded explicit demo reset. Their acceptance yields113/343 (32.9%). ENV-014 diagnostics advances but remains partial pending a supplied stamp and actual deployment readback. Core11/28 and provider-inclusive11/40 stay unchanged. No paid provider, migrations, data reset or hosted operation is introduced. Current limitations copy2026-10-14.1 remains accurate after review. See releases/ARCHITECTURE_RELEASE_CLOSURE_WINDOWS.md.
