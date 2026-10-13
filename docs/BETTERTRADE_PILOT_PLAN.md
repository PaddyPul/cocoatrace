# BetterTrade: pilot and investability plan

Reviewed 2026-10-13. Backlog: [DELIVERY_BACKLOG.md](DELIVERY_BACKLOG.md). Evidence audit: [BACKLOG_GROOMING_2026-10-13.md](BACKLOG_GROOMING_2026-10-13.md). Machine-readable launch checklist: [pilot-gates.json](pilot-gates.json). Progress: `npm run backlog:progress`.

## Decision and scope

BetterTrade is the planned identity for evidence-backed raw-material sourcing, commercial agreements and fulfillment coordination. It should support domestic trade, cross-border trade within an economic region, and trade between regions. A service marketplace adds registered and reviewed logistics providers without requiring carrier API integration. These are product objectives, not claims of currently implemented geographic or provider coverage.

The first launch is an invited buyer–supplier pilot with an explicit narrow commodity/corridor and externally arranged transport. The provider-enabled pilot adds vetted service organizations and a separate service-order workflow. Both modes remain available; customers who arrange transport outside the platform can still complete their trade. Farms/plots are optional source records for relevant materials and claims; conventional inventory must not acquire fictional farm provenance. Organic is a claim requiring appropriate evidence, not a synonym for a mandatory platform certifier account.

Do not attempt general hazardous materials, mineral sourcing compliance, every customs jurisdiction, FX execution, escrow or multi-leg freight procurement in the first pilot. Approve the commodity/route support matrix, restrictions and known limitations before enrollment (GEO-001/004/005).

## What exists and what is still blocking

The code contains invite-only organization onboarding, revocable sessions, tenant policies, private scanned uploads, live trust labels, sourcing/matching, quantity-aware acceptance, recorded protected payment plans, guided trade actions, delivery acceptance, cancellation guards, fee ledger, currency precision and recall responses. There are real PostgreSQL and browser regression suites and dependency/container/recovery gates. This is substantial functional groundwork.

The system is not yet evidenced as ready for real customer data. Shared abuse limits, cookie/origin protection, mandatory staging/production passkey enforcement, audited suspension, conventional/source entry paths and one next-action policy are now implemented and founder release accepted; do not list these as missing engineering. Bounded scoped trace safety is a closed core gate. Scheduled jobs, durable status and audited cleanup recovery are accepted, with terminal-email recovery and external alert delivery still open.

Remaining launch blockers are independently reviewable release/CI evidence, isolated hosted services/private storage, real inbox delivery, full database plus private-byte recovery, representative combined load/SLOs, actual privileged operator/recovery review, named incident ownership, supported-route/commercial/legal approval and enrolled design partners. Product follow-ups include saved-brief editing, request/route-specific evidence guidance, complete organic publication browser coverage and remaining legacy/error-boundary inventory. English/French shell preferences are accepted foundation work; complete translated forms, contracts, emails and human translation review remain LNG items. BetterTrade runtime branding and the provider marketplace remain unimplemented.
No positive completion percentage overrides an open critical gate. A successful local build or synthetic demo is insufficient launch authorization.

## Launch gates and operating sequence

| Stage | Required outcome | Evidence |
| --- | --- | --- |
| Synthetic investor demo | Isolated synthetic data, restricted sharing, accurate claim wording | Existing preview checks plus current release checks; no real funds/data |
| Core invited pilot | Every `core` gate closed, named operational owner, approved narrow scope | Candidate SHA/digests, CI/release artifacts, hosted smoke/inbox/recovery evidence, enrollment and commercial approval |
| Provider-enabled pilot | Core gates plus every `provider` gate closed | Three-persona job journey, unrelated-provider/expiry/reassignment/concurrency tests, actual reviewed provider and signed service terms |
| Broader production | Wider corridor/commodity policies and capacity, independent security review and sustained operating proof | External review, production restore/incident drills, measurable customer and unit-economics evidence |

Governance owner: founder until explicitly delegated; engineering implementation: assigned contributor; hosting, security response and customer support must each have a named person before launch. These role assignments are proposals, not completed GOV-002 ownership. Gates track outcomes, not file existence. Store the release SHA, date, reviewer, test artifact and hosting evidence; redact credentials and private documents.

