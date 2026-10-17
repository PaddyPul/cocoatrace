# Recorded synthetic recall tabletops

RCL-008/RCL-013/INV-010 candidate. These are disposable native integration drills, not an operational recall instruction or proof of customer contact.

| Scenario | Independently specified physical partition | Expected organization roles |
| --- | --- | --- |
| Partial stock | 10kg source held as 6kg plus 4kg; no dispatch, all 10kg retained | Initiator/source owner and second current holder |
| Commingled genealogy | 4kg suspect input plus 6kg other input produces 10kg output; consumed source rows excluded from current stock accounting | Initiator/suspect owner and processor/output holder |
| Distributed material | 10kg source partitioned as 6kg current stock plus 4kg recorded distribution | Initiator/lot owner, current holder/contract seller, accepted-contract buyer, recorded distribution recipient |

The native suite calls real recall activation with an ordinary scoped manager. Each scenario compares the exact participant organization set to fixture IDs specified independently of production recipient queries, rejects an unrelated organization, verifies affected lot/holding holds and listing withdrawal, and confirms activation leaves inventory quantities and ownership unchanged. Commingling contains the entire output; it does not treat source-equivalent quantity as the physically separable contaminated portion. Clean sibling input remains outside forward recall scope. Fixtures insert an accepted contract and genealogy to set up the drill; they do not claim a customer blending workflow or exercise offer acceptance.

The distributed recipient has no active platform contact. It remains in the participant set with an escalated contact state, while no email work is queued for the inactive user. Active recipients' work is queued only: no sender worker runs. Missing recipients and unresolved contact/acknowledgement are different measures. A complete identification result may still have unresolved recipients; the report never describes them as contacted or acknowledged.

The report `recall-drill-test-results/summary.json` contains only scenario labels, current Git SHA, timestamps, elapsed milliseconds, completeness, recipient counts and integer-gram quantity reconciliation. No emails, customer names, resource IDs, file/storage keys or evidence bytes are written. Graph completeness is not safety clearance. Existing cycle/oversize/incomplete-analysis containment tests remain mandatory in the full native suite.

The physical reconciliation denominator is the scenario's non-overlapping current stock plus recorded outward distribution, not the sum of every genealogy node. Retained quantity is stock under current hold. Historical consumed/transferred source rows remain unchanged but are not counted again. Reported elapsed time measures activation/verification on the executing host; total time includes fixture preparation. These are observations, not performance budgets or hosted SLOs.

## Execute and retain

Use the full `npm run verify:release` handoff. It invalidates the previous report before native integration, requires all three scenarios, then checks report status and exact current commit before continuing. CI follows the same ordering and uploads the counts-only report for 30 days. Save a copy with the release evidence before artifact expiry. An incomplete or failed drill cannot contribute partial completion credit.

For diagnosis only, the runner accepts a single suite filename:

```powershell
cmd.exe /d /c "npm run test:integration:docker --workspace=api -- recallTabletop.integration.test.ts > recall-tabletop-focused-output.txt 2>&1"
if ($LASTEXITCODE -ne 0) { throw "Recall tabletop failed. Send the first specific failure." }
npm run check:recall-drill
if ($LASTEXITCODE -ne 0) { throw "Recorded drill evidence is invalid." }
```

A focused pass does not replace full exact-commit release/CI acceptance. No migration, dependency upgrade, production database connection, new HTTP endpoint or email dispatch is added. The test runner's disposable database guard remains required.

Before a real pilot recall, separately validate the actual inventory graph, external contacts, operational ownership, communication procedures and customer response. See RCL-003/004/005, OPS incident/hosting gates and INV-009 for remaining operational/customer acceptance.
