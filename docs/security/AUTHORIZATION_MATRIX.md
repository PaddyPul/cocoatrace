# CocoaTrace authorization matrix

Status: approved authorization contract for Phase 1 implementation  
Last reviewed: 2026-09-29  
Backlog owner: SEC-001

This document defines who may perform each operation and the tenant or relationship scope that must be enforced by the API. The SEC-002 through SEC-005 and UPL-001 remediations are implemented on the security-boundary branch and await a green real-PostgreSQL regression run before their backlog items close. SEC-006 remains open before a production pilot.

## Security principles

1. Authentication and a named permission are necessary but not sufficient. Every request to a protected resource must also pass a resource-level authorization policy.
2. Ordinary permissions such as `farm.read` are bounded to the actor's organization or an explicitly modelled relationship. They never imply network-wide access.
3. Network-wide access requires a separate `*.all` or `*.network` permission and is reserved for a narrowly approved regulator, auditor or platform-administration role.
4. Tenant and relationship constraints belong in the database query or transaction that reads or changes the resource. UI visibility is not an authorization control.
5. A public marketplace or product view is a deliberately limited projection. It does not make the underlying farm, batch, evidence, contract or profile record public.
6. Authorization is inherited from the resource to which evidence is attached. An arbitrary identifier supplied by a client never establishes access.
7. Contract, payment, transport and contract-document access is limited to contract parties unless a separate, explicit oversight permission applies.
8. Exact plot coordinates, personal data, internal identifiers, storage paths, commercial terms and unreleased documents are private by default.
9. Authorization decisions and denied high-risk actions must be auditable without recording secrets or sensitive payloads.
10. Platform administration and organization administration are different scopes. An organization administrator cannot grant platform-wide authority.

## Actors

| Code | Actor | Default boundary |
|---|---|---|
| F | Farmer or field operator | Own organization and its source records |
| C | Certifier or auditor | Records assigned or presented for certification |
| S | Exporter, cooperative or supplier | Own organization, held inventory and its trades |
| B | Importer or buyer | Marketplace projections and its trades |
| L | Logistics operator | Shipments to which it is explicitly assigned |
| R | Regulator or network auditor | Only the network domains granted by explicit network permissions |
| OA | Organization administrator | Members and settings of its own organization |
| A | Platform administrator | Platform scope through `*`, subject to privileged-access controls |
| P | Public visitor | Published, privacy-reviewed projections only |

An individual may hold more than one role. Permissions are additive, but every permission retains its scope. Combining two tenant-bounded roles must not create network access.

## Resource, action and scope matrix

`Own` means the resource is owned or currently held by the actor's organization. `Related` means an explicit database relationship exists, such as contract party, transfer destination, assigned certifier or assigned transport operator. `Network` always requires the explicit permission listed later in this document.

