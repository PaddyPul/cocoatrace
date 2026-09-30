# Private evidence storage

Status: private storage and malware-scanning foundation implemented. Staging infrastructure and operational alerting remain required before a customer pilot.

Evidence objects are never publicly served. An authenticated, entity-authorized upload intent reserves organization quota and returns a 15-minute HMAC-signed API URL. Bytes enter an environment-specific quarantine key. Raw bytes are malware-scanned before parsing, then PDF/JPEG/PNG signatures must agree with the declared MIME type and filename extension before promotion. Infected and scan-failed uploads are deleted, audited and never receive an evidence record. Downloads require a persisted clean result in addition to the existing tenant and contract-release authorization rules.

Staging and production require an HTTPS S3-compatible endpoint, separate environment-named private buckets, AES-256 server-side encryption, independent credentials, and `EVIDENCE_STORAGE_AUTO_CREATE_BUCKET=false`. Enable bucket encryption, versioning, public-access blocking, lifecycle policies, and backups outside the application.

Configuration is documented in `.env.example`. Demo Docker Compose uses a private persistent volume through the local adapter; the integration suite uses Moto to exercise the S3 adapter. After migration 013 and storage startup, migrate existing local evidence with:

```bash
npm run evidence:migrate-legacy --workspace=api
```

The migration validates each legacy file, stores it under an opaque key, and updates PostgreSQL only after successful storage. It intentionally retains the old file for rollback. Remove old copies only after backup and download verification.

After migration 014, scan every pre-existing evidence record before downloads are re-enabled:

```bash
npm run evidence:scan-pending --workspace=api
```

The command exits unsuccessfully when a database record points to missing
object bytes. Treat that as an integrity error to reconcile; do not mark the
record clean or bypass download protection. Migration 015 removes three known
legacy demo placeholders that never had stored objects.

Staging and production must set `EVIDENCE_SCANNER_DRIVER=clamav` plus the private scanner host, port, timeout and retry values. Application readiness includes a scanner PING, so a deployment does not become ready while the scanner is unavailable. Demo Compose pins the official ClamAV 1.5.4 image and persists its signature database.

## Operational work still required

Provision the staging bucket and scanner, monitor signature age and scanner failures, alert on accumulated scan failures, and rehearse restoration before enabling customer uploads.
