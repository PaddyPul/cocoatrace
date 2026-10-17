import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import type { EmailSender } from '../../services/emailSender';
const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  query: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
}));
vi.mock('../../db', () => ({ getClient: mocks.getClient }));
vi.mock('./notificationRepository', () => ({
  claimRecallEmail: mocks.claim,
  finishRecallEmail: mocks.finish,
  persistRecallParticipants: vi.fn(),
  queueRecallEmails: vi.fn(),
}));
import { processRecallEmails } from './notifications';
const row = {
  id: 'notice-email',
  email: 'recipient@example.test',
  event_type: 'activated',
  reference_code: 'REF\r\nheader',
  title: 'Recall',
  instructions: 'Keep isolated',
  recall_status: 'active',
  attempts: 0,
};
describe('recall email delivery boundary', () => {
  const release = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClient.mockResolvedValue({ query: mocks.query, release } as unknown as PoolClient);
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.finish.mockResolvedValue(undefined);
  });
  it('releases the claim connection before submission and retains a retry after sender failure', async () => {
    mocks.claim.mockResolvedValueOnce(row).mockResolvedValueOnce(undefined);
    const send = vi.fn(async () => {
      expect(release).toHaveBeenCalledTimes(1);
      throw new Error('provider outage');
    });
    expect(await processRecallEmails({ send, healthcheck: async () => {} } as EmailSender)).toEqual(
      {
        sent: 0,
        suppressed: 0,
        failed: 1,
      },
    );
    expect(mocks.finish).toHaveBeenCalledWith(row, expect.any(String), 'failed');
    expect(release).toHaveBeenCalledTimes(2);
  });
  it('propagates failed claims, releases the connection and never sends unclaimed work', async () => {
    const failure = new Error('claim unavailable');
    mocks.claim.mockRejectedValueOnce(failure);
    const send = vi.fn();
    await expect(
      processRecallEmails({ send, healthcheck: async () => {} } as EmailSender),
    ).rejects.toBe(failure);
    expect(release).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });
  it('keeps SMTP suppression distinct from delivery and removes header line breaks', async () => {
    mocks.claim.mockResolvedValueOnce(row);
    const send = vi.fn().mockResolvedValue({ status: 'suppressed' });
    expect(
      await processRecallEmails({ send, healthcheck: async () => {} } as EmailSender, 1),
    ).toEqual({
      sent: 0,
      suppressed: 1,
      failed: 0,
    });
    expect(send.mock.calls[0][0].subject).toBe('BetterTrade recall activated: REF  header');
    expect(send.mock.calls[0][0].text).toContain('does not automatically release retained stock');
    expect(mocks.finish).toHaveBeenCalledWith(row, expect.any(String), 'suppressed');
  });
});
