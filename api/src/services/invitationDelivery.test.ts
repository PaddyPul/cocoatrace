import { beforeEach, describe, expect, it, vi } from 'vitest';
const deps = vi.hoisted(() => ({ query: vi.fn(), drain: vi.fn(), error: vi.fn() }));
vi.mock('../db', () => ({ query: deps.query }));
vi.mock('../modules/invitationDelivery/worker', () => ({ processInvitationEmails: deps.drain }));
vi.mock('../logger', () => ({ default: { error: deps.error } }));
import { deliverInvitation } from './invitationDelivery';
const input = {
  id: 'invite-id',
  token: 'bearer-secret',
  to: 'private@example.com',
  invitationUrl: 'https://example.com/accept-invite/bearer-secret',
};
describe('committed invitation delivery response', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it.each(['sent', 'suppressed', 'failed', 'failed_terminal', 'queued', 'sending'])(
    'reports durable state %s without storing caller links',
    async (status) => {
      deps.query.mockResolvedValueOnce({ rows: [{ status }] });
      expect(await deliverInvitation(input)).toEqual({
        status:
          status === 'failed_terminal'
            ? 'failed'
            : ['queued', 'sending'].includes(status)
              ? 'pending'
              : status,
      });
      expect(deps.drain).toHaveBeenCalledWith(undefined, 1, input.id);
      expect(JSON.stringify(deps.query.mock.calls)).not.toContain(input.token);
      expect(JSON.stringify(deps.query.mock.calls)).not.toContain(input.to);
    },
  );
  it('keeps a committed intent pending when immediate drain fails without exposing provider details', async () => {
    deps.drain.mockRejectedValueOnce(new Error(input.to + ' ' + input.token));
    expect(await deliverInvitation(input)).toEqual({ status: 'pending' });
    expect(JSON.stringify(deps.error.mock.calls)).not.toContain(input.token);
    expect(JSON.stringify(deps.error.mock.calls)).not.toContain(input.to);
  });
});
