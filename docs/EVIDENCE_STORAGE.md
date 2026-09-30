# Private evidence storage

Status: private storage foundation implemented; malware scanning remains required before a customer pilot.

Evidence objects are never publicly served. An authenticated, entity-authorized upload intent reserves organization quota and returns a 15-minute HMAC-signed API URL. Bytes enter an environment-specific quarantine key, and PDF/JPEG/PNG signatures must agree with the declared MIME type and filename extension before the object is promoted. Database records are created only after promotion. Downloads remain behind the existing tenant and contract-release authorization rules.

Staging and production require an HTTPS S3-compatible endpoint, separate environment-named private buckets, AES-256 server-side encryption, independent credentials, and `EVIDENCE_STORAGE_AUTO_CREATE_BUCKET=false`. Enable bucket encryption, versioning, public-access blocking, lifecycle policies, and backups outside the application.

Configuration is documented in `.env.example`. Demo Docker Compose uses a private persistent volume through the local adapter; the integration suite uses Moto to exercise the S3 adapter. After migration 013 and storage startup, migrate existing local evidence with:

```bash
npm run evidence:migrate-legacy --workspace=api
```

The migration validates each legacy file, stores it under an opaque key, and updates PostgreSQL only after successful storage. It intentionally retains the old file for rollback. Remove old copies only after backup and download verification.

## Remaining release blocker

Add malware scanning between quarantine and promotion. Signature validation prevents basic spoofing but does not establish that a structurally valid PDF or image is safe.
