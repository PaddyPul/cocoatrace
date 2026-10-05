# Release evidence ledger

This separates implemented code, user-reported local validation, recorded CI evidence and deployed infrastructure. A merged feature does not by itself prove live email, managed backups or production readiness.

| Wave | Repository evidence | User confirmation | Remaining evidence/scope |
| --- | --- | --- | --- |
| Identity and email | API regression suite and six real identity browser journeys | Local checks and identity/email merges reported in this conversation | CI run links not independently archived; real staging SMTP/inbox remains open |
| Trading and trust integrity | Transactional trade modules, PostgreSQL checks, live trust correction/reporting | Prior test/correction completion reported | Broader review workflows and per-payment-plan browser coverage remain open |
| Recall safety/response | Bundle tip a675c965; 92 API integration cases across current suites; 23 browser cases before the new trade journey | User reported successful automated browser test, PR merge and synchronized main on 2026-10-02 | Four authoring-emulator-excluded cases require native PostgreSQL evidence; external recipients and physical segregation remain open |
| Staging rehearsal | Staging preflight, release runner, real prepayment trade browser test and disposable dump/restore | Uploaded local output on 2026-10-02 shows all 24 browser journeys passed, including full prepayment trade; recovery stopped at schema fingerprint SQL | Complete dump/restore gate, full release success, CI links and provisioned staging resources remain open |

Local authoring validation for Staging Rehearsal: 165 API units, three release-runner failure/aggregation checks, API build, browser type checking, migration integrity, JS syntax and Compose/workflow YAML parsing. Native Docker is unavailable in the authoring environment; no actual pg_dump/pg_restore success or full-trade browser execution is claimed yet.

`npm run verify:release` records the tested Git commit and individual gate results in `release-test-results/summary.json`; any subsequent code change invalidates that result as evidence for the changed revision. Keep the summary alongside the PR/CI run before marking newly added native gates complete. Add actual CI URLs and staging restore timestamps after they exist. Reports must not contain secrets or customer data.

Backlog reconciliation on 2026-10-02 closes the demonstrated request-access, verification, first-admin, invitation-only enrollment, reset and password-change implementation items. Provider delivery, full suspension/MFA/policy workflows and environment/recovery operations remain separate open work; they are not swept into those completions.

Recovery SQL correction: explicit text casts remove PostgreSQL internal `char` concatenation ambiguity. Authoring validation reproduced the old failure and verified the corrected query against WASM PostgreSQL with tables, a view and a sequence; fingerprints remain stable after row inserts and change after schema alteration. Six runner checks also pass. This does not substitute for a successful native Docker pg_dump/pg_restore run.

Restore comparison follow-up: user output reached restore but reported different schema hashes. The old information_schema constraint names and physical ordinals can depend on catalog history. The runner now compares logical catalog definitions, includes constraints/indexes/views/sequence configuration and reports missing/unexpected definitions. Authoring WASM PostgreSQL checks verify equivalence across different object IDs/dropped slots and detect seven types of schema change. A native integration regression is included; native Docker restore success remains pending.

User confirmed staging-rehearsal corrections tested, pushed, merged and pulled on 2026-10-02. CI URLs/results are not independently archived. Zero-cost preview wave: isolated persistent synthetic demo, one-time guarded fixture initialization, real ClamAV, local smoke checks, email-restricted Quick Tunnel capability/gate checks, visible demo banner, start/share/stop commands and native CI startup job. Authoring validation passed; actual preview containers and Cloudflare email-PIN validation remain pending.

## Payment/document hardening — 2026-10-02

Founder confirmed the zero-cost preview correction worked, then reported it merged and main synchronized. Allowed-email PIN access and preview readiness are user-reported. Anonymous external denial is recorded in the shared command output. Unlisted-visitor testing and permanent staging are not inferred from that confirmation.

This wave adds forward migration 024 without editing frozen schema/migrations, modular transactional payment mutations, per-installment proof requirements, safe document presentation, protected shipment downloads and physical pickup/handover dispatch gates. Existing agreed deals retain optional-proof terms. Payment/security audit events commit with mutations; seller external bank-security acceptance cannot be overwritten by a buyer.

Authoring evidence: 173 API unit tests; API/web builds; browser TypeScript; migration integrity; five actual Playwright trade journeys (prepayment, deposit/balance with proof, bank security, documentary collection and after-delivery credit). The browser run used Chromium, the real app and locally captured SMTP, with WASM PostgreSQL as the isolated database adapter. It was not the production Docker stack or native PostgreSQL. The targeted API suite passes 16 cases with one deliberately skipped simultaneous-session case. Native PostgreSQL concurrency, fresh/upgrade Docker migrations, native browser execution and complete release checks must run on the founder machine/CI before this wave is marked release-validated.

