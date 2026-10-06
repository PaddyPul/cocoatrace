# Source and evidence entry

Supplier home and empty publication offer the same permission-aware choices: direct conventional inventory, or a source farm with plots followed by harvest. A farm/plot alone creates no saleable quantity. Farm linkage and organic assurance are separate: recording origin or uploading proof never automatically approves an organic claim.

Onboarding “Add evidence to a record” opens `/evidence/contribute`. The contributor chooses an accessible farm, batch/inventory, contract or shipment; selects a purpose; explains the supported claim; and attaches PDF/JPEG/PNG through the existing private upload service. Farm and batch detail links can preselect an accessible record. Unknown/foreign IDs are not preselected. Server upload authorization remains mandatory.

Plot evidence currently attaches to the parent farm: name its plot code in the explanation. Contract-specific commercial/document-release workflows remain in the deal room and contract page. Generic contribution does not bypass document release rules, malware scanning, tenant quota or resource authorization.

Empty source/inventory lists show setup choices. Empty trade lists point back to the trade dashboard. Failed reads show an error and do not enable upload. Uploads require a record, file and explanation; submission disables changes. Switching records clears the file and explanation.

Automated acceptance: `e2e/sourceEvidenceEntry.spec.ts` covers direct inventory and proof linkage, farm/plot/harvest persistence, reviewed sourcing edits saved to PostgreSQL and contribution onboarding with a failed-read boundary. Run through `npm run verify:release` against its disposable stack. Author type/build checks alone do not prove those native journeys pass.

Remaining scope: request-specific requirement checklists; reopening/editing saved sourcing briefs; distinct plot evidence entities if later justified; full accessibility audit. Existing production email, hosted environment and operations gates remain separate.
