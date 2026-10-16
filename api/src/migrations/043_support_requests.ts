import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE support_requests (
    id UUID PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
    requester_user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    idempotency_key UUID NOT NULL, body_hash TEXT NOT NULL,
    subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 120),
    description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 2000),
    context TEXT NOT NULL CHECK(context IN ('home','supply','marketplace','offers','agreement','shipment','payment','evidence','recall','account','other')),
    entity_id UUID, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','resolved')),
    operator_note TEXT CHECK(length(operator_note) BETWEEN 10 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_user_id,idempotency_key));
    CREATE INDEX support_requests_requester_page ON support_requests(requester_user_id,organization_id,id DESC);
    CREATE FUNCTION preserve_support_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF ROW(NEW.id,NEW.reference,NEW.requester_user_id,NEW.organization_id,NEW.idempotency_key,NEW.body_hash,NEW.subject,NEW.description,NEW.context,NEW.entity_id,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.reference,OLD.requester_user_id,OLD.organization_id,OLD.idempotency_key,OLD.body_hash,OLD.subject,OLD.description,OLD.context,OLD.entity_id,OLD.created_at)
      THEN RAISE EXCEPTION 'Support report is immutable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER support_report_immutable BEFORE UPDATE ON support_requests FOR EACH ROW EXECUTE FUNCTION preserve_support_report();`);
}
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE support_requests; DROP FUNCTION preserve_support_report()');
}
