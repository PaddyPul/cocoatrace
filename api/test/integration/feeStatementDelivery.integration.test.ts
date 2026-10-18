import { afterAll, describe, expect, it } from 'vitest';
import { pool, query } from '../../src/db';
import { authenticateSession } from '../../src/services/authSessionService';
import { inDatabaseTransaction } from '../../src/services/databaseTransaction';
import {
  enqueueFeeStatement,
  processFeeStatementEmails,
  requestFeeStatementDelivery,
  readDeliveryStatus,
} from '../../src/modules/feeStatementDelivery/service';
import type { EmailMessage, EmailSender } from '../../src/services/emailSender';
import {
  createActor,
  createSupply,
  createListing,
  createOffer,
  createContract,
} from './support/fixtures';

async function fixture() {
  const seller = await createActor({
    type: 'exporter',
    permissions: ['contract.read', 'payment.read'],
  });
  const buyer = await createActor({
    type: 'importer',
    permissions: ['contract.read', 'payment.read'],
  });
  const supply = await createSupply(seller, { quantityKg: 10 });
  const terms = {
    quantityKg: 10,
    pricePerKg: 5,
    currency: 'EUR' as const,
    incoterm: 'FOB' as const,
  };
  const listing = await createListing(seller, supply, {
    ...terms,
    origin: 'Tema',
    destination: 'Accra',
  });
  const offer = await createOffer(buyer, listing, terms);
  const contract = await createContract(seller, buyer, supply, listing, offer, terms);
  const fee = (
    await query(
      `INSERT INTO platform_fee_invoices(contract_id,fee_payer,payer_organization_id,policy_version,rate_bps,amount_total,currency,currency_minor_units,status,due_at,invoiced_at)
    VALUES($1,'seller',$2,'seller-completion-v2',200,1,'EUR',2,'invoiced',NOW(),NOW()) RETURNING id`,
      [contract, seller.organizationId],
    )
  ).rows[0].id as string;
  const queue = () =>
    inDatabaseTransaction(async (client) => {
      await client.query('SELECT id FROM sales_contracts WHERE id=$1 FOR UPDATE', [contract]);
      await enqueueFeeStatement(
        client,
        { id: seller.userId, organizationId: seller.organizationId },
        contract,
      );
    });
  return { seller, buyer, fee, contract, queue };
}
function sender(messages: EmailMessage[], fail = false): EmailSender {
  return {
    healthcheck: async () => {},
    send: async (message) => {
      if (fail) throw new Error('provider secret must not persist');
      messages.push(message);
      return { status: 'sent' };
    },
  };
}
afterAll(() => pool.end());
describe('durable authenticated commercial fee statement notices', () => {
  it('permits explicit payer delivery without exposing recipient details and rejects unrelated accounts', async () => {
    const f = await fixture();
    const payer = await authenticateSession(f.seller.token);
    if (!payer) throw new Error('Missing fixture session');
    expect(await requestFeeStatementDelivery(payer, f.contract)).toMatchObject({
      queued: 1,
      missingContact: false,
    });
    expect(await readDeliveryStatus(payer, f.contract)).toMatchObject({ queued: 1 });
    const outsider = await createActor({
      type: 'importer',
      permissions: ['contract.read', 'payment.read'],
    });
    const outside = await authenticateSession(outsider.token);
    if (!outside) throw new Error('Missing outsider session');
    await expect(readDeliveryStatus(outside, f.contract)).rejects.toThrow('Fee statement');
  });

  it('deduplicates transactional enqueue, excludes buyer contacts and sends a private generic link once under concurrent workers', async () => {
    const f = await fixture();
    await Promise.all([f.queue(), f.queue()]);
    const rows = (await query('SELECT * FROM fee_statement_email_outbox WHERE fee_id=$1', [f.fee]))
      .rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_user_id).toBe(f.seller.userId);
    const messages: EmailMessage[] = [];
    await Promise.all([
      processFeeStatementEmails(sender(messages), 100),
      processFeeStatementEmails(sender(messages), 100),
    ]);
    const ours = messages.filter((m) => m.to === f.seller.email);
    expect(ours).toHaveLength(1);
    expect(ours[0]).toMatchObject({ category: 'fee_statement' });
    expect(ours[0].text).toContain(`/deal-room/${f.contract}`);
    expect(ours[0].text).not.toContain('1.00');
    expect(ours[0].text).not.toContain('storage');
    expect(
      (
        await query('SELECT status,attempts FROM fee_statement_email_outbox WHERE fee_id=$1', [
          f.fee,
        ])
      ).rows[0],
    ).toEqual({ status: 'sent', attempts: 1 });
  });
  it('suppresses revoked payer permissions and void statements at send time', async () => {
    const f = await fixture();
    await f.queue();
    await query("UPDATE roles SET permissions=ARRAY['contract.read']::text[] WHERE id=$1", [
      f.seller.roleId,
    ]);
    const messages: EmailMessage[] = [];
    await processFeeStatementEmails(sender(messages), 100);
    expect(messages.filter((m) => m.to === f.seller.email)).toEqual([]);
    expect(
      (await query('SELECT status FROM fee_statement_email_outbox WHERE fee_id=$1', [f.fee]))
        .rows[0].status,
    ).toBe('suppressed');
    const g = await fixture();
    await g.queue();
    await query("UPDATE platform_fee_invoices SET status='void' WHERE id=$1", [g.fee]);
    await processFeeStatementEmails(sender(messages), 100);
    expect(messages.filter((m) => m.to === g.seller.email)).toEqual([]);
    const cancelled = await fixture();
    await cancelled.queue();
    await query("UPDATE platform_fee_invoices SET status='paid' WHERE id=$1", [cancelled.fee]);
    await query("UPDATE sales_contracts SET status='cancelled' WHERE id=$1", [cancelled.contract]);
    await processFeeStatementEmails(sender(messages), 100);
    expect(messages.filter((m) => m.to === cancelled.seller.email)).toEqual([]);
    expect(
      (
        await query('SELECT status FROM fee_statement_email_outbox WHERE fee_id=$1', [
          cancelled.fee,
        ])
      ).rows[0].status,
    ).toBe('suppressed');
  });
  it('retains provider failures with bounded retry and reclaims expired leases without exposing provider details', async () => {
    const f = await fixture();
    await f.queue();
    await processFeeStatementEmails(sender([], true), 100);
    expect(
      (
        await query(
          'SELECT status,last_error,attempts FROM fee_statement_email_outbox WHERE fee_id=$1',
          [f.fee],
        )
      ).rows[0],
    ).toEqual({ status: 'failed', last_error: 'SMTP_SUBMISSION_FAILED', attempts: 1 });
    await query(
      "UPDATE fee_statement_email_outbox SET status='sending',lease_token=uuid_generate_v4(),lease_expires_at=NOW()-INTERVAL '1 second' WHERE fee_id=$1",
      [f.fee],
    );
    const messages: EmailMessage[] = [];
    await processFeeStatementEmails(sender(messages), 100);
    expect(messages.filter((m) => m.to === f.seller.email)).toHaveLength(1);
    const missing = await fixture();
    await missing.queue();
    await query(
      "UPDATE fee_statement_email_outbox SET status='sending',lease_token=NULL,lease_expires_at=NULL WHERE fee_id=$1",
      [missing.fee],
    );
    await processFeeStatementEmails(sender(messages), 100);
    expect(messages.filter((m) => m.to === missing.seller.email)).toHaveLength(1);

    const g = await fixture();
    await g.queue();
    await query('UPDATE fee_statement_email_outbox SET attempts=8 WHERE fee_id=$1', [g.fee]);
    await processFeeStatementEmails(sender(messages), 100);
    expect(
      (await query('SELECT status FROM fee_statement_email_outbox WHERE fee_id=$1', [g.fee]))
        .rows[0].status,
    ).toBe('failed_terminal');
  });
  it('rolls queue creation back with its transaction and records missing eligible contacts without claiming delivery', async () => {
    const f = await fixture();
    await expect(
      inDatabaseTransaction(async (client) => {
        await enqueueFeeStatement(
          client,
          { id: f.seller.userId, organizationId: f.seller.organizationId },
          f.contract,
        );
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      (await query('SELECT id FROM fee_statement_email_outbox WHERE fee_id=$1', [f.fee])).rows,
    ).toEqual([]);
    await query('UPDATE users SET active=false WHERE id=$1', [f.seller.userId]);
    await f.queue();
    expect(
      (await query('SELECT id FROM fee_statement_email_outbox WHERE fee_id=$1', [f.fee])).rows,
    ).toEqual([]);
    expect(
      (
        await query(
          "SELECT id FROM audit_events WHERE entity_id=$1 AND action='fee.statement.email.contact_missing'",
          [f.contract],
        )
      ).rows,
    ).toHaveLength(1);
  });
});
