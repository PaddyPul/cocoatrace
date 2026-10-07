import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { getClient } from '../../db';
import { AppError, ValidationError } from '../../errors';

export type Execute = (
  sql: string,
  parameters?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;
export interface PageInput {
  limit: number;
  search: string;
  cursor?: { id: string; key: string };
  scope: string;
  sort: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function text(value: unknown, name: string, maximum = 80): string {
  if (value === undefined) return '';
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    throw new ValidationError(`Invalid ${name}; maximum ${maximum} characters`);
  return value.trim();
}
export function flag(value: unknown, name: string): boolean {
  if (value === undefined || value === 'false') return false;
  if (value !== 'true') throw new ValidationError(`Invalid ${name}`);
  return true;
}
export function quantity(value: unknown): string {
  if (value === undefined || value === '') return '0';
  if (typeof value !== 'string' || !/^\d{1,12}(\.\d{1,4})?$/.test(value))
    throw new ValidationError('Invalid minimum quantity');
  return value;
}
export const literal = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;
export const normalizeCommodity = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(beans?|nuts?|kernels?|raw)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
export const normalizedCommoditySql = (column: string) =>
  `trim(regexp_replace(regexp_replace(lower(${column}), '\\m(beans?|nuts?|kernels?|raw)\\M', '', 'g'), '\\s+', ' ', 'g'))`;

export function parsePage(
  parameters: Record<string, unknown>,
  scopeValues: unknown[],
  allowed: string[],
  sorts = ['id'],
): PageInput {
  for (const key of Object.keys(parameters))
    if (!['limit', 'search', 'cursor', 'sort', ...allowed].includes(key))
      throw new ValidationError('Unknown page parameter');
  const limit = parameters.limit ?? '50';
  if (typeof limit !== 'string' || !/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 100)
    throw new ValidationError('Page limit must be between 1 and 100');
  const search = text(parameters.search, 'search').toLowerCase();
  const sort = parameters.sort ?? sorts[0];
  if (typeof sort !== 'string' || !sorts.includes(sort))
    throw new ValidationError('Invalid page order');
  const scope = createHash('sha256')
    .update(JSON.stringify([...scopeValues, search, sort]))
    .digest('hex');
  let cursor: PageInput['cursor'];
  if (parameters.cursor !== undefined) {
    const encoded = text(parameters.cursor, 'cursor', 512);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new ValidationError('Invalid page cursor');
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (!decoded || typeof decoded !== 'object') throw new Error();
      const value = decoded as Record<string, unknown>;
      if (
        value.v !== 1 ||
        value.scope !== scope ||
        typeof value.id !== 'string' ||
        !UUID.test(value.id) ||
        typeof value.key !== 'string' ||
        value.key.length > 32 ||
        !/^(|\d{1,16}(\.\d{1,8})?)$/.test(value.key) ||
        Object.keys(value).length !== 4
      )
        throw new Error();
      cursor = { id: value.id, key: value.key };
      if ((sort === 'id' && cursor.key !== '') || (sort !== 'id' && !cursor.key)) throw new Error();
    } catch {
      throw new ValidationError('Invalid page cursor; restart the search');
    }
  }
  return { limit: Number(limit), search, sort, scope, cursor };
}
export function pageResult(rows: Record<string, unknown>[], input: PageInput, key = '') {
  const items = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore
      ? Buffer.from(
          JSON.stringify({
            v: 1,
            scope: input.scope,
            id: last.id,
            key: key ? String(last[key]) : '',
          }),
        ).toString('base64url')
      : null,
  };
}
export async function withCatalogRead<T>(read: (execute: Execute) => Promise<T>): Promise<T> {
  const client = await getClient();
  const started = performance.now();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='2000ms'");
    const result = await read(async (sql, parameters) => {
      if (performance.now() - started > 5000)
        throw new AppError(
          'Catalog read timed out. Retry a narrower search.',
          503,
          'CATALOG_READ_TIMEOUT',
        );
      const result = await client.query(sql, parameters);
      if (result.rows.length > 5000)
        throw new AppError(
          'Linked records exceed the read limit. Contact the platform operator.',
          422,
          'CATALOG_READ_LIMIT',
        );
      if (performance.now() - started > 5000)
        throw new AppError(
          'Catalog read timed out. Retry a narrower search.',
          503,
          'CATALOG_READ_TIMEOUT',
        );
      return result;
    });
    if (performance.now() - started > 5000)
      throw new AppError(
        'Catalog read timed out. Retry a narrower search.',
        503,
        'CATALOG_READ_TIMEOUT',
      );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '57014')
      throw new AppError(
        'Catalog read timed out. Retry a narrower search.',
        503,
        'CATALOG_READ_TIMEOUT',
      );
    throw error;
  } finally {
    client.release();
  }
}