## Security priority

1. Preserve accepted cookie/origin/proxy regression controls (SAF-001); finish route-family coverage and deployment-specific ingress review under SEC-007. New proxies cannot inherit trust without fresh evidence.
2. Preserve accepted shared account/IP/deployment public abuse budgets (IDN-013/SEC-011); validate actual multi-process crash behavior, hosted client attribution, capacity and alert ownership under PER-006/OPS-018/OPS-006.
3. Preserve accepted mandatory privileged passkeys, restricted sessions, fresh mutations and immediate audited suspension/revocation (IDN-003/011/012). Complete physical/hosted factor review, reviewer independence, notifications, privileged access review and emergency recovery acceptance under SAF-004/IDN-018/019.
4. Complete the route/resource authorization matrix, including evidence links, exports, list filters, public views, role changes and indirect IDs. Future provider grants need their own threat model before any portal work. Consider PostgreSQL RLS as defense in depth after application scope types stabilize; do not treat RLS as a substitute for domain authorization.
5. Validate secrets, exact origins, CSP, cookie attributes and private storage in the deployed environment. Rotate keys, enforce least-privilege service accounts, scan dependencies and third-party images, retain provenance/SBOM and time-limited reviewed exceptions. No wildcard CORS or public upload buckets.
6. Keep goods/payment mutations, audit and notification outbox writes atomic. Test retries, deadlocks, expired tokens, process crashes, duplicate submissions and rejected transitions. A buyer reference remains a submitted payment until the authorized recipient verifies receipt; no escrow/payment-provider claim.
7. Map the pilot threat/control checklist to OWASP ASVS 5 Level 2-focused review and NIST SSDF. Record implemented, unverified and accepted-exception controls; this is not certification. An independent reviewer remains a launch prerequisite for wider public production and should inspect high-risk pilot boundaries where feasible.

