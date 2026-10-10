# Complete, bounded provenance packs

Both `GET /provenance/batches/:batchId` and `GET /provenance/batches/:batchId/export?format=json` now use one bounded snapshot builder. The view keeps its existing report shape; export adds the existing export type, version and generated-by attribution. Neither endpoint paginates or silently truncates a report.

## Authorization

The view retains `batch.read` route permission and its separate explicit `provenance.read.network` scope. Export retains `provenance.export` and separate explicit `provenance.export.network` scope. `*` remains the existing explicit network override. A read-network grant does not grant export-network scope, and an export-network grant does not grant read-network scope.

Without the relevant network grant, the same existing batch relationship policy runs inside the repeatable-read snapshot used to build the pack. Optional `contractId` must identify a contract for this batch and, without the relevant network grant, the caller must be buyer or seller of that exact contract. A farm/batch relationship cannot splice another party's contract into a report. Authentication, suspension checks and privileged-account assurance remain unchanged.

No additional tenant data is made public. Evidence remains a metadata-only projection without private storage paths, keys, signed URLs or upload tokens. Its safe validation and malware-scan status fields are now included so the report explains evidence eligibility. Generated-by email remains export-only, as before; view responses do not add it.

## Completeness and authoritative trust

The shared builder uses the existing `assessBatchTrust` rules and required certificate, attestation, reviewer and selected-plot facts within the same snapshot. It loads only plots selected by the batch and belonging to the batch's farm. Geographic flags alone still do not establish independently reviewed EUDR compliance.

Certificate PDF and weighing-ticket metadata increase completeness only when validation status is `validated` and malware-scan status is `clean`. Invalid, infected, failed-scan and legacy-unscanned records remain visible as metadata, but cannot increase completeness. This intentionally corrects the old view/export behavior that counted file types without checking eligibility. Both view and export now agree.

## Bounds and failure behavior

- Maximum 1,000 selected farm plots, batch evidence records, relevant trust reviews, and shipment milestones per collection.
- The current report shape allows one optional contract and one shipment. Multiple matching shipments fail explicitly rather than selecting an arbitrary incomplete shipment.
- Maximum complete serialized JSON payload: 4 MiB.
- Repeatable-read/read-only snapshot, existing 2-second statement timeout, and existing 5-second total catalog-read deadline.

Each collection selects only bounded IDs first. PostgreSQL calculates projected serialized bytes before returning potentially large metadata to Node. The report has a shared conservative byte budget including a small envelope allowance, and final UTF-8 JSON is checked again. A report close to the size limit may be conservatively rejected; no truncated success report is produced.

HTTP 422 `PROVENANCE_READ_LIMIT` for the view or `PROVENANCE_EXPORT_LIMIT` for export means the complete pack is too large; arrange an operator-assisted scoped report. HTTP 503 `CATALOG_READ_TIMEOUT` identifies the shared snapshot deadline. Unverifiable collection size or snapshot shape produces `PROVENANCE_EXPORT_UNAVAILABLE`. None of these failures generates an attachment. Missing batches remain 404 and authorization failures remain 403.

Downloads retain the JSON filename and payload keys; shipment milestones now have deterministic chronological order with ID tie-breaks. View and download use `Cache-Control: no-store`.

## Durable attribution and rollout

Before any successful download bytes are sent, export awaits an audit insert with actor IDs, the batch UUID, required state hash, and only contract ID/byte-count metadata. Failed exports do not claim successful download attribution, and attribution-write failure prevents a file response. View reads do not create export audit events.

No migration, new dependency, environment variable or permission widening is required. The former duplicate view and export builders have been removed; future changes to trust/completeness should use this shared builder.

Local validation: 14 new targeted unit tests passed, API types passed, and the native test definitions compile under strict TypeScript. The root integration validates full workspace quality/build checks. Eight native cases cover authoritative reviewed/revoked trust parity, view/export authority separation and two forms of contract splicing, invalid/infected evidence completeness, evidence collection overflow, milestone overflow, byte overflow and durable export attribution. Native fixtures use distinct buyer/private-seller accounts so authority tests do not accidentally acquire batch relationships.

Docker/PostgreSQL execution is pending the founder's exact-candidate release run. A compiling native test is not evidence of a real PostgreSQL run. Run `npm run verify:release`, verify that its passing report matches the current commit, and require CI before push/merge.
