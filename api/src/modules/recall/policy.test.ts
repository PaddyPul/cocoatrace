import { describe, expect, it } from 'vitest';
import { canInitiateRecall, canManageRecall, hasNetworkRecallAuthority } from './policy';
import type { RecallActor } from './responseModel';
const actor = (permissions: string[], organizationId = 'own'): RecallActor => ({
  id: 'user',
  organizationId,
  permissions,
});
const notice = { initiated_by_organization_id: 'own' };
describe('current recall operation authority', () => {
  it.each([
    [[], false, false, false],
    [['recall.read'], false, false, false],
    [['recall.manage'], true, true, false],
    [['recall.manage.all'], false, true, true],
    [['recall.manage', 'recall.manage.all'], true, true, true],
    [['*'], true, true, true],
  ] as const)(
    'separates route entry, tenant management and explicit network scope for %j',
    (permissions, initiate, manage, network) => {
      const current = actor([...permissions]);
      expect(canInitiateRecall(current)).toBe(initiate);
      expect(canManageRecall(current, notice)).toBe(manage);
      expect(hasNetworkRecallAuthority(current)).toBe(network);
    },
  );
  it('does not let an unrelated tenant manager contact or resolve another recall', () => {
    expect(canManageRecall(actor(['recall.manage'], 'other'), notice)).toBe(false);
    expect(canManageRecall(actor(['recall.manage.all'], 'other'), notice)).toBe(true);
  });
});
