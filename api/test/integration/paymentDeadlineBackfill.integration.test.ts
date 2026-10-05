import type { Knex } from 'knex';
import crypto from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { getClient, pool } from '../../src/db';
import { backfillMissingPaymentDeadlines } from '../../src/migrations/027_payment_due_reminders';

afterAll(async () => { await pool.end(); });

it('backfills only provable open due deadlines and preserves existing, paid, closed and unknown deadlines', async () => {
  const client = await getClient();
  await client.query('BEGIN');
  try {
    const seller = (await client.query("INSERT INTO organizations(name,type,jurisdiction) VALUES($1,'exporter','GH') RETURNING id", [`Backfill seller ${crypto.randomUUID()}`])).rows[0].id;
    const buyer = (await client.query("INSERT INTO organizations(name,type,jurisdiction) VALUES($1,'importer','NL') RETURNING id", [`Backfill buyer ${crypto.randomUUID()}`])).rows[0].id;
    const batch = (await client.query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,100,$1,'direct_inventory','Backfill regression','GH') RETURNING id", [seller])).rows[0].id;
    const holding = (await client.query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,100) RETURNING id', [batch, seller])).rows[0].id;
    const listing = (await client.query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,origin_location,destination_location) VALUES($1,$2,100,5,'EUR','Tema','Rotterdam') RETURNING id", [seller, holding])).rows[0].id;
    const origin = '2026-01-01T12:00:00.000Z';
    const existing = '2026-02-15T12:00:00.000Z';
    const cases = [
      { trigger: 'terms_agreed', expected: origin },
      { trigger: 'documents_presented', expected: origin },
      { trigger: 'delivery', expected: '2026-01-31T12:00:00.000Z' },
      { trigger: 'terms_agreed', dueAt: existing, expected: existing },
      { trigger: 'terms_agreed', itemStatus: 'paid', expected: null },
      { trigger: 'terms_agreed', contractStatus: 'cancelled', expected: null },
      { trigger: 'terms_agreed', contractStatus: 'settled', expected: null },
      { trigger: 'terms_agreed', unknown: true, expected: null },
      { trigger: 'documents_presented', unknown: true, expected: null },
      { trigger: 'delivery', unknown: true, expected: null },
      { trigger: 'terms_agreed', itemStatus: 'awaiting_trigger', expected: null },
      { trigger: 'terms_agreed', itemStatus: 'payment_submitted', expected: null },
    ];
    const expected: { id: string; deadline: string | null }[] = [];
    for (const scenario of cases) {
      const offer = (await client.query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id", [listing, buyer])).rows[0].id;
      const contract = (await client.query(`INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,status,payment_terms_status,payment_terms_confirmed_at,credit_days)
        VALUES($1,$2,$3,$4,$5,4,5,$6,'agreed',$7,30) RETURNING id`,
      [listing, offer, seller, buyer, holding, scenario.contractStatus ?? 'accepted', scenario.unknown ? null : origin])).rows[0].id;
      const payment = (await client.query(`INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,documents_presented_at)
        VALUES($1,$2,20,$3) RETURNING id`, [contract, seller, scenario.unknown ? null : origin])).rows[0].id;
      await client.query("INSERT INTO shipments(contract_id,current_milestone,delivered_at) VALUES($1,'delivered',$2)", [contract, scenario.unknown ? null : origin]);
      const item = (await client.query(`INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status,due_at)
        VALUES($1,'full',1,20,$2,$3,$4) RETURNING id`, [payment, scenario.trigger, scenario.itemStatus ?? 'due', scenario.dueAt ?? null])).rows[0].id;
      expected.push({ id: item, deadline: scenario.expected });
    }
    const adapter = { raw: (sql: string) => client.query(sql) } as unknown as Pick<Knex, 'raw'>;
    await backfillMissingPaymentDeadlines(adapter);
    // A second migration-helper run must not move any historical deadline.
    await backfillMissingPaymentDeadlines(adapter);
    for (const item of expected) {
      const stored = (await client.query('SELECT due_at FROM payment_installments WHERE id=$1', [item.id])).rows[0];
      expect(stored.due_at === null ? null : new Date(stored.due_at).toISOString()).toBe(item.deadline);
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
