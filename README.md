# BetterTrade

**Evidence-backed raw-material sourcing, trade coordination and traceability.**

BetterTrade helps buyers and suppliers move from a sourcing requirement to an agreed trade, recorded payment checks, physical delivery and an auditable closeout. Source records, supporting documents, custody history and recall response stay connected to the material and decisions they support.

This repository contains the application, automated release tooling, operating runbooks and delivery backlog. Its technical name remains **`cocoatrace`**: existing database names, package names, environment variables and deployment identifiers are intentionally preserved. Customer-facing branding is BetterTrade.

> **Current stage:** an invited-pilot codebase with automated local release verification. Local tests and synthetic demonstrations do not establish hosted production readiness, regulatory approval or customer traction. The [capability matrix](docs/investor/CAPABILITY_MATRIX.md), [pilot gates](docs/pilot-gates.json) and [known limitations](docs/pilot/KNOWN_LIMITATIONS.md) distinguish implementation from remaining acceptance.

## Start here

| You want to… | Read |
| --- | --- |
| Understand the product and its direction | [North Star](docs/NORTH_STAR.md) · [pilot plan](docs/BETTERTRADE_PILOT_PLAN.md) |
| Evaluate what works today and what is planned | [Capability matrix](docs/investor/CAPABILITY_MATRIX.md) · [customer limitations](docs/pilot/KNOWN_LIMITATIONS.md) |
| Run a local synthetic demonstration | [Local demo](#run-a-local-synthetic-demo) below |
| Develop or review a change | [Contributing](CONTRIBUTING.md) · [architecture and security overview](docs/investor/ARCHITECTURE_SECURITY_OVERVIEW.md) |
| Operate or release the application | [Release readiness](docs/PRODUCTION_READINESS.md) · [environment model](docs/ENVIRONMENTS.md) · [runbooks](docs/runbooks) |
| Understand priorities and progress | [Delivery backlog](docs/DELIVERY_BACKLOG.md) · [current sprint](docs/SPRINT_103_CLOSURE_TARGETS_2026-10-20.md) |
| Report a security concern | [Private reporting policy](SECURITY.md)—never disclose credentials or customer records in public issues |

## North Star

Make a raw-material trade understandable and reviewable from the first sourcing requirement through delivery and recorded settlement: **what is being traded, which claims have evidence, who must act next, what has actually happened, and what remains uncertain.**

The first operating scope is a narrow, founder-approved buyer–supplier pilot. Ghana-to-Europe cocoa is the existing demonstration context; it is neither a permanent product restriction nor evidence that every commodity, country or corridor is supported.

The wider direction includes domestic and regional trade and an optional curated logistics-service marketplace. Those extensions require explicit commodity, route, commercial and provider policies before launch. The current pilot supports externally arranged transport; it does not include a verified-provider procurement marketplace.

Success is measured by repeatable completed customer workflows, useful evidence, reduced coordination effort and sustainable operating economics—not feature count or a fundraising valuation inferred from code. See the [North Star](docs/NORTH_STAR.md), [unit-economics hypotheses](docs/investor/UNIT_ECONOMICS_HYPOTHESES.md) and [evidence-based defensibility narrative](docs/investor/DEFENSIBILITY_NARRATIVE.md).

## The platform

| Area | Current capability | Important boundary |
| --- | --- | --- |
| Access and organizations | Organization applications, reviewed approval, invitations, onboarding, team access and revocable sessions | Invitation-only pilot; privileged actions use passkeys and current permissions. Hosted operator/recovery acceptance remains separate |
| Supplier records | Conventional physical inventory, or relevant farm/plot/harvest source records | Conventional goods do not acquire fictional farm provenance or an organic claim |
| Sourcing and marketplace | Saved editable sourcing briefs, paged search and matching, published supply and expiring offers | Negotiation takes place outside the platform; external messages do not amend accepted records |
| Agreement and guided trade | Reviewed offer acceptance, contract records, payment terms and one shared next-action source for home and deal views | A platform agreement record is not a claim of independently executed legal signature |
| Recorded goods payments | Five payment plans, installment submissions, seller receipt verification, bank-security records and dispatch controls | Submitting proof is distinct from verifying receipt. BetterTrade does not move or hold funds |
| Documents and assurance | Private evidence uploads, scanning, authorized downloads, document decisions, versions and attributable claim assessments | Stored, scan-clean, supplier-declared and independently reviewed are different states; none guarantees the underlying claim |
| Fulfillment and delivery | Incoterm-based party responsibilities, manual transport arrangements, progress/timing records, inspection and exceptions | Authorized party records are not independent carrier tracking. Buyer delivery acceptance remains distinct from payment and settlement |
| Platform fees | Versioned fee terms, pre-dispatch collection controls for enrolled trades, recorded receipts, reviewed exceptions, statements and eligible full external-refund recovery | Original policy snapshots are preserved; no automatic debit, tax-invoice or bank-reconciliation guarantee |
| Product identity and safety | Published QR profiles, recorded provenance, quantity-aware trace analysis, recall holds, recipient response and recovery accounting | Public output is scoped to published data; no recorded recall does not prove safety. Customer blending/repacking is not offered |
| Workspace and operations | Current-state notifications, activity history, support references, saved filters, durable jobs, reviewed recovery, private process metrics and public service observation | Email submission is not recipient acknowledgement; device-local preferences are not cross-device storage; current status is not an uptime history |

Detailed availability and evidence are maintained in the [capability matrix](docs/investor/CAPABILITY_MATRIX.md). The public application pages `/platform-role` and `/service-status` explain the platform boundary and current service observations; the signed-in `/pilot/limitations` page carries versioned customer limitations.

### A typical buyer–supplier trade

1. **Establish the context.** The supplier records available material through the conventional or source-traceable path. The buyer saves a sourcing brief and reviews matching supply and evidence.
2. **Agree the commercial offer.** The buyer submits an offer. The supplier reviews and accepts it, committing inventory and creating the connected contract/fulfillment workflow.
3. **Review the agreement and payment plan.** Parties review the recorded terms, responsibilities and applicable documents. The supplier proposes payment terms; the buyer accepts the current proposal.
4. **Record and verify payment conditions.** The buyer submits external payment/security details as required. The seller verifies actual receipt or security. Document and safety requirements remain independent checks.
5. **Meet applicable platform-fee conditions.** Versioned policy determines consent, collection or a reviewed exception. A commercial fee statement alone is not evidence that the fee was collected; goods payments remain separate.
6. **Coordinate dispatch and transport.** The responsible trade party records the external arrangement and physical progress. Server-side payment, fee, document, inventory and recall controls govern permitted actions.
7. **Inspect delivery and resolve exceptions.** The buyer records inspected quantities and acceptance, or a supported shortage/damage/discrepancy path. Timing, physical delivery and acceptance are separate facts.
8. **Complete the recorded trade.** Required receipts, delivery decisions and inventory/custody updates determine closeout. Activity, fee history and evidence remain available; unresolved safety holds are not cleared by commercial completion.

Home and the deal room guide each party through the same server-derived next action. [Payment/document rules](docs/runbooks/PAYMENT_DOCUMENT_RULES.md), [fee collection](docs/runbooks/FEE_COLLECTION_ENFORCEMENT.md) and [trade next-action policy](docs/runbooks/TRADE_NEXT_ACTION_POLICY.md) explain the detailed boundaries.

### When material must be recalled

Trace-back and trace-forward views operate on recorded lot relationships and quantities. Authorized recall activation persists the notice, blocks affected supply and records its calculated scope. Recipients acknowledge and account for held/recovered material; resolution requires the current evidence and accounting conditions. Returned or destroyed material can retain safety holds after the notice is resolved.

Missing or oversized/incomplete genealogy produces an explicit limitation instead of a silently partial safety report. A seeded demonstration graph is not evidence that customers can enter transformations or that physical traceability is independently complete. See [recall authority](docs/security/RECALL_OPERATION_AUTHORITY.md), [tabletop drills](docs/runbooks/RECALL_TABLETOP_DRILLS.md) and [transformation-claim boundaries](docs/ux/CUSTOMER_TRANSFORMATION_CLAIMS.md).

## Architecture and engineering approach

The codebase is a TypeScript monorepo with a React web application and an Express API backed by PostgreSQL. Feature-owned policies, use cases, repositories and frontend clients are replacing legacy mixed controllers incrementally; the modernization is not represented as finished.

| Layer | Responsibility | Location |
| --- | --- | --- |
| Web application | Buyer/supplier experiences, guided deals, source/evidence/safety and operator interfaces | [`web/src`](web/src) |
| API and domain modules | Authentication, authorization, validation, transactions, business policies and HTTP adapters | [`api/src`](api/src) |
| Relational data | Organizations, commercial records, inventory/custody, traceability, audit and durable work | [`api/src/migrations`](api/src/migrations) · [`db`](db) |
| Private evidence | Local development or configured S3-compatible storage, bounded transfers, quarantine and malware scanning | [`evidence storage`](api/src/services/evidenceStorage.ts) · [`scanner`](api/src/services/evidenceMalwareScanner.ts) |
| Background work | Leased/retried email, reminder and cleanup jobs with private monitoring and reviewed recovery | [`operations modules`](api/src/modules/operations) |
| Verification and delivery | Unit/native/browser tests, migration checks, image scanning, workload/recovery evidence and exact-commit release reports | [`scripts`](scripts) · [CI workflows](.github/workflows) · [`e2e`](e2e) |

Optional AI-assisted narrative features are not an authorization, payment, traceability or compliance authority. Deterministic recorded facts and server policies remain the basis for business decisions.

Read the [current architecture/security overview](docs/investor/ARCHITECTURE_SECURITY_OVERVIEW.md), [modernization direction](docs/ARCHITECTURE_MODERNIZATION.md), [authorization matrix](docs/security/AUTHORIZATION_MATRIX.md) and [API error contract](docs/security/API_ERROR_CONTRACT.md). The checked route register is an authorization inventory, **not** a complete OpenAPI specification or proof of every role/resource combination.

## Run a local synthetic demo

### Requirements

- Git and Docker with Compose v2; Docker Desktop must be running on Windows/macOS.
- Network access to pull the configured images and malware-scanner signatures.
- For host development and release commands: Node.js **24** is the recommended runtime, with npm. See [`package.json`](package.json) for the supported engine range; CI also exercises Node 22.

The default Compose stack is a **local synthetic demo**, not a staging/production deployment. It publishes web/API/database ports; use a trusted development machine and do not expose this default stack as a public pilot.

### Fresh checkout

```powershell
git clone https://github.com/PaddyPul/cocoatrace.git
cd cocoatrace
if (-not (Test-Path '.env')) { Copy-Item '.env.demo.example' '.env' }
docker compose up -d --build
docker compose ps
```

For Bash, the environment-copy equivalent is `test -f .env || cp .env.demo.example .env`; the remaining Git/Compose commands are the same. If this is an existing checkout, preserve its configuration and volumes rather than replacing them with demo defaults.

Wait for the services to become healthy. The API applies verified migrations before it starts. Initial ClamAV signature loading can take several minutes; inspect `docker compose logs --tail 100 clamav api` if readiness is delayed.

**Only for a new, isolated synthetic demo database**, initialize the example records explicitly:

```powershell
docker compose exec -T api node --import tsx api/scripts/seed.ts
```

Open **[http://localhost:3000](http://localhost:3000)**. Demo-only accounts are shown by the local seed output/demo interface; do not reuse them for real organizations. Existing customer data must never be seeded or reset to fix a login or migration problem.

| Local endpoint | Purpose |
| --- | --- |
| `http://localhost:3000` | Web application; browser API calls use `/api` |
| `http://localhost:3001` | Direct API, including `/health/live` and `/health/ready` |
| `localhost:15433` | Local demonstration PostgreSQL port |

The hardened API image intentionally does not include `npm`/`npx`. Use documented Node entry points inside it; host npm commands run from the repository root. `docker compose stop` preserves local volumes. Destructive resets and migration-ledger edits are not troubleshooting steps.

### Host development

Use the development environment examples, install reproducibly with `npm ci`, start the required local services, apply migrations with `npm run db:migrate`, then run `npm run dev`. The web development server proxies `/api` to the API. Root `.env` values take precedence over `api/.env`; inspect existing configuration before changing it.

Development storage/scanning modes are not a substitute for deployed private storage and real malware scanning. The older `setup.sh` helper is not the recommended evidence-ready path: it starts PostgreSQL only, while its demo template expects a scanner. Start with the full Compose demo above or follow a deliberately configured development environment in the [environment guide](docs/ENVIRONMENTS.md).

## Verify a change

Install host dependencies with `npm ci`. Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run check:quality` | Lint, scoped formatting and script/quality contracts |
| `npm run typecheck` | API, web and browser TypeScript checks |
| `npm test --workspace=api` | API unit regressions |
| `npm run test:integration:docker --workspace=api` | Disposable database/storage/scanner integration suites |
| `npm run test:browser:docker` | Disposable browser, database and captured-email journeys |
| `npm run verify:release` | Ordered release gates, stopping at the first failed gate |
| `npm run backlog:progress` | Backlog and pilot-gate closure counts, separate from readiness |

A focused native run takes **one suite filename**, for example `npm run test:integration:docker --workspace=api -- operationsWorkers.integration.test.ts`. Do not run overlapping copies of the same disposable Docker project. Frontend-only mocked browser checks require the preview server and the explicit disposable origin described in the [browser runbook](docs/runbooks/BROWSER_REGRESSION.md).

Release reports live under `release-test-results`; individual gates retain their own reports. Check that the report passed for the **current commit**, the commit did not change during verification and tracked files remained clean. Required CI and review must pass before merge. Logs, credentials, private traces and customer evidence do not belong in public PR artifacts. See [contribution rules](CONTRIBUTING.md), [quality policy](docs/engineering/CODE_QUALITY.md) and [production readiness](docs/PRODUCTION_READINESS.md).

## Operating and launch boundaries

BetterTrade is **not a certifier, bank, escrow provider, carrier, customs broker or legal compliance authority**. It coordinates records and decisions; independent parties remain responsible for certification, funds, carriage, customs and legal requirements. Scanning does not guarantee file safety, a recorded bank reference does not guarantee payment, and a public QR profile does not guarantee product safety or complete provenance.

| Before opening access | Required evidence |
| --- | --- |
| Synthetic demonstration | Isolated synthetic data, controlled sharing and accurate product claims |
| Invited buyer–supplier pilot | Approved scope/terms, isolated hosted resources, private storage/scanning, real identity email, privileged access review, recovery evidence and named operating owners |
| Provider marketplace | Core pilot gates plus scoped provider verification, separate service orders, job grants and actual provider acceptance |
| Wider production | Supported-route policies, independent review, representative capacity/recovery/incident exercises and repeated customer evidence |

The local `/service-status` page reports a recent process/dependency observation, not historical uptime. `/operations/metrics` is private, bounded and process-local; it is not a centralized monitoring deployment. See [public status](docs/runbooks/PUBLIC_SERVICE_STATUS.md), [private metrics](docs/runbooks/PRIVATE_RUNTIME_METRICS.md), [risk register](docs/RISK_REGISTER.md) and [launch gates](docs/pilot-gates.json).

## Delivery, contribution and security

The [delivery backlog](docs/DELIVERY_BACKLOG.md) is the execution source of truth. The [103-task sprint](docs/SPRINT_103_CLOSURE_TARGETS_2026-10-20.md) is a target across verified bundles; partial work and unverified external requirements do not receive full-item closure credit. Use the progress command for current counts rather than a percentage copied into this README. Completion is not a production-readiness or valuation score.

Changes should identify the outcome, relevant backlog IDs, authorization/data impact, validation and remaining work. Preserve migration history and existing installations. Keep current capability claims and customer limitations aligned with the implementation.

For contribution and review: [CONTRIBUTING.md](CONTRIBUTING.md). For suspected vulnerabilities: [SECURITY.md](SECURITY.md), including its current private-intake limitations. Never publish credentials, session links, private evidence or an exploit affecting unrelated organizations in an ordinary issue.
