# BetterTrade threat model

Status: published engineering threat model; remediation and deployment acceptance are separate.
Model date: 2026-10-14. Backlog: SEC-015. Maintainer: engineering lead; accountable pilot risk owner: founder/operator.

## Scope and evidence standard

This model covers account takeover, tenant breakout, fraudulent claims, malicious evidence, payment-reference fraud and recall abuse in the current buyer/seller application. It includes the authenticated API, public projections, PostgreSQL state, evidence storage/scanner and asynchronous notifications. It is based on repository policy and regression sources, not an independent penetration test or a hosted configuration inspection. Linked tests identify implemented evidence; their presence is not a claim that they ran during preparation of this document. Founder-reported release acceptance is recorded separately in DELIVERY_BACKLOG.md.

Publication satisfies the modelling deliverable SEC-015. It does not close SEC-006/007/008/012/014/016/017/018/020, storage deployment gates or privileged recovery rehearsal. An $8m-or-higher valuation is a business target, not a security assurance result.

## Assets and security objectives

| Asset | Required property | Consequence of compromise |
| --- | --- | --- |
| Passwords, session tokens, passkeys and recovery approvals | Confidential credentials, live revocation, non-replayable privileged assurance | Account or platform takeover |
| Organization membership and scoped permissions | No client-selected organization or accidental network authority | Cross-tenant read/write and privilege escalation |
| Exact origin, evidence, private profiles and commercial records | Authorized projection and deliberate public disclosure only | Personal/commercial exposure and supplier harm |
| Inventory, offers, contracts and custody | Atomic quantities, party ownership and valid state transitions | Double allocation, diverted goods or false settlement |
| Payment references, proof and receipt decisions | Attribution and verified workflow state; no implied bank verification | Fraudulent dispatch or document release |
| Recall scope, recovery snapshots and retained holds | Complete impact, authorized response and persistent safety constraints | Unsafe goods re-entering trade or malicious business interruption |
| Audit/outbox/security events and operational recovery | Atomic attribution, bounded retry, protected evidence of actions | Concealed abuse, lost notification or duplicated actions |
| API/storage/scanner resources | Bounded work, explicit unavailable state and fail-closed safety decisions | Denial of service or safety checks bypassed during outage |

## Actors and trust boundaries

Actors include anonymous visitors, ordinary buyer/seller members, organization administrators, approved certifiers/reviewers, platform operators and external storage/scanner/email infrastructure. A legitimate member or counterparty may be malicious. A verified organization is not proof of honesty. Platform operators and infrastructure credentials are highly trusted and must not be treated as ordinary tenants.

| Boundary | Untrusted input crossing it | Enforcement and limitation |
| --- | --- | --- |
| Browser to API | Cookies, bearer headers, origin, IDs, body/query and filenames | Live session and declared permission before domain authorization; browser hiding is never a control |
| API to PostgreSQL | Resource IDs and business transitions | Parameterized, scoped reads and transactional ownership/state checks; DB credentials currently remain a privileged boundary |
| Private records to public/marketplace views | Supplier statements, profile content, recall summaries | Explicit projection and authoritative trust/safety assessment; publishing does not make source records public |
| API to evidence storage/scanner | Uploaded bytes, metadata, object keys and service results | Entity-authorized intent/content, opaque keys, validation/quarantine, scan and availability checks |
| Business transaction to background worker/email | Outbox content, retry/recovery instructions | Durable work and audited recovery; provider delivery does not prove recipient read or action |
| Local rehearsal to deployed pilot | Secrets, origins, ingress, buckets, backup and operator devices | Requires environment evidence; local tests do not establish hosted configuration |

Read entry guards are maintained in [route-authorization.json](route-authorization.json). Resource conventions and explicit network grants are maintained in [AUTHORIZATION_MATRIX.md](AUTHORIZATION_MATRIX.md). Session authentication is a snapshot of live authority at request admission: revocation blocks new requests, but does not magically cancel an already authorized read. Critical mutations additionally use transaction-level checks where implemented; universal race coverage remains an open acceptance item.

## Scenario register

Priority indicates consequence and urgency of a remaining gap, not an assertion of an exploitable defect. P0 must be resolved or explicitly block real customer access; P1 needs a named pilot decision/remediation before exposure; P2 is planned defense in depth. Owners below are responsibilities, not evidence that another person has accepted assignment.

### TM-01 — account takeover and recovery abuse

