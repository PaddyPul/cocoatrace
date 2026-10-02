# Provider-independent staging preparation

Backlog: ENV-004–ENV-006, UPL-002, OPS-001–OPS-002, QLT-011. No live resources have been provisioned by this wave.

Use five separate environments: development on your PC, disposable automated tests, synthetic demo, isolated staging and customer production. The local demo Compose file is not a deployment manifest. Staging and production must have distinct databases, buckets, credentials and email configuration.

## Repository gates

Run `npm run verify:release` with Docker Desktop running. The runner executes unit tests, builds, migration checks, isolated migration/API/browser suites and a PostgreSQL recovery rehearsal. It stops on the first failure and records later gates as `not_run` in `release-test-results/summary.json`. Browser diagnostics remain in `browser-test-results/safe/`. A passed report verifies these repository gates, not provisioned infrastructure or every supported payment plan.

The prepayment trade browser journey checks real account onboarding, marketplace offer submission, supplier acceptance, partial stock availability, supplier payment terms, buyer confirmation/submission, seller receipt, dispatch rejection until verification, shared invoice upload/download, buyer-coordinated FOB transport, delivery, settlement, exact stock ownership and one platform fee. Other payment plans, documentary release policies and exceptional dispatch need separate tests.

## Before choosing hosting

The project owner supplies a monthly staging budget, desired domain and any existing provider accounts. Engineering can then propose a deployment architecture and region appropriate to the chosen services. Provisioning is a separate explicitly authorized step; this template does not create accounts, resources or charges.

The selected host must support:

- API and web containers, a private scanner service and a one-off migration job.
- Managed PostgreSQL with verified TLS, private access, backups and point-in-time recovery.
- Private S3-compatible object storage with AES256 server-side encryption, separate staging credentials and no public bucket access.
- Transactional SMTP with verified TLS, sender-domain authentication and real inbox testing.
- HTTPS, an environment secret manager, logs/alerts and immutable image releases.

The current adapter requires S3-compatible storage with the configured encryption behavior. Confirm compatibility before purchasing a service.

## Staging configuration

Use `.env.staging.example` as the key inventory. Populate the selected hosting platform's staging secrets; do not commit a populated `.env` file. Use separate random secrets for sessions and upload URLs. Set APP_VERSION to the release Git commit, disable demo controls, provision the bucket first, and keep database/scanner ports private. Use `VITE_DEMO_MODE=false` when building the web image.

Run `npm run check:staging` with those staging variables injected by the deployment platform. It reuses the API's typed configuration validation and additionally requires verified database TLS, enabled SMTP, separate signing secrets, preprovisioned storage and a release identifier. It does not check DNS, network isolation, bucket policy, live email or backup settings; those remain deployment checks. Running it from your unchanged local demo environment should fail.

## Deployment acceptance

1. Provision isolated staging resources and save infrastructure configuration and named ownership in the repo.
2. Run migrations through the normal migration command once; deploy the same immutable build whose release gates passed.
3. Verify HTTPS/session behavior, storage public-access denial, malware quarantine and real verification/invitation/reset/recall emails.
4. Perform a real managed-provider restore into a separate staging recovery database, verify restored evidence object bytes as well as metadata, and record timing/results.
5. Demonstrate rollback and alert routing before inviting design partners.

Local Docker recovery exercises cannot close managed-provider backup/PITR, object restoration or staging availability requirements. Retain those backlog items until deployment evidence exists.
