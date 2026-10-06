import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateSession, type AuthenticatedActor } from '../../services/authSessionService';
import { authenticateReviewers } from './reviewers';
vi.mock('../../services/authSessionService', () => ({ authenticateSession: vi.fn() }));
const actor = (id: string) =>
  ({
    id,
    organizationId: 'org',
    sessionId: `session-${id}`,
    permissions: ['*'],
    mfa: { required: true, enrolled: true, verified: true, fresh: true },
  }) as AuthenticatedActor;
beforeEach(() => vi.resetAllMocks());
describe('independent reviewer boundary shared by recovery and access lifecycle', () => {
  it('accepts two distinct freshly verified platform administrators', async () => {
    vi.mocked(authenticateSession)
      .mockResolvedValueOnce(actor('first'))
      .mockResolvedValueOnce(actor('second'));
    expect(
      (await authenticateReviewers(['one', 'two'], 'target')).map((value) => value.id),
    ).toEqual(['first', 'second']);
  });
  it.each(['same', 'target', 'stale', 'ordinary', 'revoked'])(
    'rejects %s reviewer approval',
    async (failure) => {
      const first = actor('first');
      let second: AuthenticatedActor | null = actor('second');
      if (failure === 'same') second = actor('first');
      if (failure === 'target') second = actor('target');
      if (failure === 'stale')
        second.mfa = { required: true, enrolled: true, verified: true, fresh: false };
      if (failure === 'ordinary') second.permissions = ['organization.admin'];
      if (failure === 'revoked') second = null;
      vi.mocked(authenticateSession).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      await expect(authenticateReviewers(['one', 'two'], 'target')).rejects.toMatchObject({
        code: 'REVIEWERS_REQUIRED',
      });
    },
  );
});
