# Production API type-safety coverage

The production API no-explicit-any rule now covers controllers, middleware, services and feature modules. Frozen migration sources remain ignored. Previously adopted strict feature-test scopes still reject explicit any and unused variables; unrelated legacy tests are not automatically rewritten.

The rule prevents explicit escape hatches; it does not prove runtime input validation or remove permissive defaults inherited from Express and pg. Reviewed adapters must continue to validate untrusted inputs and declare query row contracts. The shared database helper accepts unknown parameters and supports typed result rows without changing parameterized SQL or transaction behavior.

The current batch adds session row contracts, schema-inferred recall-impact inputs, typed trace queries, typed split-holding results and explicit unknown database-error inspection. Trust assessment normalizes input records and refuses mixed plot/crop arrays and invalid dates from upgrading reviewed claims. Optional external narrative JSON admits only string output text and otherwise retains deterministic guidance.

Local regressions cover valid trust behavior and malformed metadata. The required native trust suite and full release protect real PostgreSQL joins, session and trading flows. Static lint/type checks alone do not close ARC-020 or prove authorization. Trace timestamp declarations retain their existing serialized-string convention; pg runtime Date values and complete frontend DTO adoption remain precision work. No production authentication, MFA, audit, recall or payment policy is relaxed by these type changes.
