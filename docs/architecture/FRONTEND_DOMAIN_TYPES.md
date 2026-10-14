# Frontend domain type ownership

`web/src/types.ts` is a compatibility export surface only. The declarations live with their domain in `web/src/domains/<domain>/types.ts`. New consumers import the owning module directly; existing integration imports from the compatibility file remain supported. Domain modules never import the compatibility barrel.

| Owner | Contracts |
| --- | --- |
| identity | User assurance, roles/permissions and onboarding state |
| trust | Claim status, attribution and trust summaries |
| source | Farms, source batches and physical holdings |
| marketplace | Listings, sourcing briefs/requests and offers |
| trade | Accepted commercial contract |
| fulfillment | Shipment and dispatch/payment gate presentation |
| payments | Payment request presentation |
| evidence | Evidence metadata and scan/review state |
| audit | Audit event presentation |
| certification | Certificate scope, issuer and validity |
| provenance | Complete batch provenance view |
| product | Product profiles, public product view and journey events |
| recall | Private recall responses/recovery and published notice safety |
| traceability | Material lot genealogy and trace/impact results |

The declarations preserve their existing field names, optionality, unions and numeric representations. This move does not imply runtime response validation: the former monolith had interfaces and aliases, with no executable schemas to relocate. HTTP envelope validation remains at the client boundary; domain interfaces are not security authorization checks.

Cross-domain dependencies use `import type`: source and marketplace depend on trust; product depends on trust; provenance depends on source. The dependency graph has no cycles or runtime imports. Consumers outside the compatibility barrel use the owning domain directly, including pages, auth context, recall panels and catalog pickers. The HTTP client may retain compatibility imports while being extracted independently.

Verification: run the web workspace type check and production build. These compile all consumers against the owned declarations and exercise bundling of the type-only exports. No behavior or database migration is introduced by the ownership move.
