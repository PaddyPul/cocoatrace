import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashObject } from '../../services/audit';
import { createOrganization } from '../organizationWorkflow/commands';
import { updateOnboarding } from './commands';

const db = vi.hoisted(() => ({ getClient: vi.fn(), query: vi.fn() }));
vi.mock('../../db', () => db);
const actor = { id: 'user-1', organizationId: 'actor-org' };
const organization = { name: 'Cooperative', type: 'cooperative' as const, jurisdiction: 'GH' };
const completed = {
  status: 'completed' as const,
  currentStep: 4,
  pilotMode: true,
  primaryGoal: 'Trace cocoa',
};

describe('organization and onboarding transactional audits', () => {
  beforeEach(() => vi.clearAllMocks());
  for (const workflow of [
    {
      name: 'organization creation',
      action: 'organization.create',
      entityType: 'organization',
      entityId: 'org-created',
      table: 'organizations',
      run: () => createOrganization(actor, organization),
    },
    {
      name: 'completed onboarding',
      action: 'onboarding.complete',
      entityType: 'user',
      entityId: actor.id,
      table: 'user_onboarding',
      run: () => updateOnboarding(actor, completed),
    },
  ]) {
    for (const auditFails of [false, true]) {
      it(`${auditFails ? 'rolls back' : 'commits'} ${workflow.name} ${auditFails ? 'when its audit fails' : 'with its audit'}`, async () => {
        const row = { id: 'org-created', user_id: actor.id };
        const persisted: string[] = [];
        let pending: string[] = [];
        const failure = new Error('audit unavailable');
        const query = vi.fn(async (sql: string, _parameters?: unknown[]) => {
          if (sql === 'BEGIN') pending = [];
          else if (sql === 'ROLLBACK') pending = [];
          else if (sql === 'COMMIT') persisted.push(...pending);
          else if (sql.includes('INSERT INTO audit_events')) {
            if (auditFails) throw failure;
            pending.push('audit');
          } else if (sql.includes(`INSERT INTO ${workflow.table}`)) pending.push('business');
          else throw new Error(`Unexpected SQL: ${sql}`);
          return { rows: [row] };
        });
        const release = vi.fn();
        db.getClient.mockResolvedValue({ query, release });
        if (auditFails) await expect(workflow.run()).rejects.toBe(failure);
        else await expect(workflow.run()).resolves.toBe(row);
        expect(persisted).toEqual(auditFails ? [] : ['business', 'audit']);
        expect(
          query.mock.calls.map(([sql]) =>
            sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK'
              ? sql
              : sql.includes('audit_events')
                ? 'audit'
                : 'business',
          ),
        ).toEqual(['BEGIN', 'business', 'audit', auditFails ? 'ROLLBACK' : 'COMMIT']);
        expect(query).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining('INSERT INTO audit_events'),
          [
            actor.id,
            actor.organizationId,
            workflow.action,
            workflow.entityType,
            workflow.entityId,
            hashObject({ action: workflow.action, entityId: workflow.entityId }),
            '{}',
          ],
        );
        expect(db.query).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledOnce();
      });
    }
  }
  it('preserves non-completed onboarding without adding an audit or transaction', async () => {
    const row = { user_id: actor.id, status: 'in_progress' };
    db.query.mockResolvedValue({ rows: [row] });
    await expect(
      updateOnboarding(actor, { status: 'in_progress', currentStep: 2, pilotMode: false }),
    ).resolves.toBe(row);
    expect(db.getClient).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('INSERT INTO user_onboarding'),
      [actor.id, 'in_progress', 2, null, false],
    );
  });
});
