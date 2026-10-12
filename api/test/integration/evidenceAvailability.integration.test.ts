import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { getClient, pool, query } from '../../src/db';
import { evidenceStorage } from '../../src/services/evidenceStorage';
import { authenticator } from '../../src/testing/webauthnFixture';
type Actor = { organizationId: string; userId: string; token: string };
type Deal = { contractId: string; paymentId: string; installmentId: string; shipmentId: string };
let seller: Actor, buyer: Actor, outsider: Actor;
const keys: string[] = [],
  evidenceIds: string[] = [];
async function actor(type: string): Promise<Actor> {
  const tag = crypto.randomUUID(),
    email = `availability-${tag}@integration.test`,
    password = 'AvailabilityFixture123!';
  const org = (
    await query(
      "INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",
      ['Availability ' + tag, type],
    )
  ).rows[0].id;
  const user = (
    await query(
      'INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',
      [org, email, await bcrypt.hash(password, 4), 'Availability fixture'],
    )
  ).rows[0].id;
  const role = (
    await query("INSERT INTO roles(name,permissions) VALUES($1,ARRAY['*']) RETURNING id", [
      'availability-' + tag,
    ])
  ).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user, role]);
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.accessToken;
  const options = await request(app)
    .post('/auth/mfa/registration/options')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: password });
  expect(options.status, JSON.stringify(options.body)).toBe(200);
  const enrolled = await request(app)
    .post('/auth/mfa/registration/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({
      response: authenticator().registration(options.body.challenge),
      label: 'Availability test key',
    });
  expect(enrolled.status, JSON.stringify(enrolled.body)).toBe(200);
  return { organizationId: org, userId: user, token };
}
const post = (path: string, who: Actor, body = {}) =>
  request(app).post(path).set('Authorization', `Bearer ${who.token}`).send(body);
async function deal(plan = 'pay_before_dispatch'): Promise<Deal> {
  const batch = (
    await query(
      "INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode,source_name,source_country) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory','Availability fixture','GH') RETURNING id",
      [seller.organizationId],
    )
  ).rows[0].id;
  const holding = (
    await query(
      'INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',
      [batch, seller.organizationId],
    )
  ).rows[0].id;
  const listing = (
    await query(
      "INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'EUR','FOB','Tema','Rotterdam') RETURNING id",
      [seller.organizationId, holding],
    )
  ).rows[0].id;
  const offer = (
    await query(
      "INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,currency,valid_until) VALUES($1,$2,4,5,'EUR',NOW()+INTERVAL '1 day') RETURNING id",
      [listing, buyer.organizationId],
    )
  ).rows[0].id;
  const accepted = await post(`/offers/${offer}/accept`, seller);
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  const contract = accepted.body.contract,
    shipment = accepted.body.shipment;
  const terms = await request(app)
    .patch(`/contracts/${contract.id}/payment-terms`)
    .set('Authorization', `Bearer ${seller.token}`)
    .send({
      paymentPlan: plan,
      depositPercentage: 20,
      creditDays: 0,
      paymentEvidenceRequired: true,
    });
  expect(terms.status, JSON.stringify(terms.body)).toBe(200);
  expect((await post(`/contracts/${contract.id}/payment-terms/confirm`, buyer)).status).toBe(200);
  const payment = (
    await query('SELECT id FROM payment_requests WHERE contract_id=$1', [contract.id])
  ).rows[0].id;
  const installment = (
    await query(
      'SELECT id FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number LIMIT 1',
      [payment],
    )
  ).rows[0].id;
  return {
    contractId: contract.id,
    paymentId: payment,
    installmentId: installment,
    shipmentId: shipment.id,
  };
}
async function proof(d: Deal, type = 'payment_proof', who = buyer) {
  const id = crypto.randomUUID(),
    key = `evidence/test/${crypto.randomUUID()}`,
    content = Buffer.from('%PDF-1.7\nAvailability fixture');
  keys.push(key);
  evidenceIds.push(id);
  await evidenceStorage().put(key, content, 'application/pdf');
  await query(
    `INSERT INTO evidence_items(id,uploader_user_id,uploader_organization_id,type,file_name,file_size_bytes,mime_type,sha256_hash,storage_key,storage_provider,validation_status,malware_scan_status,linked_entity_type,linked_entity_id,claim_description) VALUES($1,$2,$3,$4,'availability.pdf',$5,'application/pdf','sha256:availability',$6,$7,'validated','clean','contract',$8,'Availability fixture')`,
    [
      id,
      who.userId,
      who.organizationId,
      type,
      content.length,
      key,
      evidenceStorage().provider,
      d.contractId,
    ],
  );
  return { id, key };
}
async function unlocked(d: Deal, ids: string[]) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM sales_contracts WHERE id=$1 FOR UPDATE NOWAIT', [
      d.contractId,
    ]);
    await client.query('SELECT id FROM payment_requests WHERE id=$1 FOR UPDATE NOWAIT', [
      d.paymentId,
    ]);
    await client.query('SELECT id FROM payment_installments WHERE id=$1 FOR UPDATE NOWAIT', [
      d.installmentId,
    ]);
    if (ids.length)
      await client.query(
        'SELECT id FROM evidence_items WHERE id=ANY($1::uuid[]) FOR UPDATE NOWAIT',
        [ids],
      );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}