Executable coverage: `api/test/integration/paymentWorkflow.integration.test.ts` and `e2e/paymentPlans.spec.ts`, alongside existing `e2e/tradeJourney.spec.ts`. One native concurrency case requires simultaneous PostgreSQL sessions; the authoring adapter cannot prove it. The final application gate remains `npm run verify:release` and its commit-specific report. No live regulated-bank verification, cash custody, disputes/reversals or always-on production hosting is claimed.

Browser fixture correction — 2026-10-02: founder full-suite output showed the shared platform-admin exhausting the ten-login/fifteen-minute bucket after the identity and first payment journeys. The test helper now reuses that administrator's real UI-authenticated session in memory, in separate approval contexts, and asserts each fresh login's HTTP status before waiting for navigation. No production limiter/configuration changes. Authoring validation: all 28 browser cases passed in one uninterrupted run against Chromium, locally captured SMTP and WASM PostgreSQL; three sensitive-action limiter regressions and browser TypeScript passed. Native Docker full-release confirmation remains required on the founder machine.

Progress reconciliation — 2026-10-02: founder responded “done” after the browser reviewer-session correction and full apply/release/push/merge/pull instructions. For backlog tracking this is treated as confirmation of that prescribed process. Previously delivered native-only pending checks for migrations, trading integrity, live trust labels, recall safety/closure, invitation controls and payment/browser coverage are closed on founder-reported evidence. No independent CI URL archival is inferred. Partial suspension, general trust review, staging provider email, hosted/object-byte recovery, disposal segregation and external-recipient/deadline recall work remain open. The updated backlog is staged for inclusion with the next substantive feature bundle, avoiding an extra documentation-only install cycle.


## Delivery acceptance and discrepancy boundary — 2026-10-02

Adds migration 026, a dedicated delivery workflow module and shared buyer/supplier deal-room controls. Physical delivery alone no longer settles an open contract: full-quantity buyer acceptance, verified payment and cleared disputes are required. Buyer-owned, scan-clean stored proof supports shortage/damage/rejection reports. Supplier resolution and buyer approval remain separate from acceptance. Partial financial settlement, refunds and returned-stock handling remain open.

Authoring validation: API/web builds, browser types, migration integrity and 187 API unit tests passed. Delivery integration: six passed, one native concurrent acceptance test deliberately skipped under the supplemental database. Payment integration: sixteen passed, one native concurrency test skipped. Actual Chromium journeys passed for all five payment plans; prepayment additionally exercises actual PDF upload, shortage reporting, supplier resolution, buyer approval and exact custody settlement. The database adapter was WASM PostgreSQL; native Docker migration/recovery/concurrency and complete release gates remain required on the founder machine/CI. No fresh-volume reset is needed; historical settled contracts remain closed.


## Payment deadlines and durable reminders — 2026-10-05

Founder explicitly confirmed delivery acceptance tested and merged on 2026-10-02. PAY-006, LOG-005 and LOG-007 are closed on that reported evidence; partial settlement/refunds/returns remain open under LOG-006.

Migration 027 repairs only missing provable deadlines, creates a recipient-scoped durable email outbox, and preserves existing deadlines/closed and paid records. Shared activation covers confirmed terms, presented documents and delivery credit. The API schedules bounded reminder work with a 24-hour automatic grace, daily UTC deduplication shared with manual reminders, contract-first state checks, dispute pauses and leased email retries. Recipient membership/permissions and collection eligibility are checked again before SMTP submission. Disabled email keeps work queued; relay acceptance is not inbox delivery, and crash recovery can duplicate SMTP submission.

Author checks passed: 187 unit tests, API/web builds, browser type checking, migration integrity and diff checks. Four focused integration files passed 38 tests with three deliberate native-concurrency skips using WASM PostgreSQL: reminder lifecycle/recipients/retries, twelve historical backfill scenarios in one test, all payment plans and buyer delivery acceptance. Email outbox checks inject a capturing/failing EmailSender; this is not proof of real provider inbox delivery. Native Docker release checks, concurrency, browser suite and recovery remain required for this revision before merging. PAY-008 remains in progress until founder release verification and merge.


Payment reminder audit correction — 2026-10-05: founder native release output rejected automatic creation because audit_events requires non-null actor UUIDs. Previous supplemental cases only exercised manual creation and automatic exclusions/deduplication; the successful automatic creation case was native-concurrency-only. The worker now uses a reserved non-login audit principal scoped to the buyer organization, with explicit customer-facing worker attribution. A new sequential regression creates automatic work, asserts its audit identity and email queue, and checks retry deduplication. Focused supplemental run: sixteen passed, one native concurrency skip; API build passed. Native release rerun remains required. No audit constraint or frozen migration was weakened.


