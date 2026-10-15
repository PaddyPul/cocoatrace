# Pilot workspace productivity

Reviewed 2026-10-15. This batch targets PRD-002/005/009/012. It adds no funds custody, logistics-provider verification, translation-completeness or hosted-readiness claim.

## Reopen a saved sourcing brief

From the marketplace sourcing selector, choose a brief and use **Edit selected brief**. The canonical edit URL is `/source/new?request=<id>`. The editor loads exactly that tenant-owned brief using the paged API with `mine=true`; a missing, failed or terminal record never becomes a new editable sample. Draft/open briefs may be edited. Closed, awarded and cancelled records are not reopened through this operation.

Review title, commodity, quantity, origins, delivery terms, dates, quality and assurance fields. Save updates the same record and routes matching back to `/marketplace?request=<id>`. Private drafts return to the buyer workspace. Unrepresented quality/assurance keys are retained when the editor changes the fields it understands; user text is not replaced by the structuring assistant. Selecting a different page or searching is not an edit. Clearing dates writes null. Quantities must fit the existing three-decimal database representation; no database migration is needed.

PATCH requires current `offer.create` permission, exact owner organization, mutable status and validated fields. Business update and attribution audit commit together. The audit records changed field names, not the confidential requirement values. Saved sourcing changes do not rewrite existing offers, accepted contract terms or in-flight delivery responsibilities. Concurrent editors should review the record before saving; this batch does not introduce a multi-editor merge system.

## Focus on actionable or overdue work

The buyer/supplier trade action centre provides **All**, **Action required** and **Overdue payments** filters over all successfully loaded authoritative next actions, rather than a four-card preview. Filter choice survives same-page focus refresh. A filtered miss is distinct from an unavailable action feed or absence of active trades.

`requiresAction` remains the server policy's actor-specific decision. Overdue means the recorded installment is still due and its durable `due_at` has passed according to the server clock. Submitted payments await seller verification and are not presented as overdue buyer work. Missing/invalid deadlines, future triggers and safety holds do not invent a deadline. Sellers can see waiting overdue payment without receiving the buyer's submit authority. Dispatch, safety and payment gates remain unchanged.

The existing next-action endpoint remains bounded/fail-explicit. This is not an SLO, distributed scheduler, reminder configuration or deadline for every transport task.

## Read deal activity

Open **Show recorded activity** in the guided deal room or contract detail. It loads at most 25 selected events per page, newest first; the server accepts at most 50. **Older activity** advances the scoped cursor; **Refresh activity** returns to the latest page. A failed/malformed response shows an explicit retry state and never claims an empty history.

GET `/contracts/:id/activity/page` requires `contract.read` and current buyer/seller organization membership in the contract, including on every cursor request. Network/read-all authority is not a customer-party bypass. Foreign and absent contracts share 404. Cursor context is bound to the organization and contract; it is not an authorization credential.

The projection is an allowlist of payment terms/submission/receipt/documents/security, transport, delivery and cancellation event types. It returns only event ID, fixed label, timestamp and buyer/seller/platform attribution. Raw audit metadata, hashes, user names/IDs, bank references, confidential reasons and unrelated administrative events are never returned. Existing legacy events or event families outside the allowlist can be absent. This is a customer activity view, not the administrative audit register or independent verification of payment/delivery. No missing events are synthesized.

## Identify the workspace environment

A persistent English/French notice on public and signed-in routes reads the server's existing public liveness environment using a bounded, credential-free, no-cache request. Demo, test, development and staging are clearly marked as testing; production is identified without a safety guarantee. Failure, malformed or unknown response remains **Environment unconfirmed** instead of guessing from localhost, branding or a stale build flag.

The existing supervised synthetic-preview warning remains. An environment label does not prove data is synthetic or resources isolated. Confirm the selected environment and follow the ingress runbook before hosted use. `APP_ENV` remains authoritative; changing a banner does not change data or credentials.

## Verification and limits

API unit/policy tests, database-free HTTP/transport tests, types and builds run on the author host. Native `workspaceProductivity.integration.test.ts` covers history pagination/metadata exclusion/current-party checks and attributable sourcing edits/foreign-terminal denial; browser definitions cover edit/reload, both persona filters, history failure/retry and environment notices. Strict compilation is not runtime acceptance. The founder's exact-commit full release and required CI must pass before merging this candidate. No extra manual persona checklist or real customer operation is requested.
