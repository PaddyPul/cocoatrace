import { describe, expect, it, vi } from 'vitest';
import { privatePaymentDetail } from './privatePayments';
import type { Execute } from './paging';

describe('private payment details', () => {
  it('applies party scope before hydration and stops absent or foreign reads before linked evidence', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    expect(await privatePaymentDetail(execute as Execute, 'tenant', 'payment')).toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toContain(
      '$2 IN(c.seller_organization_id,c.buyer_organization_id)',
    );
    expect(execute.mock.calls[0][1]).toEqual(['payment', 'tenant']);
  });
  it('hydrates a complete authorized request using the same snapshot executor', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'payment', amount_total: '20.00' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'installment' }] });
    expect(await privatePaymentDetail(execute as Execute, 'tenant', 'payment')).toEqual({
      id: 'payment',
      amount_total: '20.00',
      installments: [{ id: 'installment' }],
    });
    expect(execute.mock.calls[1][1]).toEqual(['payment']);
    expect(execute.mock.calls[1][0]).toContain('LIMIT 1001');
  });
  it('never returns a truncated installment collection as complete', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'payment' }] })
      .mockResolvedValueOnce({ rows: Array.from({ length: 1001 }, () => ({ id: 'installment' })) });
    await expect(
      privatePaymentDetail(execute as Execute, 'tenant', 'payment'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'CATALOG_READ_LIMIT' });
  });
});
