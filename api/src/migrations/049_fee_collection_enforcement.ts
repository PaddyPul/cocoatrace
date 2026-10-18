import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE fee_collection_terms (
    fee_id UUID PRIMARY KEY REFERENCES platform_fee_invoices(id),
    policy_version TEXT NOT NULL CHECK(policy_version='seller-predispatch-v3'),
    terms_accepted_by UUID REFERENCES users(id), terms_accepted_at TIMESTAMPTZ, accepted_fingerprint TEXT CHECK(accepted_fingerprint IS NULL OR accepted_fingerprint ~ '^[a-f0-9]{64}$'),
    credit_until TIMESTAMPTZ, credit_reason TEXT, credit_granted_by UUID REFERENCES users(id),
    credit_revision INTEGER NOT NULL DEFAULT 0 CHECK(credit_revision>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((terms_accepted_by IS NULL)=(terms_accepted_at IS NULL) AND (accepted_fingerprint IS NULL)=(terms_accepted_at IS NULL)),
    CHECK (credit_reason IS NULL OR length(trim(credit_reason)) BETWEEN 10 AND 2000));
    CREATE FUNCTION preserve_fee_terms_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.fee_id IS DISTINCT FROM OLD.fee_id OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
        OR (OLD.terms_accepted_at IS NOT NULL AND (NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at OR NEW.terms_accepted_by IS DISTINCT FROM OLD.terms_accepted_by OR NEW.accepted_fingerprint IS DISTINCT FROM OLD.accepted_fingerprint))
      THEN RAISE EXCEPTION 'Accepted platform fee terms are immutable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fee_terms_acceptance_immutable BEFORE UPDATE ON fee_collection_terms FOR EACH ROW EXECUTE FUNCTION preserve_fee_terms_acceptance();
    CREATE FUNCTION preserve_fee_terms_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Platform fee terms history cannot be deleted'; END $$;
    CREATE TRIGGER fee_terms_history_immutable BEFORE DELETE ON fee_collection_terms FOR EACH ROW EXECUTE FUNCTION preserve_fee_terms_history();
    CREATE INDEX fee_unpaid_due ON platform_fee_invoices(payer_organization_id,due_at) WHERE status='invoiced';`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX fee_unpaid_due; DROP TABLE fee_collection_terms; DROP FUNCTION preserve_fee_terms_acceptance(); DROP FUNCTION preserve_fee_terms_history()');
}