| Resource | Action | Allowed actors | Required scope and policy |
|---|---|---|---|
| Session/account | Sign in, sign out, read current identity | Authenticated user | Self only; account and organization must remain active |
| Organization | Read organization profile | F, C, S, B, L, R, OA; A | Own organization; A may read Network |
| Organization | Create organization | A | Network administrative operation only |
| Organization members | List, invite, revoke or change role | OA; A | OA is Own organization only; A is Network; role assignment must use an allowlist and cannot elevate OA to platform administrator |
| Farm | Create or update | F, S | Own organization |
| Farm | Read full record | F, S; assigned C; R; A | Own, certification assignment, or explicit Network permission |
| Farm | Read marketplace origin | B | Sanitized projection for an active listing or buyer's contract; never exact coordinates |
| Plot | Create or update | F, S | Parent farm must be Own |
| Plot | Read exact record | F, S; assigned C; R; A | Same policy as parent farm; exact coordinates remain private |
| Batch/material lot | Create | F, S | Source farm and initial holder must be Own; direct inventory belongs to actor's organization |
| Batch/material lot | Read full record | F, S; assigned C; deal-related B; shipment-related L; R; A | Own, held, explicit assignment, contract relationship, shipment relationship or explicit Network permission |
| Batch/material lot | Read marketplace view | Authenticated marketplace participant | Sanitized projection for an active listing; no private evidence or storage metadata |
| Batch attestation | Create | C | Certificate must be issued by C, cover the same farm/organization/crop and cover the harvest date |
| Certificate | Issue | C | Certifier organization is actor's organization; subject farm and farmer organization must agree |
| Certificate | Change status | C | Certificate was issued by actor's organization |
| Certificate | Read | Issuer C; subject F/S; listing/contract-related B; R; A | Issuer, subject, documented trade relationship or explicit Network permission |
| Holding | Read, create or split | F, S and any current holder | Current holder organization only |
| Custody transfer | Request | Current holder | Source holding is held by actor's organization |
| Custody transfer | Read | Source and destination organizations | Related transfer only |
| Custody transfer | Accept | Destination organization | Pending transfer addressed to actor's organization |
| Listing | Read active listing | Authenticated user | Marketplace projection only |
| Listing | Create, update or withdraw | Current holding owner | Own holding and Own listing; quantity must remain available |
| Offer | Create | B | Active third-party listing; buyer organization is actor's organization |
| Offer | Read | Buyer and listing seller | Related offer only |
| Offer | Accept or reject | Listing seller | Seller organization owns the listing; operation is transactional |
| Contract | Read | Seller and buyer; R; A | Contract party or explicit `contract.read.all` |
| Contract | Propose payment terms | Seller | Contract seller only |
| Contract | Confirm payment terms or buyer compliance references | Buyer | Contract buyer only |
| Payment | Read | Seller and buyer; R; A | Contract party or explicit `payment.read.all` |
| Payment | Request or verify receipt/security | Seller | Contract seller only |
| Payment | Submit payment or security | Buyer | Contract buyer only |
| Shipment | Read | Seller, buyer, assigned L; R; A | Contract party, assigned operator or explicit `shipment.read.all` |
| Shipment arrangement | Update | Incoterm-selected coordinator | `transport_coordinator_organization_id` must equal actor's organization |
| Shipment milestone | Record | Seller, buyer or assigned L according to milestone policy | Related shipment; payment dispatch gate remains server-enforced |
| Evidence | Upload | Entity-authorized actor | Validate permission against linked farm, batch, certificate, contract, profile or other supported entity before accepting bytes |
| Evidence | List or download | Uploader and entity-authorized participants; approved reviewer; R; A | Inherit linked-entity policy and document-release state; use authorized download, never a public storage path |
| Provenance | View | Source organization, current holder, assigned C, contract party; R; A | Own or Related batch; explicit Network permission for R/A |
| Provenance | Export | Same actors with export permission | Same scope as view; supplied `contractId` must belong to the requested batch and actor must be a contract party or Network-authorized |
| Product profile | List or read draft | Current holder; R; A | Own/held batch or explicit Network permission |
| Product profile | Create, update or publish | Current holder | Underlying batch is currently held by actor's organization |
| Published product profile | Read or scan | P and all actors | Published, privacy-reviewed projection by slug only |
| Trace graph | List or traverse | Organization related to the lot; R; A | Owned, held, traded or received lot; output is a policy-approved connected projection; Network requires explicit permission |
| Recall | Calculate impact or initiate | Organization related to seed lots; R; A | Every seed lot passes relationship policy or actor has `recall.manage.all` |
| Recall | Read or resolve | Initiating organization; affected participant projection; R; A | Originator resolves; Network operations require explicit permission |
| Audit event | Read | Authorized organization auditor; R; A | Own organization only unless `audit.read.all` |
| Audit event | Export | Authorized organization auditor; R; A | Own organization only unless `audit.export.all` |
| Sourcing request | Create, update or read private request | B | Buyer organization owns request |
| Sourcing request | Read marketplace demand | Qualified F/S | Open and matched projection only |
| Onboarding and trade actions | Read or update | Authenticated user | Self and Own organization/trade relationships only |
| Feedback | Create | Authenticated user | Self and Own organization |
| Feedback | List | OA; A | Own organization; A may read Network |
| Readiness metrics | Read | Authenticated organization member; R; A | Own/Related metrics; Network metrics require `analytics.read.network` |