**Attack:** attacker guesses or reuses a password, steals a cookie, replays a challenge, abuses reset links, supplies malformed authorization to fall back to cookies, or persuades a reviewer to replace a privileged passkey. A compromised privileged account attempts to approve its own restoration or suspend the last usable administrator.

**Controls implemented:** database-backed hashed session tokens and current identity/organization/permission checks in `api/src/services/authSessionService.ts`; credential precedence in `api/src/middleware/credentials.ts`; shared sensitive-operation throttling and exact configured-origin enforcement in `api/src/middleware/security.ts`; restricted password sessions, signed passkeys and fresh mutation assurance in `api/src/modules/mfa/`; reviewed recovery in `api/src/modules/mfa/recovery.ts`; privileged continuity rules in `api/src/modules/accessControls/privilegedLifecycle.ts`. `requireAuth` marks session-bound responses `no-store`.

**Regression sources:** `api/test/integration/authBoundary.integration.test.ts`, `mfa.integration.test.ts`, `accessSuspension.integration.test.ts`, `privilegedLifecycle.integration.test.ts`; `e2e/authBoundary.spec.ts`, `e2e/passkeys.spec.ts`. These cover different boundaries: MFA assurance does not itself grant organization administration permission.

**Residual risk and action:** endpoint/device compromise can defeat a valid session; an attacker controlling genuine reviewers can abuse reviewed recovery. Hosted origin/TLS, physical factors, actual reviewer independence, emergency bootstrap and out-of-band recovery notifications need operator evidence (SAF-004, IDN-018/019, SEC-007/012). P0 for privileged operator readiness; owner founder/operator with engineering. Never weaken missing-origin cookie rejection or disable MFA to get a pilot passing.

### TM-02 — tenant breakout and confused authority

**Attack:** member substitutes another tenant's source/contract/evidence ID, splices a legitimate contract into unrelated provenance, reuses a cursor after role or ownership changes, or combines tenant-bounded roles to obtain network-wide access. An unrelated user attempts payment or shipment writes using a known ID.

**Controls implemented:** `api/src/services/resourcePolicy.ts` defines explicit relationships and distinct network grants; `api/src/modules/catalog/privateResources.ts`, `privatePayments.ts` and `api/src/modules/transport/privateShipmentDetail.ts` scope private hydration. `api/src/modules/catalog/paging.ts` binds bounded cursor reads to their context. Holding detail requires the current holder even when the actor has other domain-wide reads. Contract/payment writes use `api/src/modules/payments/locking.ts`; transport responsibilities are enforced in `api/src/modules/transport/responsibilities.ts`. Indirect evidence/provenance authorization must preserve the parent entity boundary.

**Regression sources:** `api/test/integration/sourceResourceBoundary.integration.test.ts`, `multiTenantApi.integration.test.ts`, `authorizationRoutes.integration.test.ts`, `transportResponsibilities.integration.test.ts`; unit policy/query tests adjacent to the modules above. The route register proves declared entry gates, not every foreign-ID/action combination.

**Residual risk and action:** historical/manual SQL and newly introduced routes can omit scope; a DB administrator or stolen DB credential bypasses application controls. SEC-006/QLT-002 must retain endpoint-by-endpoint acceptance; SEC-016 RLS is separate defense in depth, not a current promise. P1 application coverage, P2 RLS; engineering owner. Require paired foreign/absent denials, bounded additive-role tests and live revocation tests for each new private route. Do not convert all domain failures to 404 without reviewing the documented response convention.

### TM-03 — fraudulent provenance, certification and compliance claims

**Attack:** seller marks a declaration as reviewed, attaches expired/revoked/wrong-crop certificates, self-certifies, invents farm provenance for direct inventory, or treats coordinates as proof of legal compliance. Colluding certifier provides a genuine but false review.

**Controls implemented:** `api/src/modules/trust/assessment.ts` checks reviewer attribution, dates, scope, issuer/subject linkage and direct-inventory limitations; `certification.ts` and `writeReviews.ts` control certification/review writes. Public trust status derives from the authoritative assessment rather than a legacy attested flag. Missing/future/revoked/expired proof must not become reviewed. GPS alone is not an EUDR legal decision.

**Regression sources:** `api/test/integration/trustAccuracy.integration.test.ts`, `trustDefaultsMigration.integration.test.ts`; `api/src/modules/trust/assessment.test.ts`; `e2e/trustPresentation.spec.ts`.

