import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  recipient: vi.fn(),
  audit: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('./recovery', () => ({ assertOperator: mocks.authority }));
vi.mock('./alerts', () => ({
  alertOptions: () => ({ enabled: false, recipientUserIds: [] }),
  lockAlertRecipient: mocks.recipient,
}));
vi.mock('../../services/auditWriter', () => ({ recordAudit: mocks.audit }));
vi.mock('../catalog/paging', () => ({
  withCatalogRead: (read: (execute: unknown) => unknown) => read(mocks.execute),
}));
import { readTerminalAlerts, retryOperatorAlert, safeAlertError } from './alertRecovery';
const id = '11111111-1111-4111-8111-111111111111';
const recipient = '22222222-2222-4222-8222-222222222222';
const actor = { id, organizationId: id, sessionId: id };
const options = { enabled: true, recipientUserIds: [recipient] };
const reason = 'Investigated SMTP submission failure';
const terminal = () => ({
  status: 'failed_terminal',
  attempts: 8,
  last_error_code: 'SMTP_SUBMISSION_FAILED',
  sent_at: null,
  lease_token: null,
  lease_expires_at: null,
  incident_id: id,
  recipient_user_id: recipient,
});
function fixture(overrides = {}) {
  const row = { ...terminal(), ...overrides };
  const execute = vi.fn(async (sql: string) => ({
    rows: sql.includes('FROM operations_alert_outbox')
      ? [row]
      : sql.includes('FROM operations_incidents')
        ? [{ signal_key: 'queue:recall:TERMINAL_WORK_PENDING' }]
        : [],
  }));
  return { execute, client: { query: execute } as unknown as PoolClient };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authority.mockResolvedValue(undefined);
  mocks.recipient.mockResolvedValue({ email: 'private@example.test' });
  mocks.audit.mockResolvedValue(undefined);
});
describe('reviewed operator alert recovery', () => {
  it('rechecks authority and eligibility, preserves identity and audits only the reviewed transition', async () => {
    const { client, execute } = fixture();
    await retryOperatorAlert(client, actor, id, reason, options);
    expect(mocks.authority).toHaveBeenCalledWith(client, actor);
    expect(mocks.recipient).toHaveBeenCalledWith(client, recipient);
    const update = execute.mock.calls.find(([sql]) => sql.startsWith('UPDATE'))?.[0];
    expect(update).toContain("status='queued',attempts=0");
    expect(update).not.toMatch(/recipient_user_id\s*=|incident_id\s*=/);
    expect(mocks.audit).toHaveBeenCalledWith(
      client,
      actor,
      'operations.alert.retry',
      'operations_alert_outbox',
      id,
      { reason, previousAttempts: 8, previousErrorCode: 'SMTP_SUBMISSION_FAILED' },
    );
    expect(
      execute.mock.calls.find(([sql]) => sql.includes('FROM operations_alert_outbox'))?.[0],
    ).toContain('FOR UPDATE');
    expect(
      execute.mock.calls.find(([sql]) => sql.includes('FROM operations_incidents'))?.[0],
    ).toContain('FOR SHARE');
  });
  it.each(['queued', 'sending', 'sent', 'suppressed', 'failed'])(
    'refuses %s state without mutation or audit',
    async (status) => {
      const { client, execute } = fixture({ status });
      await expect(retryOperatorAlert(client, actor, id, reason, options)).rejects.toThrow();
      expect(execute.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { sent_at: new Date() },
    { lease_token: id },
    { lease_expires_at: new Date() },
    { last_error_code: 'INCONSISTENT_SUBMISSION' },
    { last_error_code: 'PRIVATE_PROVIDER_SECRET' },
  ])('refuses unsafe terminal metadata %j', async (fields) => {
    const { client, execute } = fixture(fields);
    await expect(retryOperatorAlert(client, actor, id, reason, options)).rejects.toThrow();
    expect(execute.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('refuses disabled/withdrawn configuration and a newly ineligible operator', async () => {
    for (const current of [
      { enabled: false, recipientUserIds: [recipient] },
      { enabled: true, recipientUserIds: [id] },
    ]) {
      const { client } = fixture();
      await expect(retryOperatorAlert(client, actor, id, reason, current)).rejects.toThrow();
    }
    mocks.recipient.mockResolvedValue(undefined);
    await expect(
      retryOperatorAlert(fixture().client, actor, id, reason, options),
    ).rejects.toThrow();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('does not read the queue after authority rejection', async () => {
    mocks.authority.mockRejectedValue(new Error('Fresh passkey required'));
    const { client, execute } = fixture();
    await expect(retryOperatorAlert(client, actor, id, reason, options)).rejects.toThrow(
      'Fresh passkey',
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it('bounds/redacts the terminal register and does not grant retry for arbitrary incident metadata', async () => {
    mocks.execute.mockResolvedValue({
      rows: Array.from({ length: 51 }, (_, index) => ({
        id: String(index),
        status: 'failed_terminal',
        attempts: 8,
        last_error_code: 'PRIVATE_PROVIDER_SECRET',
        retryable: true,
        signal_key: 'private:payload:SECRET',
      })),
    });
    const result = await readTerminalAlerts(options);
    expect(result.items).toHaveLength(50);
    expect(result.more).toBe(true);
    expect(
      result.items.every(
        (row) => row.retryable === false && row.last_error_code === 'UNKNOWN_ALERT_FAILURE',
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /signal_key|PRIVATE_PROVIDER_SECRET|private:payload/,
    );
    expect(mocks.execute.mock.calls[0][0]).toContain(
      "WHERE status='failed_terminal' ORDER BY id LIMIT 51",
    );
    expect(safeAlertError('LEASE_EXPIRED')).toBe('LEASE_EXPIRED');
    expect(safeAlertError(null)).toBeNull();
    expect(safeAlertError({ toString: () => 'LEASE_EXPIRED' })).toBe('UNKNOWN_ALERT_FAILURE');
  });
});