## Explicit network-wide permissions

The following permissions are distinct from their ordinary tenant-bounded counterparts:

| Permission | Intended purpose |
|---|---|
| `farm.read.all` | Approved regulator/platform review of all farms and plots |
| `batch.read.all` | Approved regulator/platform review of all batches and material lots |
| `certificate.read.all` | Network certificate oversight |
| `product_profile.read.all` | Network review of draft and published profiles |
| `provenance.read.network` | Network provenance investigation |
| `provenance.export.network` | Network provenance export |
| `evidence.read.all` | Approved evidence review; document lifecycle rules still apply |
| `contract.read.all` | Legally justified network contract oversight |
| `payment.read.all` | Legally justified payment-status oversight; sensitive references require field policy |
| `shipment.read.all` | Network transport oversight |
| `audit.read.all` | Read all tenant audit events |
| `audit.export.all` | Export all tenant audit events |
| `traceability.read.network` | Traverse the full trace network |
| `analytics.read.network` | Read cross-organization operational aggregates |
| `recall.manage.all` | Coordinate and resolve network recalls |

The existing `*` permission remains platform-administrator-only. No ordinary permission such as `batch.read`, `certificate.read`, `audit.read`, `offer.create` or `shipment.update` may be used as a proxy for any permission in this table.

## Confirmed security review findings

The findings below were confirmed in the 2026-09-29 review. Findings covered by SEC-002 through SEC-005 and UPL-001 have implemented repairs and negative PostgreSQL regressions pending a green run. Public-field policy, session revocation and other findings outside that scope remain open under their own backlog items. Historical evidence is retained so future changes do not reintroduce repaired defects.

| Severity | Defect | Evidence |
|---|---|---|
| Critical | `certificate.read` is both the route permission and the controller's network-wide switch, so an ordinary reader can list or retrieve every certificate. | `api/src/routes/certificates.ts:9-10`; `api/src/controllers/certificateController.ts:8-20,35-40`; affected seeded roles in `db/seed.sql:22,24,26` |
| Critical | Provenance accepts an arbitrary `contractId`, fetches it without party or batch checks, and returns the contract and shipment with the requested batch. | `api/src/controllers/provenanceController.ts:39-45,60-70,117-138,159-166` |
| Critical | Provenance treats ordinary `batch.read` as global and returns exact plots plus all batch evidence. | `api/src/routes/provenance.ts:7-8`; `api/src/controllers/provenanceController.ts:27-35,104-112`; `db/seed.sql:21-26` |
| Critical | Product-profile listing and lookup by batch are unscoped, exposing draft profiles, slugs, scan counts and metadata to any ordinary batch reader. | `api/src/routes/publicProducts.ts:13-14`; `api/src/controllers/publicProductController.ts:221-263` |
| Critical | The upload directory is served statically, bypassing the protected evidence download and payment-release policy. | `api/src/app.ts:41`; protected path at `api/src/controllers/evidenceController.ts:59-105` |
| High | Farm network access is inferred from unrelated permissions including `offer.create` and `shipment.update`, exposing farms, plots and certificates. | `api/src/controllers/farmController.ts:5-15,20-34`; grants in `db/seed.sql:22-26` |
| High | Any ordinary batch reader can open a listed batch and receive every evidence row, including storage metadata, regardless of review or release state. | `api/src/controllers/batchController.ts:82-111` |
| High | Evidence entity authorization is implemented only for contracts; arbitrary farm, batch, certificate or profile identifiers may be attached without ownership or relationship validation. | `api/src/controllers/evidenceController.ts:20-46,51-54` |
| High | Evidence list, upload, batch and provenance responses expose complete rows including internal `storage_path`. | `api/src/controllers/evidenceController.ts:8-17,51-56`; `api/src/controllers/batchController.ts:110-111`; `api/src/controllers/provenanceController.ts:35,70,112,166` |
| High | Ordinary `audit.read` is treated as network-wide in both list and export controllers. | `api/src/routes/audit.ts:7-8`; `api/src/controllers/auditController.ts:5-24,27-57` |
| High | Importer, certifier and regulator organization types receive network readiness metrics without an explicit network permission. | `api/src/controllers/readinessController.ts:6-29` |
| Medium | `audit.read` also grants full trace-graph scope, and a permitted seed traversal uses the entire graph without an explicit output-field policy. | `api/src/controllers/traceabilityController.ts:5-8,25-46`; `api/src/services/traceGraphRepository.ts:4-95` |
| Medium | The public product projection exposes organization names, an official traceability identifier, evidence filenames and hashes, and shipment locations/notes without a documented field-consent policy. | `api/src/controllers/publicProductController.ts:14-26,35-93,143-188` |
| Medium | Certificate creation does not prove that `farmerOrganizationId` owns `farmId`; attestation does not validate farmer organization or crop scope. | `api/src/controllers/certificateController.ts:44-49`; `api/src/controllers/batchController.ts:198-217` |
| Medium | JWTs carry organization and permissions for 24 hours without an account, organization, session or role-status recheck, delaying revocation. | `api/src/middleware/auth.ts:27-40,44-67` |

