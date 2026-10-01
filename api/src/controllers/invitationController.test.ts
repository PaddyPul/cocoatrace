import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const dependencies = vi.hoisted(() => ({ query: vi.fn(), send: vi.fn(), audit: vi.fn() }));
vi.mock('../config/env', () => ({ config: { environment: 'production', publicWebUrl: 'https://app.example.com' } }));
vi.mock('../db', () => ({ query: dependencies.query, getClient: vi.fn() }));
vi.mock('../services/invitationDelivery', () => ({ deliverInvitation: dependencies.send }));
vi.mock('../services/audit', () => ({ record: dependencies.audit }));
import { resendInvitation } from './invitationController';

describe('invitation resend response', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('does not expose production links and keeps failed submission retryable', async () => {
    dependencies.query.mockResolvedValue({ rows: [{ id: 'invite', email: 'private@example.com', expires_at: 'future' }] });
    dependencies.send.mockResolvedValue({ status: 'failed' });
    const req = { params: { id: 'invite' }, user: { id: 'actor', organizationId: 'org', permissions: ['member.invite'] } } as unknown as Request;
    const json = vi.fn();
    await resendInvitation(req, { json } as unknown as Response);
    expect(json.mock.calls[0][0]).toMatchObject({ id: 'invite', emailDelivery: 'failed' });
    expect(json.mock.calls[0][0]).not.toHaveProperty('inviteUrl');
    expect(json.mock.calls[0][0]).not.toHaveProperty('invitationUrl');
    expect(dependencies.query.mock.calls[0][0]).toContain('i.revoked_at IS NULL');
  });
  it('does not send when the invitation is revoked, accepted or belongs to another tenant', async () => {
    dependencies.query.mockResolvedValue({ rows: [] });
    const req = { params: { id: 'invite' }, user: { organizationId: 'org', permissions: ['member.invite'] } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await resendInvitation(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(dependencies.send).not.toHaveBeenCalled();
  });
});
