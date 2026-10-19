# Critical-domain scenario coverage

Checked scenario and failure-branch inventory. Test existence is not test execution; attach exact-commit release results separately. No percentage is inferred.

Registered domains: 7; scenarios: 81. These counts are inventory, not pass rates.

## inventory

Accountable role: Engineering maintainer. Suite: api/test/integration/tradingIntegrity.integration.test.ts

- accepts a duplicate concurrent request exactly once and prepares exactly one fulfillment workspace
- serializes competing offers on the same listing without double-selling
- serializes competing legacy listings sharing one holding and caps the remaining listing stock
- keeps a sellable residual holding after partial acceptance and conserves decimal quantities
- keeps the unsold 6 kg visible in the marketplace after accepting 4 kg from a 10 kg listing
- creates no continuation listing when the advertised quantity is fully accepted
- reserves continuation stock ahead of legacy siblings and pending transfer reservations
- refuses expired offers, deactivated listings and foreign seller acceptance without allocating inventory
- does not allow rejection to rewrite an accepted offer
- requires seller explanation, records it once atomically and shows it only to the two parties
- rolls seller rejection back when its immutable audit cannot be inserted
- rolls back inventory, offer and every fulfillment record when a downstream insert fails
- atomically caps concurrent new listings at the unreserved holding quantity
- validates listing edits and denies oversupply and foreign ownership
- atomically caps concurrent holding allocation at the batch quantity
- does not mint committed or transferred stock again through batch publication
- serializes concurrent source allocation across holding creation and batch publication
- uses exact gram budgets when creating and editing fractional listings
- conserves exact fractional stock across allocations, transfer reservations and offer acceptance
- accepts a duplicate full custody transfer once without zero or duplicated holdings
- reserves pending custody transfers so a competing offer cannot consume their stock
- prevents splitting stock already reserved by a pending transfer while the transfer is accepted
- rejects cross-tenant transfers and conserves a legitimate split
- enforces database quantity, price and state constraints independently of the HTTP API
- enforces one contract per offer even when bypassing the application
- independently detects corrupted allocation while a valid accepted trade reconciles cleanly

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

## tenant

Accountable role: Engineering maintainer. Suite: api/test/integration/multiTenantApi.integration.test.ts

- persists organization attribution and audit records in PostgreSQL
- allows explicit network permissions without treating ordinary reads as global
- rejects certificates whose supplied farmer organization does not own the farm
- rejects attestation when certificate subject or crop scope does not match the batch
- blocks foreign provenance and contract splicing while preserving the related contract path
- authorizes evidence by linked resource and never returns internal storage paths
- rejects evidence attachment and listing across every supported foreign resource family
- does not expose a real stored object through an unauthenticated static route
- rejects signature-spoofed evidence and leaves no evidence item
- rejects executable types, extension spoofing and oversized declarations
- reserves tenant quota across pending upload intents
- rejects an EICAR test file, audits the infection and deletes quarantine bytes
- blocks downloads unless malware scan status is clean
- refreshes permissions and immediately enforces logout, user suspension and organization suspension
- returns the same forgot-password response without exposing account existence or raw reset tokens
- consumes reset tokens once and revokes every existing session
- changes a password while preserving the current session and revoking other sessions
- retries verification on the same application and invalidates the previous link
- creates one invitation, rotates on resend, enforces tenant isolation and cannot revive revocation
- approves once and submits the first-admin invitation without creating duplicate organizations

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

## evidence

Accountable role: Engineering maintainer. Suite: api/test/integration/evidenceAvailability.integration.test.ts

- payment submission checks provider metadata before holding any contract, payment, installment or proof lock
- receipt confirmation checks provider availability without locks and rejects proof revoked during that check
- document presentation performs no provider read under trade locks and rejects a changed document key
- delivery discrepancy checks provider metadata before locking and rejects newly infected proof
- unrelated organizations and wrong contract parties never trigger provider checks for private proof

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

## recall

Accountable role: Engineering maintainer. Suite: api/test/integration/recallSafety.integration.test.ts

- pages beyond the graph cap, searches before limiting and rejects foreign cursors without leaking lots
- includes recorded custody and trade access without duplicating a lot
- requires authentication, recall permission and an actual inventory relationship
- atomically places safety holds, withdraws supply and audits activation without changing quantities or ownership
- rolls back the notice, holds and listing withdrawal if the required audit cannot be written
- keeps overlapping recall holds until every active notice is resolved and never automatically relists
- blocks acceptance of pending offers and custody transfers, fresh transfers, splitting and batch republication
- guides newly created inventory through an accepted trade then refuses recalled dispatch even with a payment exception
- backfills existing active notices without altering inventory and leaves resolved historical notices unheld
- reports unsafe historical publication and missing holds without repairing or mutating them
- rejects cyclic analysis and activation without partial notices, holds or inventory changes
- does not load an unrelated oversized component and denies foreign seeds before analyzing them

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

## fees

Accountable role: Engineering maintainer. Suite: api/test/integration/feeEnforcement.integration.test.ts

- leaves historical trades unchanged, requires payer consent and verified receipts for newly enrolled dispatch
- grants bounded independent finance credit, rejects stale revisions and revokes the dispatch exception
- voids an unpaid consented fee on bilateral cancellation while preserving its accepted terms
- enforces the actual milestone HTTP boundary even with a goods-payment exception and preserves arrivals
- rolls back consent and invoice issuance when its critical audit cannot be recorded

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

## payment

Accountable role: Engineering maintainer. Suite: api/src/modules/payments/operations.test.ts

- retains useful payment context while removing secrets and arbitrary nested data
- handles legacy null and malformed metadata safely

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

## assurance

Accountable role: Engineering maintainer. Suite: api/test/integration/mfa.integration.test.ts

- restricts password-only privileged sessions but permits setup/status/logout
- passkey verification clears MFA restriction without granting organization administration
- rejects malformed input with a controlled 400
- consumes failed challenges and rotates outstanding challenges
- serializes concurrent registration replays into one key and one success
- requires a fresh signed assertion for writes and rejects counter replay
- cannot use a ceremony issued before account suspension
- password reset preserves keys and cannot create verified sessions
- forbids removing the last key or verified key and isolates ownership
- consumes reviewed recovery approval after replacement enrollment
- reviewed recovery needs distinct fresh reviewers, revokes sessions/keys and expires

Remaining: Hosted operation, adversarial combinations and independent review remain separate; this is a scenario inventory, not measured line/branch coverage.

Regenerate with npm run quality:report. Current execution evidence: release-test-results/summary.json and private/sanitized suite reports for the exact candidate commit. A missing/failed/skipped report does not establish a pass.