Direct contract handlers are currently party-scoped in `api/src/controllers/contractController.ts:136-252`. The confirmed contract disclosure is indirect through provenance and evidence/static-file paths. Negative tests must preserve the direct party checks while those indirect paths are repaired.

## Unauthorized-resource response policy

The consistent `403` versus non-disclosing `404` decision remains open under SEC-006.

Until that decision is recorded:

- policies must deny access regardless of which status is returned;
- tests should assert that no protected data or state change occurs, then use a shared response-policy helper once selected;
- public identifiers and collection endpoints should generally use `404` when revealing existence creates enumeration risk;
- an authenticated workflow may use `403` where the resource relationship is already known and the denial helps the user recover safely;
- the API must not reveal different database details, timing-sensitive messages or metadata for nonexistent versus unauthorized resources.

SEC-006 must choose one documented convention per endpoint class and update the tests below.

## Ordered negative authorization test plan

### P0 release-blocking tests

1. **Cross-tenant resource matrix.** Create organizations A and B with users holding the same ordinary permissions. Prove A cannot read B's farm, exact plots, certificate, unpublished profile, private batch evidence, provenance, contract, payment, shipment, holding or audit events.
2. **Certificate scope.** Prove ordinary `certificate.read` returns only issuer, subject or documented trade-related certificates; a foreign identifier is denied; `certificate.read.all` succeeds for the approved network actor.
3. **Farm scope.** Prove `offer.create` and `shipment.update` do not confer network farm access; an assigned certifier sees only the presented farm; `farm.read.all` succeeds for the approved regulator.
4. **Marketplace boundary.** Prove a buyer can read a sanitized active-listing projection but cannot retrieve private batch evidence, exact plot data or internal storage fields; inactive and unrelated batches are denied.
5. **Provenance combinations.** Test: foreign batch; authorized batch with an unrelated foreign contract; related contract requested by a non-party; related contract requested by a party. Repeat for view and export. Only the final case and explicitly network-authorized cases succeed.
6. **Product profiles.** Prove foreign drafts are absent from list and lookup; current holder can manage; a published slug is public; an unpublished slug returns `404`.
7. **Evidence upload.** Reject nonexistent or unauthorized farm, batch, certificate, profile and contract links. Reject contract non-parties. Prove a failed authorization leaves no stored temporary object.
8. **Evidence download.** Deny unrelated organizations, enforce contract-party and controlled-document release rules, prove `/uploads/<name>` is unavailable, and assert no API response contains an internal storage path.
9. **Trade resources.** Exercise every contract, payment and shipment read/mutation endpoint with a foreign UUID. Assert no protected response, state mutation or misleading audit event. Preserve seller/buyer happy paths.
10. **Audit scope.** Prove an organization auditor sees only its organization's events and exports; `audit.read.all` and `audit.export.all` provide approved network access.
11. **Readiness scope.** Prove importer or certifier organization type alone does not grant network metrics; `analytics.read.network` does.
12. **Trace scope.** Deny an unrelated seed lot; verify a connected traversal returns only the approved relationship projection; prove `audit.read` does not grant network scope and `traceability.read.network` does.
13. **Permission contract.** Maintain a route-to-permission-to-resource-policy test that fails when an ordinary `*.read` permission is used as a network switch.
14. **Public privacy projection.** Assert exact coordinates, internal identifiers and paths, private/unapproved evidence, personal data and commercial values never appear in a public profile.
15. **Certificate integrity.** Reject a certificate whose farmer organization does not own its farm, and reject attestation when crop scope or harvest-date coverage does not match.

