# Workspace resilience — first batch

This batch advances the35-item sprint; it does not close universal UX003/004/005/PRD011 or all accessibility/device acceptance.

| Scope | Failure behavior | Retry / integrity boundary |
| --- | --- | --- |
| Contract/payment/transport detail | Explicit unavailable/permission error, no invented Not found | Named read retry; no automatic business-write replay |
| Farm/holding/batch detail | Loading, malformed/wrong-ID, failed read and missing record distinct | Retry/back; stale in-flight responses ignored |
| Batch public identity | Loading/error separate from confirmed404 absence | No duplicate creation action on failed read; independent retry; confirmed publication is distinct from failed follow-up refresh |
| Product register safety | Malformed safety data is an error | Recorded retained inventory hold overrides contradictory clear status |
| Shared search/mobile navigation | Named native modal, keyboard-contained focus | Escape/cancel restores trigger; hidden desktop navigation absent from mobile accessibility tree |
| Feedback | Labelled text, pressed rating, named modal/error | Keyboard focus contained; unsaved discard review remains authoritative |

The new mocked browser suites audit these failure/keyboard paths. They run automatically in the existing CI/release browser suite. Focused DOM accessible-name checks are explicitly limited to visible shared controls; they do not constitute WCAG conformance, contrast verification, screen-reader testing or physical mobile browser acceptance. Existing all-workflow browser/device inventory remains open.

Detail read retries do not confirm money, change custody, republish goods or bypass authentication. New explicit403 after retry must remain denied, with no financial write. Successful source/profile responses still need current API authorization. Server tenant/safety checks and all release gates remain mandatory.

Accepted baseline:164/343. Candidate advances the sprint; no extra full-item completion is claimed until each item's entire acceptance requirement is met.
