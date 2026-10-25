# SonarCloud context review recommendations — 2026-10-24

These 46 baseline findings require an explicit reviewer decision in SonarCloud. This document does not dismiss them, grant a security exception or establish the current live scan count. Keep the gate and scan scope unchanged. Use each issue ID in the ledger to reconcile a new scan; if an issue reports a different execution path, review that path rather than applying this rationale blindly.

## Moto recovery helper: 25 findings

`scripts/recovery-objects.py` fixes the endpoint to `http://127.0.0.1:5000` and supplies synthetic credentials explicitly. The dedicated Compose Moto container has no published ports. The runner targets its fixed disposable project and container. Data, bucket names, credential values and archives are synthetic; production object access uses a different service. This helper exposes no endpoint option for real S3. Therefore real-account key lifetime and bucket-owner substitution findings are candidates for a documented false-positive disposition in this specific helper. Do not add unsupported S3 parameters simply to silence a rule or generalize this review to production storage. Three existing runner/teardown tests and full Docker recovery remain required evidence.

## Public fixture hashes and local database defaults: 14 findings

Ten bcrypt-looking values in `db/seed.sql` belong to public synthetic seed accounts. `api/scripts/seed.ts` rejects deployed environments; demo reset uses `assertDemoResetAllowed`, while preview seeding requires the dedicated marked demo database and refuses unmarked nonempty data. These are not production credential provisioning paths. Four database password findings are intentional development defaults in config/setup/Compose. The main legacy Compose file now publishes PostgreSQL, API and web only on 127.0.0.1; staging and production config reject the known development database password even when explicitly provided, including percent-encoding. Config/reset/preview unit tests and exact release are the relevant evidence. Recommend a local/test-only disposition only for these verified contexts, not a blanket secret allowlist. This does not approve using default demo credentials in a deployed investor environment.

## Local executable discovery: seven findings

These source files are local release, recovery, load, recall and secret-scan runners. Their flagged calls use fixed `git`/Docker command names and argument arrays under the invoking developer/CI account; they do not accept a remote HTTP request choosing an executable. A trusted PATH/toolchain is an execution prerequisite, as it is for invoking Node/npm/Git themselves. Test harnesses intentionally prepend a temporary fake executable to PATH to prove failed commands stop and teardown remains scoped. Arbitrary changes to global PATH handling would break Windows tool discovery and those safety tests without establishing protection from an already-compromised local account. Recommend a documented accepted local-toolchain assumption after reviewer confirmation; no shell execution or credential exposure is introduced by this bundle.

## Individual decisions still required

| Issue ID | Rule | File | Recommended review |
|---|---|---|---|
| AaFuYUohdA8JAur1g-52 | python:S7625 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-53 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-54 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-55 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-56 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-57 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-58 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-59 | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6A | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6B | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6C | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6D | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6E | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6F | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6G | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6H | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6I | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6J | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6K | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6L | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6M | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6O | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6P | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6Q | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUohdA8JAur1g-6R | python:S7608 | scripts/recovery-objects.py | REVIEW_MOTO_ONLY_FALSE_POSITIVE |
| AaFuYUpDdA8JAur1g-6c | javascript:S4036 | scripts/run-recovery-tests.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUomdA8JAur1g-6S | javascript:S4036 | scripts/run-release-checks.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUowdA8JAur1g-6W | javascript:S4036 | scripts/secret-scan.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUowdA8JAur1g-6X | javascript:S4036 | scripts/secret-scan.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUopdA8JAur1g-6T | javascript:S4036 | scripts/pilot-load.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUo4dA8JAur1g-6Z | javascript:S4036 | scripts/recall-drill.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUpAdA8JAur1g-6a | javascript:S4036 | scripts/run-evidence-stress.mjs | REVIEW_ACCEPTED_LOCAL_TOOLCHAIN |
| AaFuYUksdA8JAur1g-4A | secrets:S6698 | api/src/config/env.ts | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUksdA8JAur1g-4B | secrets:S6698 | api/src/config/env.ts | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5y | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5z | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-50 | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5x | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUpFdA8JAur1g-6d | secrets:S6698 | docker-compose.yml | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5r | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5s | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5t | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5u | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5v | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUofdA8JAur1g-5w | secrets:S8215 | db/seed.sql | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |
| AaFuYUpLdA8JAur1g-6r | secrets:S6698 | setup.sh | REVIEW_SYNTHETIC_OR_LOCAL_ONLY |

After resolving these decisions, export a fresh SonarCloud issue list. The 165 implemented baseline findings must also be confirmed by that scan; source counts are not closure counts. The separate eight dependency risks are still missing package/version/advisory details and are not closed by this review.

## 2026-10-25 reconciliation

The complete new 47-item export confirms all 46 reviewed IDs remain open. The individual decision manifest in `docs/quality/sonar-closeout-2026-10-25.json` recommends 35 false positives and 11 accepted residual local-development/toolchain risks. These external state changes have not been applied by the author. Use `docs/runbooks/SONAR_REMAINING_CLOSEOUT.md` after the source fix is merged and reviewed. Accepted risks remain tracked under SEC-006; no production readiness is granted.