### P1 hardening tests

1. Prove collection filters, pagination, query parameters and entity filters cannot escape the caller's scope.
2. Apply the SEC-006 response convention to nonexistent and unauthorized identifiers without resource-enumeration differences.
3. Prove multi-role users receive the union of bounded capabilities, never accidental network scope.
4. Prove suspension, role removal and session revocation remove access immediately after the identity/session work lands.
5. Add concurrency tests for offer acceptance, holding transfer/split, evidence release and recall initiation.
6. Add CSRF/origin tests for every cookie-authenticated mutation.
7. Add request, query, upload-size and rate-limit tests for public scan, login, invitation, provenance and evidence endpoints.
8. Assert allowed and denied high-risk actions produce suitable audit/security events without sensitive request data.

## Completion boundaries

SEC-001 is complete when this matrix is maintained in the repository. SEC-002 through SEC-005 and UPL-001 remain in progress until the implemented real-PostgreSQL regressions pass. SEC-006 remains open until the response policy is decided and tested.

## Recall response boundary (RCL-003–RCL-007)

| Operation | Permission and relationship |
| --- | --- |
| List/open notice | Signed-in initiator or registered affected organization; unrelated callers receive 404 on direct lookup |
| Read response inventory | Manager sees affected holdings; ordinary participants see only their own holdings and responses |
| Acknowledge | Actual signed-in member of the affected organization; managers cannot acknowledge another organization |
| Record contact/escalation | Initiating organization with `recall.manage`, or explicit `recall.manage.all` |
| Record recovery snapshot | Current holder of that affected, non-transferred holding; manager permission does not bypass ownership |
| Upload/download recall proof | Existing `evidence.upload` / `evidence.read` permission plus a recall relationship; recall evidence is intentionally shared among affected parties |
| Read proof metadata in response | Requires `evidence.read`, `evidence.read.all` or wildcard; relationship alone does not expose filenames |
| Resolve | Initiating manager or explicit network manager, reason, exact-recall clean evidence, all acknowledgements and fully accounted nonquarantined stock |

Every response mutation is recorded through the strict transactional trade audit. Resolved responses are read-only. The safety gate derives disposal blocks from recovery history as well as retained hold rows, so an accidentally removed hold does not make disposed stock tradable.

## Account access controls — 2026-10-06 candidate

| Resource/action | Platform administrator | Buyer/supplier organization administrator | Unauthenticated |
| --- | --- | --- | --- |
| List organizations/members for access review | Allowed, bounded cursor pages | Denied 403 | Denied 401 |
| Suspend/restore ordinary organization/member | Live authorization + password confirmation + reason; atomic audit/revocation | Denied 403 | Denied 401 |
| Suspend current/other privileged organization or member | Denied 409; separate privileged recovery required | Denied | Denied |

Access flags are independent of verification/deactivation. Restoring an organization does not restore suspended members or revoked credentials. Scope and adversarial tests: accessSuspension.integration.test.ts; browser admin flow: accessSuspension.spec.ts. MFA and privileged recovery remain pilot blockers; new-request revocation does not abort requests already authorized before the suspension commit.