## Incremental code-quality gates — 2026-10-05

Founder reports payment-reminder correction completed and main pulled. PAY-008 is closed on founder-reported verification and merge evidence; independent CI URL archival is not inferred.

QLT-006 adds lint, scoped formatting, script-contract checks and API/web/browser TypeScript to CI and release checks. QLT-007 is partial: explicit any and unused declarations are prohibited in payment/delivery modules; other high-risk modules remain to be adopted. ARC-028 removes two absent compiled migration/seed aliases and verifies supported runner/delegation entry points without executing potentially destructive commands. Named delivery database/result types replace loose types. Normalized emitted JavaScript comparison confirmed unchanged runtime output across thirteen payment/delivery files. Frozen migrations and SQL rules are preserved. CI uses Node 22; committed lint tools require Node 20.19+, 22.13+ or 24+.

Author checks: clean npm ci, quality checks and nine policy/script regressions, all workspace types, 187 API unit tests, sixteen runner/access-gate regressions, API/web builds and migration integrity passed. The web build retains its existing large-chunk warning. Native Docker, PostgreSQL concurrency, browser journeys and recovery were not run in this environment; founder must run the full verify:release command before merging. No database reset is needed. Apply instructions: releases/CODE_QUALITY_GATES_WINDOWS.md.


Windows formatting correction — 2026-10-05: founder lint passed but all 21 scoped files failed Prettier after Windows checkout. LF configuration lacked matching Git checkout attributes. Scoped eol=lf attributes now cover the entire formatter scope, without changing frozen migrations or legacy baselines; a regression checks every scoped path and migration exclusion. Existing checkout bytes require one scoped format:fix run. Ten quality/script regressions and migration integrity passed locally. Detailed npm dependency findings remain open under SEC-014; no forced dependency upgrade is included. Native release verification remains required.


## Dependency-security boundary — 2026-10-05

Founder confirms the quality-gates and LF correction merged and main pulled. QLT-006 and ARC-028 are closed on founder-reported release/merge evidence. QLT-007 remains partial outside adopted payment/delivery modules.

SEC-014 now includes targeted Express/query-parser, Vitest/mocker/Vite and React Router upgrades, unused dependency removal, fail-closed production/full npm audits in CI and release checks, weekly review, and Dependabot update proposals. One unpatched braces advisory in development build tooling has an exact version/advisory exception expiring 2026-11-05; production classification never uses exceptions. Container/OS scanning and runtime-image reduction remain open. This is not a zero-vulnerability or production-readiness claim.

Author validation: clean npm ci and dependency resolution, all 187 API tests, API/web/browser types, API/web builds, quality policies and migration integrity passed. Audit gate passed with no production findings and only the recorded build-tool exception. Twenty-five Node runner/dependency-policy regressions and ten quality/script-policy regressions passed, covering expiry, production rejection, unknown findings, malformed responses and malicious query data. Native Docker integration/concurrency, browser journeys and recovery were not run in this environment and remain required in verify:release before merge. Instructions: releases/DEPENDENCY_SECURITY_WINDOWS.md.


## Container-security release boundary — 2026-10-05

Founder reports the dependency-security wave completed; verification and merge are recorded as founder-reported evidence. SEC-014 remains partial: runtime-image hardening and scans are implemented here, with native confirmation pending. No completion percentage is increased for this partial item.

The API now builds separately from its production-only install on Node 24. Runtime TypeScript migration and maintenance support is retained with tsx classified as a production dependency; original migration files and frozen hashes are unchanged. The web serves on port 3000 using unprivileged Nginx. Deployed demo/test logging uses JSON without a development formatter. CI and the full release runner build fresh images, verify non-root execution/runtime dependencies/assets, and scan saved image archives with pinned Trivy tooling without mounting the Docker socket. Missing OS inventory, missing API Node inventory, unsupported OS, malformed results, high/critical/unknown findings and launch/download failures block. Unfixed findings are included; no image exception is provided.

Author validation: API/web builds, API/web/browser types, all 188 API unit tests, quality checks, dependency gate and frozen migration integrity passed. Thirty-four runner/dependency/container-policy regressions and ten quality/script-policy regressions passed. A separate clean production-only npm install resolved every declared API runtime dependency, excluded five development tools, and imported the original TypeScript migration and demo/test logger. This host simulation does not prove image execution. Docker, actual image scans, native database concurrency, browser and recovery checks were unavailable here and remain required before merge. No application data or evidence volumes are reset. Instructions: releases/CONTAINER_SECURITY_WINDOWS.md.
