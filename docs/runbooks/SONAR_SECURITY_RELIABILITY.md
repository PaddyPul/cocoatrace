# SonarCloud security/reliability correction

Start from accepted main 4d5aa3bcf0217c70324f4656fe8f08646d4a304e (merged PR #150). Apply this bundle on a new branch, capture the resulting candidate before verification, run the full release, and push only if the passed summary matches that exact candidate and HEAD/branch/worktree remain unchanged. Require CI and a SonarCloud rescan; do not infer closure from the local ledger.

The first source slice addresses 31 baseline findings. The ledger tracks all 211 findings from the earlier user export: 31 implemented pending verification, 25 context-reviewed but not dismissed, 155 open requiring review. This does not claim that the current merged-main scan still has exactly 211, nor that any issue is already closed. Eight dependency-risk details are missing from the export.

The recovery runner creates two private directories with mktemp -d inside its already isolated disposable containers. PostgreSQL dump/restore share one directory. All Python object phases share the other through RECOVERY_WORKSPACE. The Python script validates ownership, directory type and mode 0700 before any S3 client creation. Container teardown removes the directories. No host cleanup, real S3 operation, production restore or customer data reset is added. Full release recovery must verify the container images provide mktemp and retain dump/restore and version-history canaries.

Review all 21 changed buttons as form submits: agreement acknowledgement, documents reference, delivery decisions, payment issues, team/access/security and support actions. The existing confirmation, permission and validation boundaries remain active. Verify failure retains inputs and does not replay a mutation. Local investor rehearsal may preserve existing data with npm run demo:rehearsal:start after full release; do not reset it merely to apply this change.

CI now invokes node node_modules/@playwright/test/cli.js after npm ci. A missing local package fails; it cannot trigger an implicit npx download. This change does not solve the separate lifecycle-script installation findings; review required install hooks before changing that policy.

Later bundles must review promise rejection paths, accessibility labels/keyboard controls and input regex performance. Sorting changes require byte-for-byte hash/signature compatibility evidence; do not replace ordinal sorting mechanically with locale-dependent comparisons. Test-only dummy Moto credentials and bucket ownership checks require specific Sonar review rather than blanket exceptions.
