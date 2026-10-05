import { describe, expect, it, vi } from 'vitest';
vi.mock('../trading/transaction', () => ({
  inTradeTransaction: vi.fn(),
  recordTradeAudit: vi.fn(),
}));
import { safeTimelineMetadata } from './operations';

describe('customer-facing payment history metadata', () => {
  it('retains useful payment context while removing secrets and arbitrary nested data', () => {
    expect(
      safeTimelineMetadata({
        reference: 'BANK-123',
        amount: '12.50',
        reason: 'Wrong reference',
        evidenceId: null,
        paymentEvidenceRequired: true,
        token: 'secret-token',
        smtpPassword: 'secret-password',
        databaseUrl: 'secret-url',
        resolution: { token: 'nested-secret' },
      }),
    ).toEqual({
      reference: 'BANK-123',
      amount: '12.50',
      reason: 'Wrong reference',
      evidenceId: null,
      paymentEvidenceRequired: true,
    });
  });
  it('handles legacy null and malformed metadata safely', () => {
    expect(safeTimelineMetadata(null)).toEqual({});
    expect(safeTimelineMetadata('unexpected')).toEqual({});
    expect(safeTimelineMetadata(['reference'])).toEqual({});
  });
});
