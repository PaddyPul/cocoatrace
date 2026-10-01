# ADR 001 — Bootstrap from the immutable schema snapshot

Status: accepted for implementation, pending native PostgreSQL/CI validation.

Backlog: ENV-019, ENV-007, QLT-005.

## Context

Migration 001 loads `db/schema.sql`. That frozen snapshot already incorporates
migrations through 010, including both migrations numbered 002. Replaying those
historical migrations on the snapshot causes duplicate-column failures. Editing
applied migrations would break the integrity manifest and deployment history.
Tests previously prepared a baseline explicitly; the normal release runner did
not, so test success did not prove a fresh installation could start.

## Decision

The normal migration runner owns snapshot bootstrap. A verified empty
application schema receives the immutable snapshot and all canonical baseline
ledger entries. The runner then applies migrations after 010 through Knex.
The production module owns the shared baseline definition; existing integration
helpers re-export it rather than maintaining a different boundary.

An existing valid migration ledger is upgraded in place. Its applied entries
and application records are retained. Unknown, duplicated, gapped or incomplete
baseline histories are refused with a diagnostic. An existing empty ledger also
requires investigation; it is not automatically reseeded. Existing untracked objects
are not treated as an empty installation or overwritten.

An advisory transaction lock serializes discovery, bootstrap and upgrade.
Schema changes and ledger writes run atomically. The Knex migration lock is
still honored; a stale lock is not automatically cleared. Frozen migrations,
snapshot bytes and integrity hashes stay unchanged.

## Consequences

Fresh-install and existing-upgrade regression tests must invoke the real
release command in production configuration. Current migration chains must be
transaction-compatible. A future migration that needs to run outside a
transaction requires a separately reviewed runner design; it cannot silently
bypass atomicity.

The production runner never resets the application schema. Destructive fixture
setup belongs only to an explicitly guarded, named disposable test database.
An ambiguous legacy history requires backup, investigation and an explicit
repair plan rather than automatic adoption of the snapshot.

Rollback of a failed migration invocation is transactional. Rollback of an
already successful deployment remains a reviewed release/restore procedure;
this decision does not authorize running historical `down` functions or
altering the migration ledger manually.
