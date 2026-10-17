# Recall operation authority

This matrix records the current platform permissions. It does not grant a legal recall mandate, create an investigator role, or implement dual approval or separation of duties. A tenant manager can investigate, activate, contact and resolve within the existing scope. Network scope must be explicit.

| Operation | Current authority | Resource boundary |
| --- | --- | --- |
| Investigate impact (`POST /traceability/recall-impact`) | `recall.manage` or `*` at the route | Ordinary managers see their accessible trace graph; explicit network trace/recall permission controls broader visibility. |
| Activate (`POST /recalls`) | `recall.manage` or `*` at the route | Ordinary managers must have access to every selected seed. `recall.manage.all` or `*` permits network seed scope, but `recall.manage.all` alone does not satisfy the route prerequisite. |
| Read response | Initiating organization, registered participant, or explicit network recall authority | Participants see their scoped holdings/recipients/recoveries. Manager visibility is not physical ownership. |
| Record participant contact | Initiating organization with `recall.manage`, or `recall.manage.all`/`*` | Only a participant belonging to the selected accessible notice can be updated. |
| Acknowledge notice | Registered affected organization | Changes only the authenticated organization’s participant record. Network/manager authority does not acknowledge another organization’s notice. |
| Record physical recovery | Current inventory holder | Holding must be affected by the accessible active recall and not transferred. Manager/network privileges do not override physical ownership. |
| Resolve | Initiating organization with `recall.manage`, or `recall.manage.all`/`*` | Active recall, substantive reason, current available clean non-rejected proof linked to that exact recall, every participant acknowledged, and complete current physical accounting with no quarantine remaining. |

Resolution is not automatic republishing or blanket inventory clearance. Existing conditional hold release retains returned/destroyed inventory holds; affected lot holds stay while associated current holding holds remain. Closed recalls retain read-only response history. All mutations keep the recall advisory/row lock and their critical audit inside one transaction. Resolution queues its durable notification work in that same transaction. Evidence availability is checked before the transaction and revalidated against locked current metadata before resolution.

Implementation: [pure manager policy](../../api/src/modules/recall/policy.ts), [response usecases](../../api/src/modules/recall/response.ts), [response repository](../../api/src/modules/recall/responseRepository.ts), [route prerequisites](../../api/src/routes/publicProducts.ts), [investigation route](../../api/src/routes/traceability.ts).

Verification: [operation policy tests](../../api/src/modules/recall/policy.test.ts), [native operation roles](../../api/test/integration/recallRoles.integration.test.ts), and [native response/resolution, proof and accounting cases](../../api/test/integration/recallResponse.integration.test.ts). The native suites require disposable PostgreSQL/storage/scanner fixtures; static compilation alone does not establish a runtime pass.