**Residual risk and action:** valid-looking evidence may be false; software linkage cannot establish real farm ownership, physical origin, certifier accreditation or legal compliance. Pilot onboarding must name who verifies real-world claims and how revocation/disputes are handled; certification is optional to trade and absent assurance must remain visible. P1 business trust acceptance; founder/product owner with engineering. Obtain independent domain review before marketing verified/compliant claims beyond the recorded review scope.

### TM-04 — malicious evidence and resource exhaustion

**Attack:** user uploads executable/polyglot content with a benign filename, replays another entity's upload intent, downloads unreleased proof, floods concurrent uploads, exploits scanner/storage outages, or abuses filenames/object URLs. A clean file exploits a viewer or a document parser after download.

**Controls implemented:** `api/src/services/evidenceFilePolicy.ts` limits extension/MIME/signature combinations to PDF/JPEG/PNG; signature checks are file-type indicators, not structural or malware proof. `evidenceUploadService.ts`, `evidenceStorage.ts`, `evidenceMalwareScanner.ts` and `evidenceAvailability.ts` implement the upload/storage/scan/availability boundaries. `api/src/middleware/evidenceContent.ts` and `api/src/modules/security/evidenceConcurrency.ts` bound admission. Evidence is not served as an unrestricted static upload directory. Linked entity and payment document release remain mandatory in `api/src/controllers/evidenceController.ts` and `api/src/modules/payments/documentPolicy.ts`.

**Regression sources:** `api/test/integration/evidenceAvailability.integration.test.ts`, `evidenceTransferBudgets.integration.test.ts`, `evidenceSelection.integration.test.ts`, `multiTenantApi.integration.test.ts`; scanner/file/storage unit tests and the evidence stress runner. A stress pass covers its reported process/sampling/concurrency scope, not a container-wide or hosted capacity guarantee.

**Residual risk and action:** AV can miss new threats; PDF/image parsers and client viewers remain attack surfaces. Hosted private buckets, encryption/public-access blocking, production scanner settings/signature updates, retention and dependency/service-image review require configuration evidence (UPL-002, SEC-014). P0 storage/privacy before real data; P1 scanner operations/capacity; engineering and deployment operator. Never release documents when scan or storage availability is unknown. Content disarm is not currently claimed.

### TM-05 — payment-reference fraud and premature fulfillment

**Attack:** buyer submits a fabricated/reused transaction reference or another contract's proof; seller falsely confirms receipt; a caller skips agreed payment terms to dispatch, releases documents too early or races confirmation/settlement. The application might incorrectly be presented as escrow or bank assurance.

**Controls implemented:** `api/src/modules/payments/installments.ts` restricts submission to buyer and confirmation to seller, locks workflow state, rejects a reused reference within the same payment request and proof reused by another installment, checks exact-contract uploader/clean proof availability, and audits changes. This is not a global bank-reference uniqueness guarantee. `locking.ts`, `terms.ts`, `documentsAndSecurity.ts`, `documentPolicy.ts`, `api/src/services/tradeSettlement.ts` and `api/src/modules/trading/fulfillment.ts` implement agreement, document, dispatch and completion boundaries. Incoterm-selected transport responsibilities are distinct from receipt verification and payment protection.

**Regression sources:** `api/test/integration/paymentWorkflow.integration.test.ts`, `transportResponsibilities.integration.test.ts`, `cancellation.integration.test.ts`; `e2e/paymentPlans.spec.ts` and real trade journey tests. These establish workflow behavior, not external funds movement.

**Residual risk and action:** a reference or uploaded receipt does not prove cleared funds; counterparties can lie or collude, and bank security remains externally verified. Product/operator guidance must require checking the actual bank channel and never promise escrow, insurance or guaranteed payment without an integrated authorized provider. P1 pilot commercial policy; founder/product with finance/legal domain review. Future payment-provider callbacks require signature/replay checks, independently sourced amount/currency/beneficiary binding, reconciliation and explicit failure handling before being authoritative.

### TM-06 — recall suppression, overreach and unsafe stock release

**Attack:** unrelated actor triggers or resolves a recall, manager acknowledges for another recipient, recovery totals overflow physical quantity, proof from another recall is reused, a resolved recall hides retained holds, or graph/time limits produce an apparently complete safe result. A malicious related participant initiates a technically permitted but false recall to disrupt a competitor.

**Controls implemented:** `api/src/modules/recall/lifecycle.ts` checks seed relationships, loads bounded trace impact, installs safety holds and withdraws affected listings transactionally; `response.ts` binds acknowledgement/recovery to the real recipient/current holder, requires resolution reason and available clean exact-recall evidence, and accounts stock. `safety.ts` preserves blocks for returned/destroyed material even after resolution. `api/src/modules/trace/limits.ts` represents incomplete traversal explicitly. Recall notifications are queued rather than proof of delivery/acknowledgement.

