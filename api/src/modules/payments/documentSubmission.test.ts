import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  lock: vi.fn(),
  available: vi.fn(),
  activate: vi.fn(),
}));
vi.mock('../trading/transaction', () => ({
  inTradeTransaction: (work: (client: unknown) => unknown) => work({ query: mocks.query }),
  recordTradeAudit: vi.fn(),
}));
vi.mock('./locking', () => ({ lockPayment: mocks.lock, requireAgreed: vi.fn() }));
vi.mock('./issueGuard', () => ({ assertNoActivePaymentIssue: vi.fn() }));
vi.mock('./dueDates', () => ({ activatePaymentInstallments: mocks.activate }));
vi.mock('../../services/evidenceAvailability', () => ({
  preflightEvidence: vi.fn(async () => ({ available: mocks.available })),
  evidenceAvailabilityProjection: () => '*',
  evidenceAvailabilityUsableSql: () => 'TRUE',
  assertWorkflowEvidenceLimit: vi.fn(),
}));
import { automaticallyPresentDocuments } from './documentsAndSecurity';

describe('automatic submission uses the existing payment boundary', () => {
  let payment: Record<string, unknown>;
  let contract: Record<string, unknown>;
  let shipment: Record<string, unknown>;
  let files: Array<{ type: string }>;
  beforeEach(() => {
    vi.clearAllMocks();
    payment = { id: 'payment', security_status: 'verified' };
    contract = { id: 'contract', payment_plan: 'bank_secured', incoterm: 'CIF' };
    shipment = { current_milestone: 'arrived', transport_document_reference: 'BL-1' };
    files = [
      'commercial_invoice',
      'packing_list',
      'transport_document',
      'insurance_certificate',
    ].map((type) => ({ type }));
    mocks.available.mockReturnValue(true);
    mocks.lock.mockImplementation(async () => ({ contract, payment }));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM shipments')) return { rows: [shipment] };
      if (sql.includes('FROM evidence_items')) return { rows: files };
      return { rows: [{ ...payment, documents_presented_at: 'now' }] };
    });
  });
  it('activates only document-triggered installments and writes system attribution in the same transaction', async () => {
    await automaticallyPresentDocuments('seller', 'payment');
    expect(mocks.lock).toHaveBeenCalledWith(
      expect.anything(),
      { organizationId: 'seller' },
      'payment',
      'seller',
    );
    expect(mocks.activate).toHaveBeenCalledWith(
      expect.anything() as PoolClient,
      'payment',
      'documents_presented',
    );
    const audit = mocks.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_events'))!;
    expect(audit[0]).toContain('VALUES(NULL');
    expect(JSON.parse(audit[1][3])).toMatchObject({
      source: 'automatic_readiness',
      required: expect.arrayContaining(['insurance_certificate']),
    });
  });
  it.each(['reference', 'insurance', 'security', 'storage', 'handover', 'plan'])(
    'does not activate payment when %s is missing or ineligible',
    async (missing) => {
      if (missing === 'reference') shipment.transport_document_reference = '  ';
      if (missing === 'insurance') files.pop();
      if (missing === 'security') payment.security_status = 'submitted';
      if (missing === 'storage') mocks.available.mockReturnValue(false);
      if (missing === 'handover') shipment.current_milestone = 'booked';
      if (missing === 'plan') contract.payment_plan = 'pay_before_dispatch';
      await expect(automaticallyPresentDocuments('seller', 'payment')).rejects.toThrow();
      expect(mocks.activate).not.toHaveBeenCalled();
      expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO audit_events'))).toBe(
        false,
      );
    },
  );
  it('replaying an already presented set does not extend deadlines or write another audit', async () => {
    payment.documents_presented_at = 'earlier';
    await automaticallyPresentDocuments('seller', 'payment');
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
