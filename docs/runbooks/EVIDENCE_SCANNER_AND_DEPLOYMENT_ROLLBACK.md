# Evidence scanner incident and deployment rollback runbook

**Scope:** Staging and production evidence scanning, quarantine-state diagnosis and safe application rollback.  
**Owner:** Assign the pilot incident owner before staging customer uploads are enabled.  
**Related controls:** UPL-002, UPL-007, UPL-009, OPS-006, OPS-008, OPS-009.  
**Last reviewed:** 2026-09-30

This runbook does not make the current deployment production-ready. It becomes operational only after environment-specific storage, scanner, monitoring, deployment and database-recovery procedures have named owners and tested credentials.

## Safety rules

- Treat any scanner outage as **fail closed**. Do not mark an object clean manually, bypass the download gate or switch a deployed environment to the development scanner.
- Do not restore infected bytes to evidence storage.
- Do not delete or rewrite evidence metadata to make a dashboard green. Preserve the intent, audit record and failure reason.
- Do not run migration `down` functions against customer data during an ordinary rollback. Prefer the previous immutable application image when it is compatible with the forward schema; otherwise ship a forward fix or restore the explicitly approved pre-release database recovery point.
- Never run demo reset or seed commands in staging or production.

## Signals and initial severity

| Signal | Default severity | Immediate interpretation |
| --- | --- | --- |
| `/health/live` fails | Critical | Application process or routing is unavailable. |
| `/health/live` passes and `/health/ready` returns `503` | High | Database, evidence storage or malware scanner is unavailable; remove the release from traffic. |
| Any `evidence.scan.infected` event | High | One upload was correctly rejected; investigate the uploader and related activity. This is not automatically a scanner outage. |
| Any `evidence.scan.failed` event or `EVIDENCE_SCAN_UNAVAILABLE` response | High | Scanner request failed; uploads are unavailable and must remain blocked. |
| Upload intents remain `uploading` or `scanning` for more than 30 minutes | High | Processing was interrupted or an instance failed mid-request. |
| `legacy_unscanned` or `scan_failed` evidence items exist | High | Downloads remain locked until a successful rescan or an integrity decision. |
| ClamAV signature age exceeds the threshold agreed for the pilot | High | Scanning may be operational but stale; pause uploads until signatures update successfully. |

Use a lower environment-specific alert threshold only after it is documented in the pilot SLO. During the first pilot, alert on the first scan failure and on any stuck intent.

## Triage a scanner outage

1. Declare an incident, record the environment, deployed Git SHA, first observed time and incident owner.
2. Pause the rollout. If readiness is failing, keep the affected API instance out of traffic. Do not disable the readiness dependency.
3. Confirm the two health signals from the protected operator network:

   ```bash
   curl --fail-with-body https://API_HOST/health/live
   curl --fail-with-body https://API_HOST/health/ready
   ```

4. Check scanner service health, restart count, resource exhaustion and network policy using the hosting provider's supported tooling. Confirm the application is targeting the private scanner host and expected port. Do not print credentials.
5. Check ClamAV update logs and signature timestamp. A scanner that answers `PING` with stale definitions is still an incident.
6. Search centralized logs for `evidence.scan.failed`, `EVIDENCE_SCAN_UNAVAILABLE`, storage errors and the affected upload-intent IDs. Preserve correlation/request IDs.
7. Query state counts using read-only credentials:

   ```sql
   SELECT status, malware_scan_status, COUNT(*)
   FROM evidence_upload_intents
   GROUP BY status, malware_scan_status
   ORDER BY status, malware_scan_status;

   SELECT id, uploader_organization_id, status, malware_scan_status,
          created_at, updated_at, expires_at
   FROM evidence_upload_intents
   WHERE status IN ('uploading', 'scanning', 'scan_failed')
      OR (status = 'pending' AND expires_at <= NOW())
   ORDER BY updated_at;

   SELECT malware_scan_status, COUNT(*)
   FROM evidence_items
   GROUP BY malware_scan_status
   ORDER BY malware_scan_status;
   ```

