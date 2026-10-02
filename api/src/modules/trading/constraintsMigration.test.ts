import { describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import { up, down } from '../../migrations/020_trade_integrity_constraints';

describe('trade integrity migration safety', () => {
  it('refuses invalid legacy stock before adding any constraints or changing records', async () => {
    const raw = vi.fn(async (sql: string) => ({ rows: sql.includes('SELECT id FROM batch_holdings') ? [{ id: 'invalid-legacy-holding' }] : [] }));
    await expect(up({ raw } as unknown as Knex)).rejects.toThrow('invalid-legacy-holding');
    expect(raw.mock.calls.every(([sql]) => !/ALTER|UPDATE|DELETE|INSERT/i.test(sql))).toBe(true);
  });

  it('refuses duplicate agreements without selecting one or deleting any customer agreement', async () => {
    const raw = vi.fn(async (sql: string) => ({ rows: sql.includes('HAVING COUNT(*) > 1') ? [{ offer_id: 'duplicated-offer' }] : [] }));
    await expect(up({ raw } as unknown as Knex)).rejects.toThrow('duplicated-offer');
    expect(raw.mock.calls.every(([sql]) => !/ALTER|UPDATE|DELETE|INSERT/i.test(sql))).toBe(true);
  });

  it('refuses automatic rollback that would silently remove integrity protection', async () => {
    await expect(down()).rejects.toThrow('reviewed forward migration');
  });
});