Guidance: [OWASP ASVS](https://github.com/OWASP/ASVS), [NIST SSDF / SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final). These provide review structure, not evidence that this product complies.

## Architecture and maintainability

Use a modular monolith with an explicit worker process and Postgres as the transaction boundary. Preserve functioning vertical slices while extracting policy/use cases/repositories. SOLID here means focused responsibilities, explicit ports, replaceable infrastructure and small tested interfaces; it does not mean creating a class for every function or distributing services prematurely.

Prioritize shared next-action/transition rules; typed actor/resource scopes and exact money/quantity types; stable API errors/OpenAPI; query modules; atomic audit/outbox; bounded trace algorithms; split feature pages/API clients. See [ARCHITECTURE_MODERNIZATION.md](ARCHITECTURE_MODERNIZATION.md). Rename alongside seam extraction, not by mass replacement in historical migrations or database keys.

## Performance and capacity evidence

These are proposed budgets to approve and measure under PER-004/OPS-012, not current achievements. Initial pilot envelope: up to 10 organizations, 20 named users and 10 simultaneous active users; no commitments beyond the approved budget. Benchmark at least 10,000 listings and 100,000 holdings to reveal growth behavior. Record hardware, dataset, query plans, concurrency, warm/cold runs, p95/p99 and failure rates.

| Workload | Proposed budget / behavior |
| --- | --- |
| List/detail reads | p95 ≤500 ms excluding third-party services; default 50/max 100 rows, bounded filters |
| Trade state mutations | p95 ≤1 s for local transactional work; exact conservation and no duplicate settlement |
| Trace/recall | p95 ≤3 s within declared graph budget; start with 1,000 nodes/5,000 edges and tested limits; oversized/incomplete analysis fails safely |
| File operations | Per-file/per-tenant quotas, bounded concurrency, scanner timeout and memory budget tested together; do not infer safe throughput from 10 MB size checks |
| Frontend | Route splitting and measured mobile journey; approve bundle, interaction and layout-shift budgets before claiming performance |
| Reliability | Proposed RPO ≤24 h/RTO ≤4 h for the invited pilot, subject to actual customer agreement and a successful DB plus file restore drill |

Instrument pool utilization, query and HTTP latency, scanner queue, outbox age/retries, auth failures and 5xx. Configure useful alerts with an incident owner; health endpoints alone are not monitoring. Define clean overload errors and safe retries. Archive baselines in CI without flaky absolute timings on unknown shared runners; run budget assertions on controlled representative hardware.

## Environments and zero-budget constraint

Development: synthetic local Compose. Test: disposable DB/storage/email/scanner with automatic fixtures, no developer/customer data. Staging: separate secrets/database/private objects, real email inbox tests and representative synthetic data. Production/pilot: separately scoped service identities, HTTPS, restricted administration, approved users, monitored workers and tested encrypted backup/recovery. Promote the same reviewed image digest; migrations use the normal manifest-verified release job.

The budget remains USD 0/month. No paid auto-upgrades or trial-dependent hosting are authorized. Provider eligibility, account verification and actual free capacity require confirmation. If free resources cannot provide private data handling, scanning and the agreed recovery envelope, keep the synthetic demo and mark real pilot hosting blocked. A self-managed encrypted backup alternative to managed PITR requires a new reviewed hosting ADR, named owner, accepted data-loss window and actual recovery drill; it does not silently close OPS-001's managed-PITR criterion. The founder PC/temporary tunnel is a synthetic preview, not the real-data pilot host.

## Three-month execution sequence

Dates are sequencing targets, not evidence or promises. Use at most three independent slices at once, with automated acceptance and review before integration.

| Window | Engineering focus | Parallel founder/operations work | Exit evidence |
| --- | --- | --- | --- |
| Weeks 1–2 | Existing release failure closure; origin/shared abuse/admin controls; source-path/sourcing regressions; identity mapping | Pilot commodity/corridor, candidate organizations, free-host eligibility, ownership | Security regression matrix and coherent fresh-account browser flows |
| Weeks 3–4 | Next-action engine, typed boundaries, pagination/trace/file budgets; worker/monitoring/restore automation; customer-facing BetterTrade identity | Real inbox/domain configuration, commercial/privacy terms, support contacts | Every core gate closed; hosted release and restore plus performance evidence |
| Weeks 5–6 | Supervised core pilot fixes; provider onboarding/capability policy and RFQ disclosure model | Interview providers, validate route/cargo/license requirements and service payer terms | Actual core trade usage; reviewed provider model and threat tests |
| Weeks 7–9 | RFQ/quote/award/acceptance with job grants and atomic retries; provider proof/milestones and exceptions | Enroll a small curated provider cohort, agree quotes/insurance/disputes | Real three-persona browser/DB coverage, unrelated-provider denial |
| Weeks 10–12 | Provider pilot, service financial reconciliation, code/API inheritance work, expanded language coverage | Capture activation, time-to-trade, repeat usage, revenues/costs, diligence materials | All provider gates closed and real operational/customer evidence |
| Beyond month 3 | Validated second corridor/commodity, volume/count units, advanced localization, FX only after demand, multi-leg/API integrations | Independent security assurance, hiring, financing and partner expansion | Evidence-based expansion decisions |

If hosting or enrollment remains blocked, do not fill the gap with more speculative features. Improve automated evidence and product usability while resolving the blocker.

## USD 8M+ investment ambition

The technical goal is a product developers can inherit and customers can trust. A valuation is not a backlog percentage. The investment case needs verified demand, repeated completed trades, time saved and conversion improvements, willingness to pay, clean goods/service/platform fee economics, defensible verified relationship/fulfillment data, reliable operation, documented IP/team ownership and a credible go-to-market plan. Maintain an evidence room with actual cohort results, security/restore reports, limitations, operating costs and reconciled fees. Do not imply regulated escrow, legal certification or universal supply verification.

Before inviting investors, the demonstration must tell one coherent buyer–supplier story and explain what the future provider layer adds. Before inviting customers, every core gate must be closed. Before enabling providers, every provider gate must also be closed.

## Reconciled progress, 2026-10-13

Core invited pilot: 11/28 closed (39.3%), 11 partial, four blocked and two open. Full roadmap: 88/343 complete (25.7%), 71 partial and 184 open. Provider-enabled launch including core: 11/40 (27.5%); none of the twelve additional provider gates is complete. These are equal-weight closure counts, not effort-weighted engineering readiness or valuation. See the grooming report for ten missed completions and the separately tracked streaming follow-up.
