import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`UPDATE roles SET permissions=array_append(permissions,'member.manage') WHERE name IN ('buyer_admin','supplier_admin') AND NOT ('member.manage'=ANY(permissions));
    INSERT INTO roles(name,permissions) VALUES ('buyer_member',ARRAY['listing.read','offer.create','contract.read','shipment.read','shipment.update','payment.read','payment.confirm','evidence.read','evidence.upload','provenance.export','batch.read','farm.read','certificate.read']),
      ('buyer_viewer',ARRAY['listing.read','contract.read','shipment.read','payment.read','evidence.read','batch.read','farm.read','certificate.read']),
      ('supplier_member',ARRAY['farm.read','farm.create','batch.read','batch.create','holding.read','holding.create','listing.read','listing.create','offer.respond','contract.read','shipment.read','shipment.update','payment.read','payment.request','evidence.read','evidence.upload','recall.manage']),
      ('supplier_viewer',ARRAY['farm.read','batch.read','holding.read','listing.read','contract.read','shipment.read','payment.read','evidence.read']) ON CONFLICT(name) DO NOTHING;`);
}
export async function down():Promise<void> { throw new Error('Team permissions require a forward correction'); }