async function duringPreflight(operation: () => Promise<Response>, work: () => Promise<void>) {
  let entered!: () => void, finish!: (value: boolean) => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const stalled = new Promise<boolean>((resolve) => {
    finish = resolve;
  });
  const storage = evidenceStorage(),
    original = storage.exists.bind(storage);
  let first = true;
  const spy = vi.spyOn(storage, 'exists').mockImplementation(async (key) => {
    if (first) {
      first = false;
      entered();
      return stalled;
    }
    return original(key);
  });
  const running = operation();
  try {
    await Promise.race([
      started,
      running.then((response) => {
        throw new Error(
          `Preflight was not entered: ${response.status} ${JSON.stringify(response.body)}`,
        );
      }),
    ]);
    await work();
    finish(true);
    return await running;
  } finally {
    finish(true);
    await running;
    spy.mockRestore();
  }
}
beforeAll(async () => {
  seller = await actor('exporter');
  buyer = await actor('importer');
  outsider = await actor('importer');
});
afterAll(async () => {
  try {
    if (keys.length)
      await query('DELETE FROM evidence_object_cleanup WHERE object_key=ANY($1::text[])', [keys]);
    if (evidenceIds.length) {
      await query(
        'UPDATE payment_installments SET payment_evidence_id=NULL WHERE payment_evidence_id=ANY($1::uuid[])',
        [evidenceIds],
      );
      await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])', [evidenceIds]);
    }
    for (const key of keys) await evidenceStorage().delete(key);
  } finally {
    await pool.end();
  }
});
describe('provider evidence availability outside trade transactions with fresh authoritative proof checks', () => {
  it('payment submission checks provider metadata before holding any contract, payment, installment or proof lock', async () => {
    const d = await deal(),
      p = await proof(d);
    const body = { transactionReference: `AVAIL-${d.installmentId}`, evidenceId: p.id };
    const response = await duringPreflight(
      () => post(`/payment-installments/${d.installmentId}/submit`, buyer, body).then((r) => r),
      () => unlocked(d, [p.id]),
    );
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const spy = vi
      .spyOn(evidenceStorage(), 'exists')
      .mockRejectedValue(new Error('Idempotent replay must not need provider IO'));
    try {
      expect(
        (await post(`/payment-installments/${d.installmentId}/submit`, buyer, body)).status,
      ).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it.each(['scan', 'review', 'key', 'cleanup'] as const)(
    'payment submission rechecks %s after provider preflight and never commits stale proof',
    async (change) => {
      const d = await deal(),
        p = await proof(d);
      const response = await duringPreflight(
        () =>
          post(`/payment-installments/${d.installmentId}/submit`, buyer, {
            transactionReference: `STALE-${d.installmentId}`,
            evidenceId: p.id,
          }).then((r) => r),
        async () => {
          await unlocked(d, [p.id]);
          if (change === 'scan')
            await query("UPDATE evidence_items SET malware_scan_status='infected' WHERE id=$1", [
              p.id,
            ]);
          else if (change === 'review')
            await query("UPDATE evidence_items SET review_status='rejected' WHERE id=$1", [p.id]);
          else if (change === 'cleanup') {
            await query(
              `INSERT INTO evidence_object_cleanup(object_key,organization_id,bytes,storage_provider,evidence_id,state,reason) SELECT storage_key,uploader_organization_id,file_size_bytes,storage_provider,id,'pending','upload_rejected' FROM evidence_items WHERE id=$1`,
              [p.id],
            );
          } else {
            const replacement = `evidence/test/${crypto.randomUUID()}`;
            keys.push(replacement);
            await query('UPDATE evidence_items SET storage_key=$2 WHERE id=$1', [
              p.id,
              replacement,
            ]);
          }
        },
      );
      expect(response.status, JSON.stringify(response.body)).toBe(400);
      expect(
        (
          await query('SELECT status,payment_evidence_id FROM payment_installments WHERE id=$1', [
            d.installmentId,
          ])
        ).rows[0],
      ).toMatchObject({ status: 'due', payment_evidence_id: null });
    },
  );
  it('receipt confirmation checks provider availability without locks and rejects proof revoked during that check', async () => {
    const d = await deal(),
      p = await proof(d);
    expect(
      (
        await post(`/payment-installments/${d.installmentId}/submit`, buyer, {
          transactionReference: `CONFIRM-${d.installmentId}`,
          evidenceId: p.id,
        })
      ).status,
    ).toBe(200);
    const response = await duringPreflight(
      () => post(`/payment-installments/${d.installmentId}/confirm`, seller).then((r) => r),
      async () => {
        await unlocked(d, [p.id]);
        await query("UPDATE evidence_items SET review_status='rejected' WHERE id=$1", [p.id]);
      },
    );
    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(
      (await query('SELECT status FROM payment_installments WHERE id=$1', [d.installmentId]))
        .rows[0].status,
    ).toBe('payment_submitted');
  });
  it('document presentation performs no provider read under trade locks and rejects a changed document key', async () => {
    const d = await deal('documentary_collection');
    const proofs = [
      await proof(d, 'commercial_invoice', seller),
      await proof(d, 'packing_list', seller),
      await proof(d, 'transport_document', seller),
    ];
    await query(
      "UPDATE shipments SET current_milestone='departed',transport_document_reference='AVAILABILITY-DOC' WHERE id=$1",
      [d.shipmentId],
    );
    const response = await duringPreflight(
      () => post(`/payment-requests/${d.paymentId}/submit-documents`, seller).then((r) => r),
      async () => {
        await unlocked(
          d,
          proofs.map((p) => p.id),
        );
        const replacement = `evidence/test/${crypto.randomUUID()}`;
        keys.push(replacement);
        await query('UPDATE evidence_items SET storage_key=$2 WHERE id=$1', [
          proofs[0].id,
          replacement,
        ]);
      },
    );
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(
      (
        await query('SELECT documents_presented_at FROM payment_requests WHERE id=$1', [
          d.paymentId,
        ])
      ).rows[0].documents_presented_at,
    ).toBeNull();
  });
  it('delivery discrepancy checks provider metadata before locking and rejects newly infected proof', async () => {
    const d = await deal(),
      p = await proof(d, 'delivery_proof');
    await query("UPDATE sales_contracts SET status='delivered' WHERE id=$1", [d.contractId]);
    await query("UPDATE shipments SET current_milestone='delivered' WHERE id=$1", [d.shipmentId]);
    const response = await duringPreflight(
      () =>
        post(`/contracts/${d.contractId}/delivery/discrepancy`, buyer, {
          kind: 'shortage',
          receivedQuantityKg: 3,
          reason: 'One kilogram was missing from delivery',
          evidenceIds: [p.id],
        }).then((r) => r),
      async () => {
        await unlocked(d, [p.id]);
        await query("UPDATE evidence_items SET malware_scan_status='infected' WHERE id=$1", [p.id]);
      },
    );
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(
      (
        await query(
          'SELECT COUNT(*)::int AS count FROM delivery_discrepancies WHERE contract_id=$1',
          [d.contractId],
        )
      ).rows[0].count,
    ).toBe(0);
  });
  it('unrelated organizations and wrong contract parties never trigger provider checks for private proof', async () => {
    const d = await deal(),
      p = await proof(d);
    const spy = vi
      .spyOn(evidenceStorage(), 'exists')
      .mockRejectedValue(new Error('Unauthorized actor must not check private objects'));
    try {
      for (const actor of [seller, outsider])
        expect(
          (
            await post(`/payment-installments/${d.installmentId}/submit`, actor, {
              transactionReference: 'UNRELATED',
              evidenceId: p.id,
            })
          ).status,
        ).toBe(404);
      for (const actor of [buyer, outsider])
        expect((await post(`/payment-installments/${d.installmentId}/confirm`, actor)).status).toBe(
          404,
        );
      expect(
        (await post(`/payment-requests/${d.paymentId}/submit-documents`, outsider)).status,
      ).toBe(404);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
