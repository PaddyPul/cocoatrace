# CocoaTrace North Star

**Last reviewed:** 2026-09-29  
**Planning horizon:** 16 weeks  
**Primary execution backlog:** [`DELIVERY_BACKLOG.md`](./DELIVERY_BACKLOG.md)  
**Target architecture:** [`ARCHITECTURE_MODERNIZATION.md`](./ARCHITECTURE_MODERNIZATION.md)

## Ambition

CocoaTrace should become a credible, investable system for evidence-backed raw-material sourcing and trade coordination. The immediate wedge is the Ghana-to-EU cocoa corridor; the underlying product primitives should remain usable for other agricultural and industrial raw materials without pretending that every commodity workflow is already complete.

The commercial North Star is to build a company that can credibly support an **USD 8M pre-seed valuation**. Engineering quality is necessary evidence for that ambition, but it is not sufficient by itself. The valuation case must combine:

1. a painful and valuable customer problem;
2. repeatable buyer and supplier usage;
3. credible data, security and operational controls;
4. a defensible traceability and workflow model;
5. a team and codebase capable of shipping quickly; and
6. evidence that customers will pay or commit to pilots.

## Product promise

> A buyer and supplier can move from a sourcing need to an evidence-backed deal, coordinate payment and fulfilment, and trace affected material without losing the identity or trust state of the underlying supply.

CocoaTrace coordinates records and decisions. Unless separate regulated capabilities are added, it is not a bank, escrow provider, certifier, carrier, customs broker or legal compliance authority.

## Initial customer and scope

### Primary customer

Exporter, cooperative or raw-material supplier operations teams that need to assemble buyer-ready supply and exchange evidence without spreadsheets and scattered messages.

### Secondary customer

Importers and buyers that need to compare supply, review evidence, agree commercial protections and follow fulfilment.

### Supporting participants

Certifiers, field operators, logistics coordinators, auditors and regulators contribute or review bounded records. They are not the primary product surface for the first customer MVP.

### Initial product boundary

The first production MVP supports:

- conventional and source-traceable supply creation;
- marketplace publication and sourcing requests;
- offers, acceptance and immutable commercial terms;
- payment-plan coordination without holding funds;
- buyer/seller-managed external logistics;
- evidence exchange with controlled release;
- delivery confirmation and exceptions;
- product identity, trace-back, trace-forward and operational recalls; and
- organization, user, role and invitation administration.

Transformation, blending and repacking must either be implemented as real customer workflows or removed from customer-facing claims until they are.

## Four proofs required for investability

| Proof | Question an investor will ask | Evidence CocoaTrace must produce |
| --- | --- | --- |
| Product | Does it solve a complete, painful job? | Users complete sourcing-to-settlement and recall tasks without product-team intervention |
| Market | Do credible customers want it? | Design-partner agreements, repeat usage, buyer review and willingness-to-pay evidence |
| Technical | Can this safely become a real platform? | Tenant isolation, secure evidence, reliable inventory, automated tests, observability and recoverability |
| Execution | Can another engineering team inherit and scale it? | Modular architecture, documented decisions, CI/CD, issue discipline and low-risk releases |

## Sixteen-week outcomes

### Product outcomes

- At least three approved supplier/exporter design partners and two buyer organizations are onboarded.
- At least 80% of pilot lots are prepared without direct product-team intervention.
- At least 80% of buyers find the required proof in under three minutes.
- The guided workspace always shows the responsible party and next safe action.
- Every customer-visible claim exposes its source and trust state.

### Safety and security outcomes

- Zero known critical cross-tenant authorization defects.
- One automated negative authorization test for every protected resource family.
- All production evidence is private, scanned, encrypted and permission-controlled.
- No supplier-entered record is labelled independently verified by default.
- A recall automatically blocks affected supply and identifies every recorded recipient.

### Reliability outcomes

- Staging and production use separate managed databases, object stores and secrets.
- Production has point-in-time database recovery and a completed restore drill.
- The exact staging artifact is promoted to production with an approval gate.
- Critical workflows have structured logs, error monitoring and actionable alerts.
- Rollback and incident-response procedures are exercised before public launch.

### Engineering outcomes

- HTTP controllers contain transport concerns, not embedded domain workflows.
- Database access is isolated behind repositories/query modules.
- Authorization is expressed through reusable policies and tested centrally.
- Trade, payment, shipment, evidence and recall statuses use explicit state machines.
- New code does not introduce untyped `any`, compressed multi-operation lines or silent operational failures.
- Critical API workflows have database integration tests and browser E2E coverage.
- A developer unfamiliar with the project can run it, find the architecture, select a backlog item and submit a compliant pull request in one working day.

## Operating metrics

The team should review these weekly once staging exists.

### Customer value

- Time from account approval to first supply or sourcing request
- Time from batch/inventory creation to published supply
- Offer-to-accepted-deal conversion
- Time each party spends waiting for the next action
- Percentage of deals completed without manual support
- Percentage of lots with complete required evidence
- Buyer evidence-review time
- Pilot task-clarity score

### Trust and safety

- Cross-tenant authorization failures found in CI or production
- Evidence scan failure rate
- Overdue certificate and evidence reviews
- Quantity reconciliation failures
- Recall trace completeness and acknowledgement time
- Exceptional dispatch frequency

### Delivery health

- Deployment frequency
- Lead time from merged pull request to staging
- Change failure rate
- Mean time to restore service
- Critical-path E2E pass rate
- Open P0/P1 backlog age

## Product principles

1. **Truth before polish.** Self-declared, document-supported and independently verified records must never be conflated.
2. **One responsible next action.** The dashboard, deal room and notifications should agree about who acts next.
3. **Safety is enforced server-side.** UI hiding is not authorization or a business rule.
4. **A complete narrow workflow beats a broad simulation.** Unsupported breadth must not be marketed.
5. **External services stay replaceable.** Storage, email, AI and future payment providers are adapters behind stable interfaces.
6. **Auditability is part of the transaction.** Critical writes and their audit/outbox records succeed or fail together.
7. **Production data never enters demo.** Environments, credentials, buckets and databases remain isolated.
8. **No big-bang rewrite.** Modules are extracted incrementally behind tests while customer workflows continue to work.

## Release definitions

### Investor-ready demo

- Synthetic, coherent, resettable data only
- No production credentials or shared production services
- Stable five-minute buyer/supplier/recall story
- Unsupported claims and dead controls removed
- Demo failures cannot affect staging or production

### Controlled design-partner pilot

- Named users and approved organizations only
- Tenant isolation and private evidence proven
- Inventory, payment gates and recall enforcement proven
- Backups, monitoring and incident ownership active
- Pilot agreement, privacy notice and known limitations accepted

### Real-customer production MVP

- All P0 items and the production release gate in the delivery backlog are complete
- Independent authorization review has no critical findings
- Backup restoration and rollback are exercised
- Critical E2E, concurrency and migration suites pass
- Support, legal, retention and incident processes are operational

## Decision rule

When choosing work, prefer the item that most directly improves one of these in order:

1. customer or data safety;
2. completion of the core buyer/supplier job;
3. evidence of repeatable customer value;
4. operational reliability;
5. developer speed and inheritability; then
6. optional breadth or visual polish.

The delivery backlog is the source of truth for what remains. Work is not complete because code exists; it is complete only when the backlog acceptance criteria and definition of done are satisfied.