**Regression sources:** `api/test/integration/recallSafety.integration.test.ts`, `recallResponse.integration.test.ts`, `recallResponsePages.integration.test.ts`, `publicNoticePages.integration.test.ts`; `e2e/recallSafety.spec.ts`, `e2e/recallResponseJourney.spec.ts`, `e2e/recallResponse.spec.ts`.

**Residual risk and action:** the platform cannot establish the truth of the initiating incident or physical destruction/return through arithmetic alone. Operator contact escalation, evidence review, response ownership and regulatory/local legal obligations require a pilot procedure. P1 safety operations; founder/operator with domain reviewer. An incomplete graph, failed summary or unavailable response is unknown, never a safe/clear result. Resolution must not silently restore disposed or still-held stock.

## Shared attack paths and deployment gaps

| Risk/action | Priority | Accountable role | Existing tracking and acceptance evidence required |
| --- | --- | --- | --- |
| Compromised secrets or storage infrastructure bypasses application policy | P0 | Deployment operator | SEC-012, UPL-002: environment-specific secret rotation, least privilege, bucket privacy/encryption and access evidence |
| Ingress/origin/client attribution differs from local test configuration | P1 | Engineering + operator | SEC-007/010/011: deployed origin, proxy boundary and abuse behavior verified without trusting arbitrary forwarded headers |
| Script/URL injection or malicious external destinations | P1 | Frontend engineering | SEC-008/009: restrictive deployed CSP and safe external-link/asset policy; Helmet alone is not acceptance |
| Dependency or scanner/service-image vulnerability | P1 | Engineering | SEC-014/SAF-005: current scan, approved exact exceptions, service-image provenance and immutable promotion evidence |
| Audit database compromise or missing abnormal-access detection | P1 | Operator | SEC-017/OPS-006: independent retention and abnormal authorization alerts; transactional audit is not immutable external retention |
| Insider privilege abuse and unreviewed security assumptions | P1 | Founder + independent reviewer | SAF-004, SEC-018/020, SAF-003: real privilege/recovery review, independent assessment and mapped release exceptions |
| New routes/mutations omit scope or race checks | P1 | Engineering | SEC-006, QLT-002, ARC-013: maintained route/resource/action tests and atomic audit/outbox acceptance |
| No safe disclosure/contact channel | P1 | Founder/operator | SEC-019: publish vulnerability-reporting policy with a working monitored private contact |

Risk acceptance must record scenario ID, affected environment/data, named accountable person, rationale, compensating controls, expiry/review date and verification evidence. This document does not accept any deployment risk on the founder's behalf. No blank exception or silent release-gate bypass counts as approval.

## Future logistics service marketplace boundary

Registered/verified provider discovery, quoting, selection and order fulfillment by third-party logistics firms are a planned product expansion, not implemented marketplace assurance in this model. Existing shipment roles/responsibilities do not establish provider vetting, insurance, verified real-world capacity or an integrated service marketplace.

Before enabling that expansion, model provider identity/vetting and revocation; service regions and country/corridor eligibility; fraudulent quotes and bank-detail substitution; buyer/seller authority to procure each Incoterm leg; explicit contract-bound provider assignment and revocation; least-privilege access to pickup/delivery/contact/document information; milestone spoofing and signed/replay-safe callbacks; subcontracting; transport disputes and liability; and provider fee/payment reconciliation. A selected provider must not inherit all buyer/seller commercial data or authority to verify receipt of funds. Cross-country rules need domain/legal review before claiming universal compliance. The owner is product/engineering with an actual logistics domain reviewer; acceptance is required before provider onboarding with real orders.

## Completion and maintenance contract

SEC-015 publication is complete when all six required scenario families, assets, trust boundaries, code/test evidence, residual risks, owners and follow-up acceptance are documented and links resolve. Code references are relative to repository root; test paths are regression sources rather than an execution report. This model contains no independent-review, hosted-pass or certification claim.

Revisit on new authentication/recovery methods; new resource/network permissions; public-field changes; payment-provider integration; scanner/storage changes; recall semantics; third-party provider onboarding; material incident; or pilot data/deployment change. Engineering updates this file with the policy/test change; founder/operator records environment-specific risk decisions separately. Review remaining gaps before admitting real customer data or expanding beyond the approved pilot scope.
