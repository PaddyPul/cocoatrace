# Guided trade workspaces and automatic document submission

## Investor rehearsal changes

The login page and navigation describe a global sourcing workspace, rather than a Ghana–Netherlands corridor. Example journeys may still use those countries; this is not a claim that every country or material is supported for live regulated trade. Buyer and supplier are the customer demo shortcuts. Platform administration is a separate operator entry; it still owns access approval and platform fee receipt verification. No backend roles, historical accounts or permissions are deleted.

The sourcing structurer reads a material phrase from procurement grammar, including cocoyam and other crops outside the previous alias list. Known aliases remain canonicalized. Unknown material phrases are medium-confidence suggestions for review, not a guarantee of understanding arbitrary prose. Ambiguous descriptions still require manual completion; publishing and matching validations remain server enforced.

Restricted source records have an explanation rather than a bare Access denied message. Published claim summaries remain available where already authorized; private farm/batch records do not become public.

## Find the next action

Deal room and contract detail put the next action above the workspace tabs: Overview, Documents, Goods payment, Transport, Platform fee, Delivery and Activity. Document actions link directly to `/contracts/:id?tab=documents`. Payment protection links target the Goods payment tab. Inspect delivered goods opens Delivery directly.

The platform fee workspace has Payment action, Collection terms, Statement, Refunds & concerns, and History & email tabs. Its current collection status and responsible party remain above the tabs. A submitted fee reference means waiting for **platform admin receipt verification**, not fee payment verified. Goods payment remains separate from platform fees.

Tab changes keep mounted form state. Arrow keys, Home and End navigate tabs; tabs wrap at narrow widths. Leaving the page still uses the existing unsaved-change review.

## Documents: no presentation button required

The supplier uploads correctly typed commercial invoice, packing list and transport document. CIF/CIP also require insurance evidence. Other does not satisfy a specific required type. The checklist shows validated, clean, non-rejected supplier files and missing prerequisites.

The transport-document reference is the number printed on the transport document, not the uploaded file name or booking reference. The assigned transport coordinator can save this reference beside the document checklist. This uses the existing authorized arrangement PATCH and changes only the reference. Other transport details remain intact. A different party must use the assigned coordinator; authorization is not widened.

The **document_presentation** operations worker runs on startup and on a 15-second loop after each batch finishes. It scans up to 20 eligible requests per batch with a rotating cursor, so blocked files do not permanently starve later trades. No browser tab needs to remain open. A larger queue or slow storage may take longer than 15 seconds.

Automatic submission applies only to agreed deposit/balance, documentary collection and bank-secured plans. It requires physical handover/loading or a later milestone, a nonblank transport reference, accepted bank security where applicable, no active payment issue, and all required supplier documents. It reuses the existing storage-availability proof and locked transaction. Rejected, unclean, superseded, unavailable or wrong-owner files cannot satisfy that boundary. Cancelling a trade prevents submission.

In that transaction, only document-triggered installments become due, the presentation timestamp is recorded, and one `payment.documents.present` audit is written with `metadata.source=automatic_readiness`. Its actor user is null to identify system work; the seller organization remains attributed. Replays and concurrent workers cannot extend the original due date or duplicate the audit. The manual API remains for compatibility with existing clients and retains its seller authorization; the redesigned UI does not require it.

Automatic submission **does not** transfer money, verify a bank instrument, certify document authenticity, confirm goods receipt or settle the trade. The parties' agreed payment plan still determines the next step. A buyer can review accessible files and raise an existing payment dispute/concern from the goods-payment workspace. There is no new mandatory buyer document-approval gate in this release.

The open document workspace refreshes its status every five seconds while awaiting submission. Failed reads are visible. The worker retains a safe error code and check time on the payment request: missing usable files, unmet trade conditions, or retry pending. The checklist explains these states without exposing private storage keys or provider errors. Operations sees failed infrastructure runs through the existing job health and alert mechanism. Expected incomplete sets remain pending, not falsely submitted.

## Deployment, recovery and rollback

Migration **054_automatic_document_presentation.ts** adds two payment-request operational status columns, a partial unpresented-request index, the seventh operations job, and a narrowly constrained null audit-user allowance for automatic presentation events. It briefly locks the affected tables; the index is created transactionally. No secrets or environment flags are added. Allow seven dedicated operations lock sessions in addition to the normal request pool and the alert worker.

