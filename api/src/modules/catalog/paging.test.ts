import { describe, expect, it, vi } from 'vitest';
const { client } = vi.hoisted(() => ({ client: { query: vi.fn(), release: vi.fn() } }));
vi.mock('../../db', () => ({ getClient: vi.fn(async () => client) }));
import { literal, normalizeCommodity, pageResult, parsePage, withCatalogRead } from './paging';

const org = '00000000-0000-0000-0000-000000000001';
describe('bounded catalog policy', () => {
  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: ['20'] },
    { search: 'x'.repeat(81) },
    { cursor: 'x'.repeat(513) },
    { search: ['peanut'] },
    { sort: 'random' },
    { unknown: 'x' },
    { cursor: 'e30' },
  ])('rejects malformed query %j', (parameters) => {
    expect(() => parsePage(parameters, [org], [])).toThrow();
  });
  it('binds cursor position to tenant, filters and order while preserving exact decimal keys', () => {
    const parameters = { limit: '1', search: ' Peanut ', sort: 'price' };
    const input = parsePage(parameters, [org, { currency: 'EUR' }], [], ['id', 'price']);
    const first = pageResult([{ id: org, price: '12345678.1234' }, { id: org }], input, 'price');
    expect(first.items).toHaveLength(1);
    expect(
      parsePage(
        { ...parameters, cursor: first.nextCursor },
        [org, { currency: 'EUR' }],
        [],
        ['id', 'price'],
      ).cursor?.key,
    ).toBe('12345678.1234');
    expect(() =>
      parsePage(
        { ...parameters, cursor: first.nextCursor },
        ['other', { currency: 'EUR' }],
        [],
        ['id', 'price'],
      ),
    ).toThrow();
    expect(() =>
      parsePage(
        { ...parameters, cursor: first.nextCursor },
        [org, { currency: 'USD' }],
        [],
        ['id', 'price'],
      ),
    ).toThrow();
    expect(() =>
      parsePage(
        { ...parameters, sort: 'id', cursor: first.nextCursor },
        [org, { currency: 'EUR' }],
        [],
        ['id', 'price'],
      ),
    ).toThrow();
  });
  it('uses literal wildcards, matching commodity normalization and no false next page', () => {
    expect(literal('a%_\\')).toBe('%a\\%\\_\\\\%');
    expect(normalizeCommodity(' Raw SHEA nuts ')).toBe('shea');
    expect(pageResult([{ id: org }], parsePage({ limit: '1' }, [org], [])).nextCursor).toBeNull();
  });
  it('uses a read-only snapshot and releases the client after commit', async () => {
    client.query.mockReset().mockResolvedValue({ rows: [] });
    client.release.mockClear();
    expect(await withCatalogRead(async (execute) => execute('SELECT 1'))).toEqual({ rows: [] });
    expect(client.query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      "SET LOCAL statement_timeout='2000ms'",
      'SELECT 1',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('rolls back timeout errors instead of returning an empty catalog', async () => {
    client.query.mockReset().mockImplementation(async (sql) => {
      if (sql === 'SELECT slow') throw { code: '57014' };
      return { rows: [] };
    });
    client.release.mockClear();
    await expect(withCatalogRead((execute) => execute('SELECT slow'))).rejects.toMatchObject({
      code: 'CATALOG_READ_TIMEOUT',
      statusCode: 503,
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('refuses linked-record overflow and rolls back rather than truncating trust', async () => {
    client.query.mockReset().mockImplementation(async (sql) => ({
      rows: sql === 'SELECT links' ? Array.from({ length: 5001 }, () => ({ id: org })) : [],
    }));
    await expect(withCatalogRead((execute) => execute('SELECT links'))).rejects.toMatchObject({
      code: 'CATALOG_READ_LIMIT',
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
