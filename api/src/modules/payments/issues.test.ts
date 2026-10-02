import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), lock: vi.fn(), audit: vi.fn(), settle: vi.fn() }));
vi.mock('../trading/transaction', () => ({
  inTradeTransaction: (work: (client: unknown) => unknown) => work({ query: mocks.query }),
  recordTradeAudit: mocks.audit,
}));
vi.mock('./locking', () => ({ lockPayment: mocks.lock }));
vi.mock('../../services/tradeSettlement', () => ({ completeTradeIfReady: mocks.settle }));
import { approveIssueResolution, openPaymentIssue, proposeIssueResolution } from './issues';

const buyer = { id: 'buyer-user', organizationId: 'buyer' };
const seller = { id: 'seller-user', organizationId: 'seller' };
const contract = { id: 'contract', status: 'accepted', payment_plan: 'pay_before_dispatch' };
const payment = { id: 'payment' };
const party = { buyer_organization_id: 'buyer', seller_organization_id: 'seller' };
const issue = { id: 'issue', payment_request_id: 'payment', installment_id: 'installment',
  issue_type: 'reference_correction', status: 'resolution_proposed', reason: 'Wrong reference',
  proposed_reference: 'NEW', resolution_note: 'Correct the typo', resolution_proposed_by_organization_id: 'buyer' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lock.mockResolvedValue({ contract, payment });
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT payment_request_id')) return { rows: [{ payment_request_id: 'payment' }] };
    if (sql.includes('c.buyer_organization_id,c.seller_organization_id')) return { rows: [party] };
    if (sql.startsWith('SELECT * FROM payment_issues WHERE id')) return { rows: [issue] };
    return { rows: [] };
  });
});

describe('payment issue safety rules', () => {
  it('does not reveal issues to an unrelated organization', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ payment_request_id: 'payment' }] }).mockResolvedValueOnce({ rows: [] });
    await expect(approveIssueResolution({ id: 'outsider', organizationId: 'outsider' }, 'issue')).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.lock).not.toHaveBeenCalled();
  });
  it('requires the other organization to approve a correction', async () => {
    await expect(approveIssueResolution(buyer, 'issue')).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('returns completed approvals without repeating mutation or settlement', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT payment_request_id')
      ? [{ payment_request_id: 'payment' }] : sql.includes('c.buyer_organization_id,c.seller_organization_id') ? [party] : [{ ...issue, status: 'resolved' }] }));
    await expect(approveIssueResolution(seller, 'issue')).resolves.toMatchObject({ status: 'resolved' });
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it('cannot reverse a completed trade receipt', async () => {
    mocks.lock.mockResolvedValue({ contract: { ...contract, status: 'settled' }, payment });
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('c.buyer_organization_id,c.seller_organization_id')
      ? [party] : sql.startsWith('SELECT * FROM payment_installments') ? [{ id: 'installment', status: 'paid' }] : [] }));
    await expect(openPaymentIssue(seller, 'payment', { issueType: 'receipt_reversal', installmentId: 'installment', reason: 'Funds returned' })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('prevents the supplier from proposing the buyer reference correction', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT payment_request_id')
      ? [{ payment_request_id: 'payment' }] : sql.includes('c.buyer_organization_id,c.seller_organization_id') ? [party] : [{ ...issue, status: 'open' }] }));
    await expect(proposeIssueResolution(seller, 'issue', 'Correct typo')).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('rejects blank explanations before any database access', async () => {
    await expect(openPaymentIssue(buyer, 'payment', { issueType: 'payment_dispute', reason: ' ' })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
