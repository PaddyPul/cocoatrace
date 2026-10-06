# ADR 002: BetterTrade modular platform and optional service orders

Date: 2026-10-06. Status: proposed technical design; user requested BetterTrade direction and logistics marketplace, implementation/commercial policies still require review.

## Context

Working buyer/supplier trade, payment and delivery flows must survive rebranding and generic raw-material expansion. Provider logistics should simplify fulfillment without requiring carrier APIs or granting transport companies goods-payment/settlement powers. Historical migrations, storage identifiers and Compose volumes persist customer state.

## Decision

Use an incrementally refactored modular monolith with explicit typed policies/use cases/query modules and an operational worker. Separate goods agreement, fulfillment terms and provider service order. Preserve external/manual transport. Provider assignment grants minimum job-specific access and never verifies goods funds or substitutes for buyer delivery acceptance. Start single provider/single leg, curated portal onboarding, no mandatory carrier SDKs. Maintain independent service financial records.

Apply BetterTrade customer-facing identity first, then compatibility-reviewed internal aliases/migrations. Preserve historical migrations, volume/storage namespaces, remote URLs and token/session compatibility until separately planned. No global string replacement or forced microservice rewrite.

## Consequences and alternatives

This avoids a platform that requires every supplier's carrier/certifier to integrate before trading. It introduces explicit quote/award/versioning, verification-expiry and privacy work; these are provider-pilot gates, not existing functionality. A microservice rewrite would add operational cost before validated demand. Forcing providers to approve every external transport would undermine existing manual arrangements. Renaming Compose project IDs without migration could create empty replacement databases.

## Verification

BRD-001–004, GEO-001–005, SVC-001–012, PER-001–006 plus current core pilot gates. Customer/commercial approval, secure hosting and actual provider participation remain outstanding. See BETTERTRADE_PILOT_PLAN.md and BETTERTRADE_SERVICE_MARKETPLACE.md for boundaries and evidence requirements.
