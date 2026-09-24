-- Executed only after the demo command verifies the target database.
-- Knex migration history is deliberately preserved.
TRUNCATE TABLE audit_events, organizations, roles RESTART IDENTITY CASCADE;

