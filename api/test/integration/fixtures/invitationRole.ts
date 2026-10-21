import crypto from 'node:crypto';
import { query } from '../../../src/db';

/** A local invitation FK fixture; never depend on migration seeds or another suite. */
export async function createInvitationRoleFixture(): Promise<string> {
  const result = await query<{ id: string }>(
    'INSERT INTO roles(name,permissions) VALUES($1,ARRAY[]::text[]) RETURNING id',
    [`invitation-fixture-${crypto.randomUUID()}`],
  );
  const role = result.rows[0];
  if (!role) throw new Error('Invitation role fixture was not created');
  return role.id;
}