8. If storage is also failing, treat this as a combined dependency incident. Verify the private bucket and encryption/public-access controls before resuming; do not redirect production to a demo/local bucket.

## Recover scanning safely

1. Restore the scanner and update signatures through the normal managed service/image process.
2. Verify `/health/ready` is healthy on an out-of-traffic instance.
3. Run a clean PDF/JPEG/PNG smoke upload against a staging record and verify the resulting evidence item is `clean` and downloadable only by an authorized user.
4. Run the EICAR integration test in the isolated test harness. Do not create or upload EICAR from an operator workstation when endpoint protection blocks it.
5. For **pre-existing evidence items** in `legacy_unscanned` or `scan_failed`, execute the supported scanner job once from the release environment:

   ```bash
   npm run evidence:scan-pending --workspace=api
   ```

   The command must finish with zero failed records. A missing stored object is an integrity incident, not permission to mark the row clean.
6. Do not retry failed upload-intent URLs. Scan failures delete quarantine bytes and the signed URL is single-purpose. Ask the user to create a new upload intent and upload the original file again after service recovery.
7. Re-run the read-only state queries. Re-enable uploads only when readiness passes, signatures are current, no unexpected stuck intents remain and a named incident owner approves recovery.
8. Record cause, duration, affected organizations/intents, rejected infections, customer communication and follow-up backlog IDs.

## Quarantine backlog reconciliation

The application normally removes quarantine bytes after validation, infection, scan failure or stale-processing cleanup. Database rows are the investigation index; object-store inventory is the byte-level source of truth.

1. Export the read-only list of nonterminal/stale intent IDs and `quarantine_object_key` values to an access-controlled incident attachment.
2. Inventory the environment's `quarantine/<environment>/` prefix using the provider's read-only listing mechanism.
3. Classify every object:

   - active intent inside its expiry/processing window: leave it untouched;
   - infected or scan-failed intent: bytes should already be absent; unexpected bytes require incident-owner review and controlled deletion;
   - expired or stale intent: allow the application cleanup path to reconcile it first;
   - object with no database intent: treat as an orphan and investigate before deletion.

4. Never bulk-delete the quarantine prefix. Retain the before/after inventory and approval record for any controlled deletion.
5. If the backlog cannot be reconciled confidently, keep uploads paused and escalate to the storage and security owners.

## Deployment rollback

### Rollback decision

Rollback when the new release causes failing readiness, elevated errors, broken critical customer paths, evidence-control regression or an unsafe data mutation. Prefer a forward fix only when it is lower risk and can be verified within the incident objective.

### Application rollback procedure

1. Freeze further deployments and record the current and previous immutable image digests/Git SHAs.
2. Stop traffic promotion to the new release. Preserve logs and the release-time database snapshot/restore-point reference.
3. Determine database compatibility:

   - if migrations were additive and the previous application is compatible, redeploy the **previous tested immutable image** without running migrations down;
   - if the previous application is not compatible, do not guess. Choose a reviewed forward migration/fix or restore the approved pre-release database recovery point under the database incident procedure.

4. Deploy the selected image through the normal platform release mechanism with the same environment-scoped secrets and service identities.
5. Verify:

   ```bash
   curl --fail-with-body https://API_HOST/health/live
   curl --fail-with-body https://API_HOST/health/ready
   ```

6. Run the staging/production smoke checklist: sign in with an attributable test account, load the guided workspace, read an authorized record, verify an unauthorized tenant cannot read it, create an upload intent, upload a clean test document and download it through the protected endpoint.
7. Confirm centralized errors, database connections, scanner health and quarantine state have returned to baseline before restoring full traffic.
8. Record who approved the rollback, exact image/database action, timestamps, validation evidence and customer impact. Open follow-up items; do not close the incident solely because traffic recovered.

## Evidence to retain

- Incident reference and named owner
- Environment and Git/image identifiers
- Health/readiness and scanner-signature evidence
- Relevant request/correlation IDs and sanitized logs
- Intent/evidence state counts before and after recovery
- Object-store reconciliation record, without exposing object credentials
- Rollback approval and smoke-test result
- Customer notification decision
- Root cause and linked backlog items

