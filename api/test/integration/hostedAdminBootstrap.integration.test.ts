import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/db';
import { bootstrapAdmin } from '../../src/modules/operations/bootstrapAdmin';

// Isolated namespace: never delete, seed or update the suite's public identities.
const schema = `bootstrap_${randomUUID().replaceAll('-', '')}`;
const owner = { email: 'private-owner@example.test', password: 'Private-bootstrap-7946-unique!' };
beforeAll(async () => {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  for (const table of [
    'organizations',
    'users',
    'roles',
    'user_roles',
    'user_onboarding',
    'audit_events',
  ]) {
    await pool.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`);
  }
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
});

describe('hosted administrator installation transaction', () => {
  it('rolls back an audit failure, serializes concurrent installers and refuses a later password replacement', async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query(`SET search_path TO "${schema}", public`);
      await second.query(`SET search_path TO "${schema}", public`);
      await first.query(
        `ALTER TABLE audit_events ADD CONSTRAINT bootstrap_audit_unavailable CHECK (action <> 'installation.admin_bootstrapped')`,
      );
      await expect(bootstrapAdmin(first, owner)).rejects.toThrow();
      expect((await first.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(0);
      expect(
        (await first.query('SELECT count(*)::int AS count FROM organizations')).rows[0].count,
      ).toBe(0);
      await first.query('ALTER TABLE audit_events DROP CONSTRAINT bootstrap_audit_unavailable');
      const outcomes = await Promise.allSettled([
        bootstrapAdmin(first, owner),
        bootstrapAdmin(second, owner),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const users = await first.query('SELECT email,password_hash FROM users');
      expect(users.rows).toHaveLength(1);
      expect(users.rows[0].email).toBe(owner.email);
      expect(await bcrypt.compare(owner.password, users.rows[0].password_hash)).toBe(true);
      expect(
        (await first.query('SELECT count(*)::int AS count FROM audit_events')).rows[0].count,
      ).toBe(1);
      await expect(
        bootstrapAdmin(first, { ...owner, password: 'Replacement-password-should-not-work!' }),
      ).rejects.toThrow('empty installation');
      expect((await first.query('SELECT password_hash FROM users')).rows[0].password_hash).toBe(
        users.rows[0].password_hash,
      );
    } finally {
      await first.query('RESET search_path');
      await second.query('RESET search_path');
      first.release();
      second.release();
    }
  });
});
