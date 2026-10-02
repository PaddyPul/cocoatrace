import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ getClient: vi.fn(), query: vi.fn() }));
vi.mock('../../db', () => db);
import { inTradeTransaction, recordTradeAudit } from './transaction';

describe('critical trading transaction boundary', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rolls back the inventory mutation if its critical audit cannot be persisted', async () => {
    const events: string[] = [];
    const failure = new Error('audit storage unavailable');
    const client = { query: vi.fn(async (sql: string) => {
      events.push(sql);
      if (sql.includes('INSERT INTO audit_events')) throw failure;
      return { rows: [] };
    }), release: vi.fn() };
    db.getClient.mockResolvedValue(client);
    await expect(inTradeTransaction(async (transaction) => {
      await transaction.query('UPDATE batch_holdings SET status=\'committed\'');
      await recordTradeAudit(transaction, { id: 'actor', organizationId: 'organization' }, 'offer.accept', 'trade_offer', 'offer');
    })).rejects.toBe(failure);
    expect(events).toContain('ROLLBACK');
    expect(events).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not return a successful deal when commit fails', async () => {
    const failure = new Error('commit rejected');
    const client = { query: vi.fn(async (sql: string) => {
      if (sql === 'COMMIT') throw failure;
      return { rows: [] };
    }), release: vi.fn() };
    db.getClient.mockResolvedValue(client);
    await expect(inTradeTransaction(async () => ({ contractId: 'contract' }))).rejects.toBe(failure);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
