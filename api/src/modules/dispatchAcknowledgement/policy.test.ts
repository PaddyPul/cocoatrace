import { describe, it, expect } from 'vitest';
import { acknowledgementBody, exceptionHash } from './policy';
describe('exception acknowledgement identity', () => {
  const row = {
    id: 'shipment',
    contract_id: 'contract',
    dispatch_exception_reason: 'Reviewed risk',
    dispatch_exception_recorded_at: '2026-01-01T00:00:00Z',
  };
  it('binds reason, time and party context without inferring historical acknowledgement', () => {
    expect(exceptionHash(row)).toBe(
      exceptionHash({
        ...row,
        dispatch_exception_recorded_at: new Date(row.dispatch_exception_recorded_at),
      }),
    );
    for (const change of [
      { id: 'other' },
      { contract_id: 'other' },
      { dispatch_exception_reason: 'Changed' },
      { dispatch_exception_recorded_at: null },
    ])
      expect(exceptionHash({ ...row, ...change })).not.toBe(exceptionHash(row));
  });
  it('requires explicit reviewed confirmation and rejects extra authority fields', () => {
    expect(
      acknowledgementBody.safeParse({ exceptionHash: exceptionHash(row), confirmed: true }).success,
    ).toBe(true);
    expect(
      acknowledgementBody.safeParse({ exceptionHash: exceptionHash(row), confirmed: false })
        .success,
    ).toBe(false);
    expect(
      acknowledgementBody.safeParse({
        exceptionHash: exceptionHash(row),
        confirmed: true,
        waivePayment: true,
      }).success,
    ).toBe(false);
  });
});
