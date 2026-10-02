# Bootstrap hosting plan: USD 0/month

Decision status: proposed; no cloud account or infrastructure has been provisioned.
Founder constraint recorded 2026-10-02: no hosting budget and no expectation of DevOps expertise.

## Recommended sequence

1. Finish the automated local release gates. Existing Docker test environments remain isolated from application data.
2. Build a temporary, supervised demonstration using synthetic data on the founder's existing machine. A Cloudflare Quick Tunnel can supply a temporary HTTPS URL without buying a domain or opening router ports. The machine must remain running; the URL changes on restart and has no uptime guarantee. This is a preview, not completion of staging or production readiness.
3. Investigate Oracle Always Free compute for persistent staging, conditional on account eligibility, available capacity and resources sufficient for API, database and malware scanner. Signup can require phone/card verification; do not upgrade to Pay As You Go or depend on trial credits. Exact available quota must be verified in the actual account, not inferred from old tutorials. No promised deployment until capacity is allocated.
4. Implement provider configuration only after capacity is confirmed: reproducible provisioning, HTTPS, private database/scanner connections, secrets, compatible encrypted private evidence storage, transactional email, health checks and backup/restore automation. Validate image architecture and all storage API/encryption operations against that provider.
5. Repeat automated release checks and a hosted restore exercise. Publish access details only after the deployment-specific security checks pass. Production stays a separate deployment and decision.

The implementation agent prepares configuration and automation. The founder performs account signup, verification and any required secure account-access handoff. Never paste passwords, cloud keys or SMTP secrets into chat or commit them. No paid resource is authorized by this plan. If free capacity is unavailable, retain the local preview and record the blocker.

## Why not simply put every service on a free tier?

Render free PostgreSQL expires after 30 days; free web services have no persistent disks and block SMTP ports 25, 465 and 587. That conflicts with the current email implementation and a durable database. Free-tier services that sleep or omit sufficient scanner resources must not be compensated by disabling malware scanning or exposing evidence publicly.

A hosted VM also needs an evidence-store and email design: free compute alone does not close those dependencies. Managed storage with metered overages and trial-only offers are not approved substitutes for a fixed zero budget. Budget alerts are not hard spending caps.

## Tracked implementation work

- [-] **BST-001 · P1 · Phase 1:** IMPLEMENTED; founder verified allowed-email PIN access on 2026-10-02, unlisted-visitor check remains open: [`ZERO_COST_DEMO_PREVIEW.md`](ZERO_COST_DEMO_PREVIEW.md) implements a synthetic-data HTTPS preview with demo-only credentials, public URL configuration, tenant-safe uploads and start/stop instructions; automated external smoke check. Do not expose the current desktop app with real customer data.
- [ ] **BST-002 · P1 · Phase 1:** Verify actual Always Free eligibility, capacity, architecture, email/storage compatibility and spending boundaries. Completion: recorded provider decision under DEC-001, or explicit unavailability blocker.
- [ ] **BST-003 · P1 · Phase 1:** Prepare reproducible zero-cost staging deployment and secret handoff; preserve ENV-004–006, UPL-002 and OPS-002 requirements. Completion: isolated live environment, hosted tests, private evidence proof and restore report. Do not mark complete from local Docker tests.

These three IDs form part of the delivery backlog and must be included in progress counts. Currency and language work is tracked under CUR-001–005 and LNG-001–005 in DELIVERY_BACKLOG.md.

## Official sources checked 2026-10-02

- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- https://render.com/docs/free
- https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports
- https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm
- https://www.oracle.com/africa/cloud/free/faq/

Free-tier policies can change. Recheck before provisioning. Neither an existing computer nor a free cloud plan supplies a guaranteed always-on, production-grade service.
