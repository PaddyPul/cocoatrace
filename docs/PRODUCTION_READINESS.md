# BetterTrade production and pilot readiness

Updated 2026-10-06. This replaces older manual schema/import and public/local-upload advice. Current launch authority is [BETTERTRADE_PILOT_PLAN.md](BETTERTRADE_PILOT_PLAN.md) plus [pilot-gates.json](pilot-gates.json).

A release candidate requires `npm ci`, `npm run verify:release` and archived results on its exact commit. The release runner covers quality, types, dependency advisories, unit/build, migration integrity, container runtime/scanning, fresh/upgrade migrations, database/storage/scanner integration, browser journeys and recovery. Inspect the summary; not-run checks do not pass. Current language correction needs native acknowledgement. Local passing checks do not provision staging or authorize customer data.

Deploy reviewed immutable digests through environment-scoped secrets and protected approvals. Run the normal manifest-verified migration release job; never reapply schema.sql to an existing installation, modify frozen migrations, delete migration history to bypass validation or seed demo users into real environments. Maintain expand/contract compatibility and a tested rollback/compensation plan.

Real-data hosting requires HTTPS/exact origins, private DB networking, separate demo/test/staging/production identities and storage, private encrypted evidence/quarantine, operational malware scanning, least-privilege secrets, real email delivery, monitored workers and scoped audit retention. Private local storage is a local development option, not an automatic hosted-pilot recommendation. Prove database plus object-byte restoration, incident escalation and capacity before launch. Health endpoints are only one component of monitoring.

Provider-enabled launch additionally requires scoped provider verification, RFQs, atomic awards, accepted service orders, independent goods/service financial records and negative assigned-job permission tests. Every provider gate and every core gate must be closed. No public upload endpoint, synthetic temporary tunnel or successful image build substitutes for those controls.

USD 0/month remains binding. Verify actual free eligibility and capacity; do not promise a provider's current pricing or activate trials/overages. If a self-managed backup alternative is proposed, record a hosting ADR, accountable owner, encryption, RPO/RTO and actual recovery evidence before replacing the managed-PITR requirement. Until then the real-data pilot remains blocked.

Previous planning detail is retained in [the historical archive](archive/pre-bettertrade-2026-10-06/PRODUCTION_READINESS.md); its obsolete deployment/product assumptions do not apply.