After migration and API restart, **existing eligible trades are processed too**. There is no destructive demo reset or file relabelling. Old manual presentation timestamps and deadlines stay intact. Missing transport references and incorrectly typed historical Other files still need correction by an authorized party.

For a stuck set: open Documents; correct listed requirements; inspect the last submission status; check `document_presentation` on Operations; inspect evidence storage if metadata shows ready but bytes cannot be verified. The worker retries from durable state after restart. Never mark a file clean, invent a reference, or mark an installment paid to bypass the boundary.

If reverting application code, stop the new worker and retain the migrated schema and audits. Automatic submission may already have made an agreed installment due; do not erase that history or silently roll its deadline back. Use the existing reviewed payment-issue workflow for compensation. Migration down refuses to remove the null-actor allowance once automatic audit records exist; use a forward correction instead. Before any automatic records exist, down restores the previous schema.

The web container serves the HTML entry with revalidation/no-store and hashed assets with immutable caching; missing asset paths return 404 instead of SPA HTML. An interrupted or stale lazy route chunk has a clear manual reload action. This reduces stale-entry failures; it cannot prevent an actual network change. In-progress actions are not automatically replayed by reload handling.

## Required acceptance

Author checks are recorded in the PR document. The exact candidate must still pass the full Windows release, including the native PostgreSQL/storage regression, real payment-plan journeys, migration checks, container build and synthetic preview. Then require GitHub CI before merging. Repeat a cocoyam buyer/supplier rehearsal through actual fee verification, bank security, automatic document submission, payment receipt, inspection and settlement. INV-003 remains IN PROGRESS until founder acceptance and its remaining fallback criteria are met.


## Zod advisory correction — 2026-10-23

The first Windows release stopped at GHSA-mrhx-c7xc-m3w5. The correction pins `zod` to patched **4.6.6**, updates the lockfile, record-schema API and sanitized issue mapping, and removes create defaults from optional sourcing edit fields. Existing saved requirements must not be reset during a partial edit. Regression tests verify oversized constrained collections are rejected before entries are traversed, sourcing origins return a bounded collection error, and enum/format/symbol-path errors stay sanitized. No dependency exception or gate suppression is introduced.

References: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 and https://zod.dev/v4/changelog . Apply the correction on the existing guided-workspaces branch, install from the committed lockfile with `npm ci`, capture the new candidate before verification, and run the whole release again. Do not reuse evidence from the earlier failed candidate or push until the exact new SHA passes. This correction adds no migration; migration 054 remains part of the underlying candidate.


## Browser journey correction — 2026-10-23

The initial full browser release found two real journeys that still assumed all controls were visible at once. The GHS/JPY completed-trade fee journey now opens `?tab=fees` both before and after settlement. The damaged-delivery journey opens `?tab=delivery` for buyer and supplier, preserving that tab through reloads. Their existing fee amount, receipt verification, custody, discrepancy resolution and final settlement assertions are unchanged.

Certificate detail tests use a read-only navigation helper for the observed `net::ERR_NETWORK_CHANGED` failure. It retries the same local page navigation once, logs a fixed message without the URL, and propagates a second failure. It never retries test actions, API mutations, assertion failures, timeouts or other network errors. HTTP error responses are returned unchanged for the test to assess. Whole-test retries stay disabled. The helper is deliberately scoped to the certificate detail suite; it is not a claim that host-network instability is eliminated.

Apply this follow-up after the Zod correction on the existing guided-workspaces branch and capture a new candidate before rerunning the full release. No new migration, application runtime change or dependency change is introduced. Native PostgreSQL journeys still require the Windows full-release gate; mocked tab regressions do not substitute for them.


## Body-parser advisory correction — 2026-10-23

The subsequent release stopped at GHSA-27r3-jxmh-p828 in Express's transitive body-parser 1.20.8. Update the lockfile to patched 1.20.9 within Express 4.22.3's existing compatible range. The package manifests, parser options, limits, routes and migrations are unchanged. No exception or audit suppression is added. Reference: https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828 .

Author clean npm ci, production and full dependency gates (no accepted findings), all 1,671 API unit cases and API build pass. These include existing ingress limit and error-envelope tests; no new exploit reproduction is claimed. Apply this follow-up after the browser-journey correction, run npm ci, capture the updated candidate before verification and repeat the full release. Previous candidate evidence must not authorize pushing this new SHA. SEC-014 and INV-003 remain IN PROGRESS.
