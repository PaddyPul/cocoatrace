# Frontend HTTP ownership

ARC-016: web/src/api.ts is a compatibility export barrel. Existing callers keep the same exports; new clients import the shared HTTP transport and domain-owned types.

| Module under web/src/api | Owner |
| --- | --- |
| http.ts | One in-memory bearer token, credentialed requests, session expiry, error handling and bounded MFA retry |
| identity.ts | Sign-in, account security, invitations and access applications |
| workspace.ts | Onboarding, dashboards, assistant and operations |
| sources.ts | Farms, batches, holdings and certificates |
| marketplace.ts | Listings and sourcing requests |
| trades.ts | Offers, contracts, shipment and payment workflows |
| evidence.ts | Private evidence intent/content/download |
| organizations.ts | Organization and membership collections |
| audit.ts | Audit register |
| traceability.ts | Product profiles, recalls, provenance and trace views |
| fees.ts | Fee ledger and statements |

mfa.ts imports http.ts directly; the HTTP transport imports the passkey ceremony dynamically only when fresh assurance is required. There is no second token store or feature-specific session fallback. Evidence byte downloads share the live token accessor, include cookies and retain their existing download behavior. Provenance opening uses same-origin paths and opener isolation.

All 56 original exported declarations remain available through the compatibility surface. Six real transport/feature-client regressions exercise shared session state, rejected-login versus expired-session behavior, MFA enrollment routing, multipart/empty responses and evidence download credentials. Existing signed passkey and full persona browser suites remain the integration acceptance for actual ceremonies and navigation. This split does not add runtime response schemas or claim to complete the OpenAPI work (ARC-021/022).
