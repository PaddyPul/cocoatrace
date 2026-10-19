# Customer transformation scope

The customer application supports recorded source, custody, shipment, sale and recall response. It does not expose a customer blending, repacking or transformation-entry workflow. Login and onboarding describe those implemented records, without promising preservation through arbitrary material changes.

The investor simulation now explicitly identifies seeded genealogy and says customer blending/repacking entry is unavailable. Traceback results may still show a recorded transformation event: that is a historical graph fact, not a claim that customers can enter one. Existing server genealogy primitives and conservative commingled recall calculation remain intact.

This closes RCL-011 by removing unsupported customer workflow claims, rather than adding a new workflow. ARC-027 and the business scope decision remain open. Future transformation entry requires validated customer requirements, mass balance, custody authorization, evidence and independent acceptance before copy can promise it.

Regression: `scripts/customer-claims.test.mjs` verifies public entry copy and the explicit seeded-demo limitation. No database change, seeded graph rewrite or tracing-algorithm change is made.
