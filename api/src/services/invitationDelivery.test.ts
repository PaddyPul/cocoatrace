import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({ query: vi.fn(), send: vi.fn(), error: vi.fn() }));
vi.mock('../db', () => ({ query: dependencies.query }));
vi.mock('./emailSender', () => ({ sendInvitationEmail: dependencies.send }));
vi.mock('../logger', () => ({ default: { error: dependencies.error } }));
import { deliverInvitation } from './invitationDelivery';

const input = { id: 'invite-id', token: 'bearer-secret', to: 'private@example.com', invitationUrl: 'https://example.com/accept-invite/bearer-secret' };

describe('invitation email submission', () => {
  beforeEach(() => { vi.resetAllMocks(); dependencies.query.mockResolvedValue({ rows: [] }); });

  it.each(['sent', 'suppressed'] as const)('records %s without persisting the bearer credential', async (status) => {
    dependencies.send.mockResolvedValue({ status });
    expect(await deliverInvitation(input)).toEqual({ status });
    expect(dependencies.query.mock.calls[0][1]).toEqual([
      status, input.id, crypto.createHash('sha256').update(input.token).digest('hex'),
    ]);
    expect(JSON.stringify(dependencies.query.mock.calls)).not.toContain(input.token);
  });

  it('records failure for retry without logging recipient, token or provider error text', async () => {
    dependencies.send.mockRejectedValue(new Error(`provider rejected ${input.to} ${input.token}`));
    expect(await deliverInvitation(input)).toEqual({ status: 'failed' });
    expect(dependencies.query.mock.calls[0][1][0]).toBe('failed');
    expect(JSON.stringify(dependencies.error.mock.calls)).not.toContain(input.token);
    expect(JSON.stringify(dependencies.error.mock.calls)).not.toContain(input.to);
  });
});
