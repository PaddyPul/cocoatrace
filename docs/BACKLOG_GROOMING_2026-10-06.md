# Backlog grooming audit — 2026-10-06

Scope: inspect current repository against acceptance criteria and founder-reported release/merge acknowledgements; update BetterTrade/pre-pilot direction. Source baseline: `deca6174efe81de1921932d58abdd34e91b6591d`. This audit does not independently verify GitHub protection settings, actual hosting, customer enrollment, legal advice or archived CI results. Latest language-label correction remains pending native acknowledgement.

## Reconciled completion evidence

| Item | Correction | Evidence and remaining boundary |
| --- | --- | --- |
| ENV-007 | Complete | Ephemeral PostgreSQL migration CI and normal release runner; previously closed QLT-005 founder native acknowledgement |
| ARC-025 | Complete | `api/src/services/authSessionService.ts`, authoritative DB sessions/token hashes/current actor; identity session-revocation regressions and earlier founder merge |
| TRD-013 | Complete | `api/src/modules/trading/offers.ts`, currency/deadline rejection; trading/currency integration tests and founder-confirmed currency releases |
| LOG-009 | Complete | Shipment/contract private evidence with scan-clean and payment-controlled downloads; payment workflow/browser tests and earlier founder payment/document acknowledgement |
| QLT-003 | Complete | Already covered by completed TRD-009 concurrency/conservation regression suite and founder native release report |

These five were missed status updates, not five newly implemented features. Completion retains the same founder-report evidence standard as prior completed rows; independent CI artifact archival is still open. Controlled downloads do not prove expiring download links: UPL-010 remains partial.

## Partial implementation acknowledged

Changed open → in progress without reducing acceptance criteria:

- Architecture: ARC-003/004/007/008/013/014. Scoped policies, adapters, delivery/recall modules and domain transaction/outboxes exist; full adoption and operational boundaries remain.
- Identity/security: IDN-011/014, SEC-007/008/010. Live actor checks/security events/headers/body limits exist; suspension/MFA/origin adversarial tests/query bounds remain.
- Documents/logistics: UPL-010, LOG-001/008. Controlled downloads/coordinator mapping/exception audit exist; explicit download expiry, route/mode tests and acknowledgements remain.
- Product/testing: PRD-004/005/006, QLT-009/010. Direct inventory, editable sourcing and trade journeys exist; all fresh entry paths, one action engine, source publishing and brief persistence browser journeys remain.
- Operations/demo: OPS-003/005/010, INV-001. Logs/probes/domain queues/temporary synthetic preview exist; centralized monitoring, scheduling and stable hosted operations remain.

LNG-001–003 and CUR-001–003 stay partial because their broad acceptance criteria exceed shell translation and supported-currency arithmetic. Refund/FX policies, full translated trade/email journeys and human approval are not silently credited. No runtime rename or provider marketplace implementation is credited.

## Progress after expanded scope

Run `npm run backlog:progress` to regenerate and `npm run test:backlog` to validate the register.

| Measure | Complete | Partial | Open/blocked | Closure |
| --- | --- | --- | --- | --- |
| Entire named roadmap | 69 / 342 | 53 | 220 open | **20.2%** |
| Core buyer–supplier pilot gates | 7 / 28 | 12 | 5 open + 4 blocked | **25.0%** |
| Additional provider gates | 0 / 12 | 0 | 12 open | **0.0%** |
| Provider launch including core | 7 / 40 | 12 | 17 open + 4 blocked | **17.5%** |

The previous prose reported 307 named items, 64 complete (20.8%), 30 partial and 213 open. The reproducible recount also includes the three linked BST hosting rows: the actual baseline was 310 named items, 64 complete (20.6%), 31 partial and 215 open. After grooming: five overlooked completions, 23 open-to-partial corrections and 32 newly specified items. ENV-007 moved from partial to complete; the other four closures moved from open. The broader denominator makes full-roadmap percentage slightly lower despite more completed work. Counts weight every named item equally, exclude unnamed phase/DoD checkboxes, include linked BST rows and give partial work no completion credit. These are neither effort-weighted estimates nor a percentage of safety, technical code readiness, investment value or an $8M valuation.

Core gates count bounded outcomes separately from broad backlog items: for example, tested supported-currency trade flow can be closed while the broader currency/refund policy remains partial. Provider launch requires all core gates too. The new gate set is a proposed auditable launch definition, not a historical percentage comparable with earlier casual readiness estimates.

## High-priority findings

- `sensitiveActionLimit` currently uses an in-process Map and combined IP/target keys; shared per-account/IP controls and cardinality budgets remain.
- Browser-origin handling needs malformed Authorization plus cookie and absent/null Origin/proxy tests. This is a review finding, not a demonstrated exploit.
- PublishSupply empty state still routes conventional users through farm/plot/harvest. Dashboard and DealRoom duplicate next-action logic.
- Evidence entity types do not include plot. Earlier manual instructions mentioning direct plot uploads must not be treated as implemented capability; use supported farm/batch records until a plot policy is designed.
- Lists lack universal pagination; trace graph computation lacks explicit node/edge/depth budgets and contains recursive/repeated scans. File downloads buffer contents; upload size checks alone do not establish safe concurrent memory use.
- Readiness probes and structured logs exist; deployed collector, alerts, workers, real inbox delivery and full DB/object-byte restoration are not verified.
- Existing goods fee records are separate from bank settlement. Future provider service fees/commissions need a separate approved ledger and commercial policy.
- Old cocoa-only docs contained obsolete “not a marketplace”, mandatory-certifier/farm and deployment assumptions. Current documents now reflect BetterTrade; previous detail is retained under `docs/archive/pre-bettertrade-2026-10-06/` and explicitly superseded.

## Maintenance procedure

Every completed item needs criterion-level code/test and release or operational evidence. Update DELIVERY_BACKLOG.md and the applicable pilot gate together; they measure different scope. Record actual SHA/date/reviewer/artifact, not “looks done”. Keep external provisioning and customer/legal decisions blocked until real evidence arrives. Changes to the gate denominator require an explanation in the next grooming report. No work item may be closed merely to increase a percentage.

At each “what next?” consult the execution queue, open critical gates, current release failures and blocked external owners. Prefer coherent vertical slices with automated regression; independent implementation boundaries may be delegated when requested, with one integration owner. Do not replace manual customer/provider discovery or legal/hosting approvals with simulated tests.

## Follow-up reconciliation — 2026-10-06 transport merge

Founder reports the Incoterm responsibility bundle tested and merged after access suspension/safe restoration was also tested and merged. LOG-001 is closed against its original all-term coordinator/permission criterion; typed named places, modes, domestic customs and provider delegation stay LOG-002/003/004, GEO-001 and SVC items. CORE-transport remains partial. IDN-011 remains partial for privileged recovery/permanent deactivation; stale native-pending wording in its pilot gate is superseded. Authentication budgets are PostgreSQL-backed and malformed/absent-origin adversarial tests are already merged; the initial high-priority in-memory/origin findings above are historical, not current open findings.

Next authorized wave: SEC-011 public/resource rate policies. Owner: Codex implementation; Albert native release/merge acceptance. Current register: 72/342 complete (21.1%), 53 partial and 217 open; core pilot 8/28 closed (28.6%). Public-abuse implementation is partial until native release/merge evidence. No provider gate or valuation credit is inferred.
