# Branded transactional email trust

BRD-005 · P1 · Phase0 · Implementation candidate; external acceptance open · Requested2026-10-23.

Problem: the existing identity templates in api/src/services/emailSender.ts introduce BetterTrade in plain text but primarily present raw action URLs. The shared sender can already carry optional HTML; renaming text alone does not provide a recognizable design or authenticated sender identity. The founder reports that the resulting messages look suspicious.

## Intended outcome

Recipients can identify who sent the email, why they received it, the relevant organization and what the action will do. Shared HTML/text presentation covers existing verification, first-admin/team invitation/resend, reset, reminder, recall, fee and operator messages. New lifecycle events remain PRD-008; this item does not imply they already exist. Preserve meaningful demo/staging identification rather than presenting test messages as production.

## Acceptance

- Use a consistent BetterTrade wordmark/header, accessible contrast, mobile layout, descriptive subject and action button. The message must remain understandable without images or HTML.
- Sender display name, actual sender address, reply/support address and visible destination hostname must be truthful. No fake verified badges or deliverability promises. Show relevant recipient/organization context without exposing unrelated parties or sensitive commercial detail.
- Escape user-controlled HTML and protect headers. Links use the approved environment HTTPS origin and descriptive labels; do not hide unrelated destinations behind brand text. Avoid shorteners and tracking redirects for credential-bearing links. Keep tokens out of logs, diagnostics, screenshot artifacts and analytics.
- Explain expiry, unexpected-request handling and available support without inventing response commitments. Preserve one-time/revoked/expired token checks, current authorization and retry/outbox semantics. SMTP submission remains distinct from inbox receipt.
- Capture and test both HTML and plain text for existing categories, including hostile names, missing optional fields and environment links. Check representative desktop/mobile inbox rendering and perform real inbox/link acceptance once a sender provider is connected.
- Authenticate an authorized sender domain using provider-supported SPF/DKIM/DMARC, and verify actual received headers/alignment before claiming authenticated delivery. Domain ownership and provider approval remain external dependencies; DNS records must be supplied by the chosen provider, not invented here.

No domain is currently owned and the budget remains USD0. Local templates and capture-inbox tests can be completed first; external authenticated brand delivery remains open until a valid sender arrangement exists. Coordinate BRD-004, IDN-021, PRD-008 and LNG-003. This backlog addition does not implement templates, configure providers or authorize billable infrastructure.

## 2026-10-23 candidate

The SMTP adapter now renders all seven existing categories through emailBranding.ts. It uses escaped source text, a branded From display name, optional validated EMAIL_SUPPORT_ADDRESS/Reply-To, HTML base64 MIME wrapping and original URL-bearing text fallback. Only standalone matching-origin noncredentialed URLs become buttons; arbitrary caller HTML is not trusted. Environment labels distinguish local/demo/staging from production. No fake support address or authenticated-sender badge is supplied. Existing token durations and backend authorization are unchanged.

Local rehearsal starts through npm run demo:rehearsal:start and captures messages at127.0.0.1:18026. See ../runbooks/LOCAL_INVESTOR_REHEARSAL.md. No external provider or domain is configured. Actual provider inbox and sender authentication acceptance remain open.
