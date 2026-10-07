import { describe, expect, it, vi } from 'vitest';
import { parseLotPage, readLotPage } from './lotPage';

const org = '00000000-0000-0000-0000-000000000001';
const row = (n: number) => ({
  id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  lot_code: `LOT-${n}`,
  lot_type: 'source',
  product_name: 'Peanut',
  quantity_kg: '10',
  batch_id: null,
  status: 'held',
  produced_at: '2026-10-07',
  owner_organization_id: org,
  owner_name: 'Seller',
  source_mode: null,
  source_label: null,
  downstream_lot_count: 0,
  distribution_count: 0,
});

describe('scoped keyset lot pages', () => {
  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
    { limit: ['50'] },
    { search: 'x'.repeat(81) },
    { search: ['cocoa'] },
    { search: '\n' },
    { cursor: 'x'.repeat(257) },
    { cursor: '%%%a' },
    { cursor: 'e30' },
    { order: 'name' },
  ])('rejects malformed or unbounded input %j', (input) => {
    expect(() => parseLotPage(input, org, false)).toThrow();
  });
  it('uses one bounded query, literal search and stable keyset order without global counts', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [row(1), row(2), row(3)] });
    const page = await readLotPage(
      execute,
      org,
      false,
      parseLotPage({ limit: '2', search: '  %_Peanut  ' }, org, false),
    );
    expect(page.items.map((item) => item.id)).toEqual([row(1).id, row(2).id]);
    expect(page.items[0].status).toBe('held');
    expect(page.hasMore).toBe(true);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain('WITH page AS MATERIALIZED');
    expect(sql).toContain('ml.id>$3::uuid');
    expect(sql).toContain('c.buyer_organization_id=$1');
    expect(sql).toContain('d.recipient_organization_id=$1');
    expect(params).toEqual([org, false, null, '%_peanut', '%\\%\\_peanut%', 3]);
    const next = parseLotPage(
      { limit: '2', search: '%_Peanut', cursor: page.nextCursor },
      org,
      false,
    );
    expect(next.after).toBe(row(2).id);
    expect(() =>
      parseLotPage({ cursor: page.nextCursor, search: '%_Peanut' }, 'another-org', false),
    ).toThrow();
    expect(() => parseLotPage({ cursor: page.nextCursor, search: 'cocoa' }, org, false)).toThrow();
    expect(() =>
      parseLotPage({ cursor: page.nextCursor, search: '%_Peanut' }, org, true),
    ).toThrow();
  });
  it('does not invent more pages for an exact full page or empty result', async () => {
    for (const rows of [[], [row(1), row(2)]]) {
      const page = await readLotPage(
        async () => ({ rows }),
        org,
        false,
        parseLotPage({ limit: '2' }, org, false),
      );
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeNull();
    }
  });
});
