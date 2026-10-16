# BetterTrade customer identity and compatibility v1

Reviewed 2026-10-16. Customer-facing product name: **BetterTrade**. This is a presentation change, not a legal-entity, domain, infrastructure or data migration. BRD-001/002 target acceptance; BRD-003 internal migrations and BRD-004 name/domain/legal approval remain open.

## What changes

The browser title/metadata, access shell, sidebar, onboarding, customer pages and current identity/payment-reminder/recall email templates use BetterTrade. English/French navigation catalogs retain the same proper product name. Sourcing copy distinguishes recorded evidence from independently reviewed claims; ordinary workspace admission is not transport qualification or certification. Existing messages/evidence/audits are historical records and are not rewritten.

A trade agreement page describes the actual platform record and agreed commercial terms. **Unsigned platform record** means this record does not capture signatures and is not itself a signed contract document. It does not assert that the commercial terms have no legal effect. Legal effect depends on applicable terms and law; uploaded files and external agreements remain separate evidence. This change adds no electronic-signature or legal-review service.

## Compatibility map

The machine-readable inventory is [compatibility-v1.json](compatibility-v1.json). `npm run check:branding` checks 23 source anchors and the customer presentation surfaces; release and CI require this check before API/infrastructure acceptance. The guard detects accidental identifier replacement; it does not prove that a provider has preserved a real environment.

| Boundary | Retained identity | Why |
| --- | --- | --- |
| Primary database and volumes | `cocoatrace`, `cocoatrace_pgdata`, `cocoatrace_evidence`, `cocoatrace_clamav_signatures` | Prevent new empty databases, lost evidence pointers and scanner-cache replacement. Compose's actual volume names also depend on its project. |
| Synthetic preview | `cocoatrace-demo-preview`, `cocoatrace_demo_preview` and existing synthetic account addresses | Retain isolated disposable data and the reviewed preview runner. |
| Sessions | `ct_session`, issuer `cocoatrace-api`, audience `cocoatrace` | Existing sessions stay valid; a display rename must not silently log everyone out or weaken credential validation. |
| Passkeys | Existing configured browser origin/hostname RP ID | Existing keys remain bound to the same origin. RP display name already says BetterTrade; no hostname or credential migration occurs. |
| Browser preferences | `ct_user`, `ct_token` cleanup, `ct_language_v1:*`, `ct_experience_mode:*`, `ct_shortlisted_listings:*`, `ct_active_sourcing_request`, `ct_guided_fresh_start` | Preserve per-account preferences, setup and established identity cleanup. A saved ID is not authority; normal server ownership still applies. |
| Private evidence | `api/private-evidence`, `evidence/<environment>/<uuid>`, existing bucket configuration and database storage pointers | No object movement or mass database rewrite. |
| Links and routes | `/api`, `/contracts/:id`, `/p/:slug`, existing invite/reset URLs and API routes | Retain bookmarks, public QR links, pending invitations and password reset links. |
| Packages and images | root `cocoatrace`; existing `api`/`web` workspaces; `cocoatrace-api:security`, `cocoatrace-web:security` and scan cache | Existing npm/Compose/release commands continue to work. Terminal package banners can still say cocoatrace. |
| Exported files | `contract-*.json`, `cocoatrace-deal-*-log.json`, `cocoatrace-fee-reconciliation.json` | Preserve customer download and downstream import workflows; presentation labels use agreement wording. |
| Repository and sender domains | `https://github.com/PaddyPul/cocoatrace`; existing configured `EMAIL_FROM`/SMTP identity | Keep remotes, CI links and authenticated senders. No BetterTrade domain ownership, trademark or email authentication is asserted. |
| Frozen schema/migrations | Existing baseline and registered migration digests | No old migration is edited. Normal migration integrity, upgrade and backup/restore gates remain required. |

Do not rename the checkout folder, set a new `COMPOSE_PROJECT_NAME`, change `docker compose -p`, replace a database URL or point at a new bucket as part of applying this bundle. A different implicit Compose project can create new volumes despite unchanged YAML volume keys. Continue using the existing directory and exact Compose command. Never use `down -v`, reset, seed or delete data to make a renamed application appear healthy.

For read-only investigation of the actual local Compose project, inspect the `com.docker.compose.project` label on the existing API container. Do not paste complete container configuration/environment dumps; they can contain secrets. The default stack's published development ports remain unsuitable for public hosting.

## Acceptance evidence

- Five compatibility guard tests include wrong cookie/volume, stale public copy, missing/invalid inventory and current source inventory. The guard is source evidence, not runtime recovery proof.
- Captured identity email tests check new subjects while recipients, delivery categories and configured-origin token URLs remain unchanged; no real email is sent by author checks.
- Buyer/supplier × English/French browser definitions check brand, existing cookie name/HttpOnly flag, per-account preference storage, navigation, trade record and reload. These mocked UI tests do not replace real server credential validation or prove all trade copy is translated.
- Existing real identity, passkey, tenant/trade and private-evidence suites remain required by the full release. `authBoundary.integration.test.ts` tests the established cookie/session origin boundary. Frozen migration/fresh-upgrade gates and `scripts/run-recovery-tests.mjs` still rehearse schema/data-preserving recovery; they are not skipped by branding acceptance.
- The exact candidate must pass the full release and required CI before merge. No extra manual persona checklist, real-data migration or hosted operation is requested. Record the passing SHA/date and CI link when available. Author type/build/unit checks are not a browser/Docker pass.

The renamed UI does not establish a legal entity, public domain availability, production isolation, complete French workflows, logistics-provider marketplace or an investment valuation. Keep those backlog gates separate.

## Later internal migration

Any BRD-003 change to one of these identifiers requires a separately reviewed inventory version and an explicit compatibility plan: aliases or stable links, backups/restore rehearsals, staged data/object movement, rollback criteria, session/relogin or passkey recovery as appropriate, owner approval and real upgrade evidence. Do not simply update the guard to bless a global text replacement. Domain/sender changes also need ownership, DNS/TLS, email authentication and origin/RP review before use.
