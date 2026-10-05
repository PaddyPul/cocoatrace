# Bilateral unstarted cancellation

Scope: LOG-006 / TRD-017. A cancellation is a commercial agreement between the buyer and supplier, not a platform refund. Both members need contract access and offer creation or response permission. Another member of the requesting organization cannot approve its own request.

## Flow

In the guided deal room or contract detail, explain the reason and request cancellation. The other organization sees a dashboard review action. It can reject (keep the trade open) or approve. A pending request does not freeze payment or transport; approval rechecks the live state. If activity has begun, reject or resolve the request and follow the existing trade/payment/delivery process.

Approval is allowed only with pristine planning transport, no historical submitted/verified payment or external security, no active payment/delivery issue or delivery acceptance, no issued/paid fee, and the exact seller-owned committed inventory without competing activity. Recall safety is checked before release. Booking, external provider references and dispatch history count as transport activity. Submitted payment references still count even after rejection.

Approval atomically cancels the contract and unused payment installments, locks document release, voids only the estimated fee and makes the exact committed holding available. Quantities, accepted-offer history, documents and ownership history are retained. It does not publish a listing; the supplier must explicitly review and relist the released stock. Existing available remainder stock is unchanged. Repeated review returns the same decision without a second release or audit. Critical audit failure rolls back the entire operation.

Cancelled deals show an archive state rather than payment/dispatch prompts. Old browser tabs and direct API requests cannot submit payment, change payment terms or progress cancelled transport. Read-only members can inspect history but cannot request or decide cancellation.

## API

- GET /contracts/:id/cancellation: scoped status, blocker and request history.
- POST /contracts/:id/cancellation: reason, 10–2000 characters.
- POST /contracts/:id/cancellation/:requestId/approve or /reject: other organization decision.

Routes require authentication, contract.read and commercial permissions on writes. Invalid identifiers/input return 400, commercial permission/self-review denial 403, missing/unrelated contracts 404, unsafe or conflicting transitions 409.

## Deployment and recovery

Migration 028 is additive with one pending request per contract, cross-organization reviewer checks and retained history. Startup runs registered migrations. Do not edit frozen migrations or reset volumes. Once any cancellation request exists, the down migration refuses to delete history. Use a forward correction; never restore an older application that might act on cancelled stock without closed-state guards. If release verification fails, stop before public rollout and retain the database/history for diagnosis.

Paid cancellation, refunds, partial settlement, returns, fee credits/tax rules, administrator arbitration and outbound cancellation notifications are separate open work. No claim of escrow or automated funds transfer is made.

## Verification

23 policy/transaction unit regressions plus dashboard coverage; eleven PostgreSQL API cases including approval/payment races and reader denial; one real browser request/approval/archive/stock journey. Run npm run verify:release on native Docker before merge. Supplemental single-connection PostgreSQL checks do not prove lock/concurrency behavior.
