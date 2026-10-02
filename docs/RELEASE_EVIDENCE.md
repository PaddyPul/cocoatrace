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
