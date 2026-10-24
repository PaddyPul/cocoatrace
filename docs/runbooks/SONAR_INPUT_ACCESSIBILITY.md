# Second Sonar cleanup: input handling and form labels

Apply on a new branch from accepted main e2539b288bdb6de0659b95139b8757747250575a (merged PR #151). Capture the cherry-picked candidate before installation/verification, run the complete release, and require its passing summary to match that candidate before pushing. Require GitHub CI and SonarCloud rescan before merge. No database migration, user reset, cloud deployment or new secrets are needed.

The earlier export is a baseline, not a live current-main scan. This slice implements 58 additional findings; together with the accepted first slice, 89 are source-corrected pending Sonar confirmation. Twenty-five Moto-only findings have context but no dismissal; 97 still require implementation/review. All 211 issue IDs remain in docs/quality/sonar-triage-2026-10-24.json. Backlog completion is not inferred from these counts.

Review certificate issue labels (including label-click focus without writes), composite farm/certificate grouping, attestation choice after search, insurance upload notes, batch quantity/price/location, shipment mode/document/milestone and payment-plan fields. Existing aria-labels remain for established workflows. Price labels target the number input rather than the adjacent currency selector.

Async calls marked void are boundaries that already catch/display failures; void is not used to suppress a missing handler. Home aggregate processing now catches unexpected rejection and restores explicit unavailable totals. Migration/seed entrypoints catch startup failures and set a nonzero exit status. Deal action unexpected rejection is displayed and is never automatically retried. Existing confirmation and failure-retained drafts remain required.

Email envelope validation keeps the existing basic single-address acceptance behavior. It is not a new RFC mailbox validator or deliverability claim. Support links preserve stricter markup restrictions. Compatibility was compared with the prior expressions over 30,941 generated strings in both modes; dedicated unit cases cover realistic addresses, injection and long domains. Scanner trailing-NUL handling remains distinct from scan verdict or availability. Non-Error upload parser failures become a generic Error and do not complete an intent.

Remaining work includes native dialog/focus semantics, listing interaction, four sourcing-parser regex patterns, deterministic sorting compatibility and security-specific dispositions. Do not mechanically change hash/signature ordering to localeCompare, weaken thresholds, remove tests or dismiss findings in bulk. Eight dependency-risk details still need their own package/version/advisory export. Use npm run demo:rehearsal:start for retained-data founder testing after release; no reset is necessary.


## PR #152 duplication correction

The first Sonar PR analysis reported nine duplicated new lines across ContractRecordsPage, PaymentRecordsPage and ShipmentRecordsPage (3.4% new-code duplication). Their repeated summary lifecycle is now shared in useRegisterSummary. Each register supplies its own count fields and existing API loader. The hook validates nonnegative integers, keeps unavailable totals distinct from zero, refreshes summary and current rows on focus, ignores late requests, and scopes retained totals to account/organization/permissions. Retry remains a read and does not reset filters or mutate business records. No gate threshold or duplication exclusion is changed. SonarCloud must rescan the corrected candidate before acceptance; local checks cannot certify its new percentage.

Apply this correction to the existing fix/sonar-input-accessibility-v2 branch; do not recreate or reapply the original v2 bundle. Capture the new candidate before a full release rerun, then push only after exact matching passed evidence. The baseline remains 211 tracked IDs with 89 source corrections pending Sonar confirmation; this refactor adds no claimed baseline closure.
