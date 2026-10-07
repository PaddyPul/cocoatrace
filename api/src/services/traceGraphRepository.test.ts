import { describe, expect, it, vi } from 'vitest';
vi.mock('../db', () => ({ query: vi.fn(), getClient: vi.fn() }));
import { getClient } from '../db';
import { loadTraceGraph } from './traceGraphRepository';
import { TRACE_LIMITS } from '../modules/trace/limits';

const lot = (id: string) => ({
  id,
  lot_code: id,
  lot_type: 'source',
  product_name: 'Material',
  quantity_kg: 100,
});

describe('bounded connected trace reads', () => {
  it('loads the full connected component including co-inputs, but excludes unrelated lots', async () => {
    const edge = {
      id: 'e',
      source_lot_id: 'source',
      destination_lot_id: 'output',
      allocated_input_kg: 100,
      allocation_method: 'declared',
    };
    const run = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id,source_lot_id')) return { rows: [edge] };
      if (sql.includes('FROM material_lots ml')) {
        expect(params?.[0]).toEqual(['output', 'source']);
        return { rows: [lot('source'), lot('output')] };
      }
      if (sql.includes('FROM lot_genealogy_edges ge')) return { rows: [edge] };
      return { rows: [] };
    });
    const graph = await loadTraceGraph(run, ['output']);
    expect(graph.lots.map((item) => item.id)).toEqual(['source', 'output']);
    expect(run.mock.calls.some(([sql]) => sql.includes('SET LOCAL statement_timeout'))).toBe(true);
    for (const [sql, params] of run.mock.calls)
      if (sql.includes('SELECT') && !sql.includes('SET LOCAL'))
        expect(params?.at(-1)).toBeGreaterThan(0);
  });
  it('rejects a truncated rowset instead of returning partial genealogy', async () => {
    const run = vi.fn(async (sql: string) => ({
      rows: sql.includes('FROM material_lots ml')
        ? Array.from({ length: TRACE_LIMITS.lots + 1 }, (_, id) => lot(String(id)))
        : [],
    }));
    await expect(loadTraceGraph(run)).rejects.toThrow(/LOTS_LIMIT/);
  });
  it('converts PostgreSQL cancellation into explicit incomplete analysis', async () => {
    const run = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT'))
        throw Object.assign(new Error('canceling statement'), { code: '57014' });
      return { rows: [] };
    });
    await expect(loadTraceGraph(run, ['source'])).rejects.toMatchObject({
      code: 'TRACE_ANALYSIS_INCOMPLETE',
      analysis: { reason: 'DATABASE_TIMEOUT', safetyClearance: false },
    });
  });
});

it('rolls back and releases the read snapshot when PostgreSQL cancels analysis', async () => {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT')) throw Object.assign(new Error('cancelled'), { code: '57014' });
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  vi.mocked(getClient).mockResolvedValueOnce(
    client as unknown as Awaited<ReturnType<typeof getClient>>,
  );
  await expect(loadTraceGraph()).rejects.toMatchObject({ code: 'TRACE_ANALYSIS_INCOMPLETE' });
  expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  expect(client.query.mock.calls.map(([sql]) => sql)).not.toContain('COMMIT');
  expect(client.release).toHaveBeenCalledOnce();
});
