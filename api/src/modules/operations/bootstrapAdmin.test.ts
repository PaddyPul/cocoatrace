import { describe, expect, it, vi } from 'vitest';
import { bootstrapAdmin } from './bootstrapAdmin';

const input = { email: 'owner@example.test', password: 'Unique-demo-administrator-7946!' };
function database(occupied = false, failAudit = false) {
  const query = vi.fn(async (sql: string, _values?: unknown[]) => {
    if (sql.startsWith('SELECT EXISTS')) return { rows: [{ occupied }] };
    if (sql.includes('INSERT INTO audit_events') && failAudit) throw new Error('Audit unavailable');
    if (sql.includes('RETURNING id')) return { rows: [{ id: 'fixture-id' }] };
    return { rows: [] };
  });
  return { query };
}

describe('private installation administrator', () => {
  it('refuses invalid or known demo credentials before touching the database', async () => {
    const client = database();
    for (const password of ['Password123!', 'short', 'é'.repeat(40)]) {
      await expect(bootstrapAdmin(client, { ...input, password })).rejects.toThrow('valid email');
    }
    expect(client.query).not.toHaveBeenCalled();
  });
  it('locks identities and refuses an occupied installation without changing accounts', async () => {
    const client = database(true);
    await expect(bootstrapAdmin(client, input)).rejects.toThrow('empty installation');
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements[1]).toContain('LOCK TABLE organizations, users, roles, user_roles');
    expect(statements.some((sql) => sql.includes('INSERT'))).toBe(false);
    expect(statements.at(-1)).toBe('ROLLBACK');
  });
  it('hashes the password and commits identity, role, onboarding and audit together', async () => {
    const client = database();
    await bootstrapAdmin(client, input);
    const calls = client.query.mock.calls;
    const user = calls.find(([sql]) => sql.includes('INSERT INTO users'));
    expect(user?.[1]?.[2]).toMatch(/^\$2[aby]\$12\$/);
    expect(JSON.stringify(calls)).not.toContain(input.password);
    expect(calls.some(([sql]) => sql.includes('INSERT INTO audit_events'))).toBe(true);
    expect(calls.at(-1)?.[0]).toBe('COMMIT');
  });
  it('rolls back the whole bootstrap if the audit cannot be persisted', async () => {
    const client = database(false, true);
    await expect(bootstrapAdmin(client, input)).rejects.toThrow('Audit unavailable');
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
  });
});
