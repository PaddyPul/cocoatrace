# CocoaTrace UI/UX redesign sprint

## Sprint goal

Turn CocoaTrace from a database-shaped prototype into an intuitive traceability
workspace that a farmer, exporter, buyer or regulator can understand without a
walkthrough. Preserve every API contract and operational workflow while making
the product's core promise—trace a product and contain a recall—immediately
discoverable.

**Sprint length:** 10 working days  
**Release theme:** From records to decisions  
**Non-negotiable:** no business-rule, permission or API regressions

## Problems observed

1. Navigation is a flat list of 15 destinations with no workflow grouping.
2. Recall Center is hidden from users who can trace batches but cannot activate a recall.
3. Page headers provide titles but little explanation, status or next action.
4. Dense tables and compact controls make operational tasks difficult to scan.
5. Role dashboards show counts without enough context or workflow guidance.
6. Mobile navigation works mechanically but does not prioritise common actions.
7. Loading, empty and error states are inconsistent across pages.
8. Provenance, evidence and recall—the product differentiators—look secondary to CRUD screens.

## Information architecture

| Workspace | Destinations | User question |
|---|---|---|
| Overview | Dashboard | What needs my attention? |
| Traceability | Farms, Batches, Traceability & Recalls, Certificates, Evidence | Where did it come from and is it safe? |
| Trade operations | Marketplace, Listings, Holdings, Offers, Contracts, Shipments, Payments | What is moving commercially? |
| Governance | Audit Log, Organizations | Who did what and who has authority? |

## Sprint backlog

### P0 — release blockers

- [x] Group navigation around user tasks rather than database entities.
- [x] Expose Traceability & Recalls to every role with `batch.read`.
- [x] Keep activation and resolution controls limited to `recall.manage`.
- [x] Add clear page descriptions, role context and responsive navigation.
- [x] Fix API environment bootstrap and PostgreSQL setup readiness race.
- [ ] Run a seven-role permission walkthrough against seeded data.

### P1 — core experience

- [x] Refresh the visual system: spacing, cards, controls, tables, focus states and typography.
- [x] Redesign login as a product introduction plus role-based demo entry.
- [x] Add a role-aware dashboard welcome and clearer action hierarchy.
- [x] Reframe Recall Center around investigation first and activation second.
- [ ] Convert wide operational tables into responsive table/card hybrids.
- [ ] Add consistent page-level filters, result counts and empty states.
- [ ] Add breadcrumbs and next-best actions to detail pages.

### P2 — workflow polish

- [ ] Add guided farm → batch → attest → hold → list progression.
- [ ] Add a persistent product/lot context strip across related detail pages.
- [ ] Add timeline components for custody, shipment and audit events.
- [ ] Add a dedicated QR/profile management view for packaged lots.
- [ ] Add keyboard navigation and a command/search palette.
- [ ] Complete WCAG 2.2 AA contrast, focus and screen-reader review.

## Acceptance criteria

1. A first-time user can locate trace-back or trace-forward in two clicks or fewer.
2. A user with `batch.read` can investigate genealogy without receiving a recall API error.
3. Only a recall manager can see or use activation and resolution actions.
4. All seven seeded roles see a navigation structure appropriate to their permissions.
5. Existing API endpoints and payloads remain unchanged.
6. Desktop works from 1024 px upward; mobile works at 375 px without horizontal page overflow.
7. All existing tests, TypeScript checks and production builds pass.
8. The clear profile, warning profile and live recall demo remain functional.

## Validation script

- Sign in once as each seeded role and capture visible navigation destinations.
- As Farmer, open Traceability & Recalls and perform trace-back without recall controls.
- As Admin, perform trace-forward, activate a recall and resolve it.
- Confirm the public product profile changes safety state after activation.
- Complete one farm, batch, listing, offer and shipment workflow.
- Test 375 px, 768 px, 1024 px and 1440 px layouts.
- Run API tests, API typecheck, API build and Web build.

## Out of scope for this sprint

- Changing recall formulas or supply-chain business rules
- Replacing React, Express or PostgreSQL
- New third-party design-system dependencies
- Native mobile applications
- Automated recipient email/SMS delivery
