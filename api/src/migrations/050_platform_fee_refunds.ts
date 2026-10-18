import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE fee_refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fee_id UUID NOT NULL REFERENCES platform_fee_invoices(id),
    requested_by UUID NOT NULL REFERENCES users(id), payer_organization_id UUID NOT NULL REFERENCES organizations(id),
    idempotency_key UUID NOT NULL UNIQUE, snapshot_fingerprint TEXT NOT NULL CHECK(snapshot_fingerprint ~ '^[a-f0-9]{64}$'),
    reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000), amount NUMERIC NOT NULL CHECK(amount>0), currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN('requested','sent','confirmed','rejected')),
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), external_reference TEXT,
    sent_by UUID REFERENCES users(id), sent_at TIMESTAMPTZ, confirmed_by UUID REFERENCES users(id), confirmed_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id), rejected_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((status IN('sent','confirmed'))=(sent_at IS NOT NULL)),
    CHECK ((status='confirmed')=(confirmed_at IS NOT NULL)), CHECK ((status='rejected')=(rejected_at IS NOT NULL)),
    CHECK ((sent_at IS NULL)=(external_reference IS NULL)), CHECK ((sent_at IS NULL)=(sent_by IS NULL)));
    CREATE UNIQUE INDEX fee_refund_reference_unique ON fee_refund_requests(lower(trim(external_reference))) WHERE external_reference IS NOT NULL;
    CREATE UNIQUE INDEX fee_refund_one_active ON fee_refund_requests(fee_id) WHERE status<>'rejected';
    CREATE TABLE fee_refund_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), refund_id UUID NOT NULL REFERENCES fee_refund_requests(id),
      actor_user_id UUID NOT NULL REFERENCES users(id), actor_organization_id UUID NOT NULL REFERENCES organizations(id),
      action TEXT NOT NULL CHECK(action IN('requested','sent','confirmed','rejected')),
      reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX fee_refund_history ON fee_refund_events(refund_id,created_at,id);
    CREATE FUNCTION preserve_fee_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fee refund history cannot be deleted'; END IF;
      IF ROW(NEW.fee_id,NEW.requested_by,NEW.payer_organization_id,NEW.idempotency_key,NEW.snapshot_fingerprint,NEW.reason,NEW.amount,NEW.currency,NEW.created_at)
         IS DISTINCT FROM ROW(OLD.fee_id,OLD.requested_by,OLD.payer_organization_id,OLD.idempotency_key,OLD.snapshot_fingerprint,OLD.reason,OLD.amount,OLD.currency,OLD.created_at)
         OR NOT ((OLD.status='requested' AND NEW.status IN('sent','rejected')) OR (OLD.status='sent' AND NEW.status='confirmed'))
         OR NEW.revision<>OLD.revision+1
         OR (OLD.sent_at IS NOT NULL AND ROW(NEW.external_reference,NEW.sent_by,NEW.sent_at) IS DISTINCT FROM ROW(OLD.external_reference,OLD.sent_by,OLD.sent_at))
      THEN RAISE EXCEPTION 'Invalid immutable fee refund transition'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fee_refund_immutable BEFORE UPDATE OR DELETE ON fee_refund_requests FOR EACH ROW EXECUTE FUNCTION preserve_fee_refund();
    CREATE FUNCTION preserve_fee_refund_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fee refund events are immutable'; END $$;
    CREATE TRIGGER fee_refund_event_immutable BEFORE UPDATE OR DELETE ON fee_refund_events FOR EACH ROW EXECUTE FUNCTION preserve_fee_refund_event();`);
}
export async function down(): Promise<void> {
  throw new Error('Platform fee refund history must be retained; use a forward correction');
}
