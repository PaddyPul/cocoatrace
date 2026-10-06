import { describe, expect, it, vi } from 'vitest';
import { decidePrivilegedAccess, privilegedDecisionSchema } from './privilegedLifecycle';
import { authenticateReviewers } from '../mfa/reviewers';
vi.mock('../mfa/reviewers', () => ({
  authenticateReviewers: vi.fn(),
  lockAccessDecisions: vi.fn(),
  lockReviewerAssurance: vi.fn(),
}));
const valid = {
  kind: 'users',
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  action: 'suspend',
  ticket: 'SEC_123',
  reason: 'Independently reviewed compromise',
  reviewerTokens: ['secret-one', 'secret-two'],
};
describe('reviewed privileged access input boundary', () => {
  it.each([
    { ...valid, kind: 'arbitrary_table' },
    { ...valid, id: 'invalid' },
    { ...valid, action: 'activate' },
    { ...valid, kind: 'organizations', action: 'deactivate' },
    { ...valid, reviewerTokens: ['single'] },
    { ...valid, ticket: 'contains personal data@example.test' },
    { ...valid, extra: true },
    { ...valid, reason: 'short' },
  ])('rejects invalid decisions before authenticating reviewers', async (input) => {
    vi.mocked(authenticateReviewers).mockClear();
    await expect(decidePrivilegedAccess(input)).rejects.toMatchObject({
      code: 'INVALID_ACCESS_DECISION',
    });
    expect(authenticateReviewers).not.toHaveBeenCalled();
  });
  it('allows only suspension/restoration for organizations and explicit user deactivation', () => {
    expect(
      privilegedDecisionSchema.safeParse({ ...valid, kind: 'organizations', action: 'restore' })
        .success,
    ).toBe(true);
    expect(privilegedDecisionSchema.safeParse({ ...valid, action: 'deactivate' }).success).toBe(
      true,
    );
  });
});
