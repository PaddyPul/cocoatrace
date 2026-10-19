# Unsaved change protection coverage — 2026-10-18

The initial route guard and seven entry workflows are founder release/merge accepted. Founder reports the extended coverage release passed and merged on2026-10-19. UX-011 is accepted. No draft content is stored or sent by the guard. Browser reload/tab-close warnings are best effort and use browser-owned wording.

The application uses one React Router blocker and one shared same-page discard review. Stay/Escape retains the current values; confirmed Discard executes only the requested close/reset/context transition. A blocked browser Back is fully reset before the regression repeats it. Loading the review chunk cannot silently leave: unavailable review keeps the page. Session loss and login/passkey/security remediation bypass blocking. Unsubmitted public organization applications also register; credential/token forms do not.

| Form family | Protected draft / context | Successful-write boundary |
| --- | --- | --- |
| Direct inventory; farm/plot; harvest | All entered fields beyond defaults; modal X/Cancel/backdrop/Skip; route departure | Created record remains; only its draft clears. No database rollback on closing a form |
| Onboarding; sourcing brief; supply publishing | Changed settings/specification/commercial fields; searches alone stay clean; sourcing closeout reason/contract/confirmation | Save resets the submitted baseline before normal redirect |
| Evidence contribution | Explanation/file/purpose supporting chosen record; changing record/type reviews discard; same-page paging keeps selection | Upload persists file; reset only upload draft. Upload never grants review status |
| Commercial offer and listing renewal | Quantity/price versus original prefill; renewal reason/duration; renewal Close and parent search/page | Accepted save clears respective draft; failed save keeps it |
| Batch publication and attestation; plot detail; certificate issuance | Editable publication/attestation, plot or certificate fields and supporting files; local cancel/reset | Each submitted section clears independently |
| Goods terms/payment/security and protected documents | Plan/proof/deposit/compliance/reference/provider/evidence IDs; issue kind/installment/correction and resolution explanation; local document close and destructive selection | Only saved financial section clears; merely reading/downloading does not clear other drafts |
| Platform fee statement/terms/credit/refund | Actual payment/reference/amount/currency edits, reviewed terms/credit and refund explanation/reference/confirmation | Existing server state/assurance remains authoritative; successful submission clears its own fields |
| Delivery acceptance/exception; cancellation | Inspected quantity, note, discrepancy/resolution/supporting proof and acknowledgement; cancellation explanation | Successful decision clears submitted form; failed/conflicting decision retains it |
| Transport arrangement/progress/timing | Changed provider/booking/mode/place/tracking fields versus loaded baseline; milestone/location/notes/exception; ETA/reason; Cancel | Arrangement, progress and timing save independently; safety/party/payment gates unchanged |
| Recall activation/investigation/recovery | Notice inputs, response/recovery values and evidence; holding switch; closing response and changing recall filters/page | Read refresh/error preserves open response; confirmed context change discards only reviewed draft |
| Operations recovery | Selected cleanup/email/alert explanation; close or switch reviewed work | Failed refresh/conflict keeps explanation; successful recovery clears it |
| Access application/suspension/review; team role decisions | Review explanation/role/confirmation/reauth inputs; close, selected person/record switch and operator queue reset | Read refresh invalidates stale confirmation but retains explanations; successful decision clears |
| Document review | Reason/decision/selected retained evidence; close and parent document switch | Successful review clears submitted draft; private file/read policies unchanged |
| Support; pilot feedback; invitation | Request/review explanation/status/context; feedback rating/comment; invitation address; closes and resets | Save clears submitted section; selected request reload retains explanation while reviewing discarded status |
| Public access request | Organization/application fields compared with last saved application | Saved application/email retry does not become an unsaved draft until edited |

## Explicit non-draft and security boundaries

Search, pagination, display filters, read-only directory/product/trace/provenance/history views and persisted notification read receipts are not business drafts. FarmPlots/FarmCertificates/BatchEvidence/Products registers are read-only; public product creation is an immediate generated action, not an editable form. Persisted evidence upload alone needs no discard warning; an unsubmitted parent payment attachment does. Public login/reset/invitation credentials and passkey/password security flows do not trap navigation or persist secrets. Existing confirmation/assurance requirements remain; this feature does not turn every destructive business action into a reviewed confirmation (UX-006 remains separate).

Reverting all fields resets snapshot-based forms; sourcing/publishing edit markers can conservatively warn after reverting. No cross-device draft persistence, crash recovery, credential retention or guaranteed mobile unload prompt is promised. Accessibility across every device/browser remains UX-001/002/008/010. Native and browser acceptance plus independent hosted operation are separate evidence, not implied by TypeScript compilation.

## Regression evidence

Existing unsavedChanges browser tests retain Back/Stay/Leave, failed-save retention, success redirect, security bypass and unavailable-review handling. recordDrafts and recoveryDrafts add record modal, anonymous application, failed offer rejection and recall response close/filter cases. Operations, support, evidence-selection, transport, fee-credit, listing renewal and actual payment-plan/trade journeys now explicitly exercise intentional discard while retaining prior failure-state assertions. Full browser execution is required in the founder environment. UX-011 may close only after full release/merge acceptance of this candidate.
