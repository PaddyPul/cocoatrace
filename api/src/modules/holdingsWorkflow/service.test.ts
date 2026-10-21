import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), getClient: vi.fn() }));
vi.mock('../../db', () => ({ getClient: mocks.getClient }));
vi.mock('../recall/safety', () => ({
  lockRecallBoundary: vi.fn(),
  assertBatchNotRecalled: vi.fn(),
}));
vi.mock('../../services/inventoryIntegrity', () => ({
  lockHoldingListings: vi.fn(),
  pendingTransferQuantity: vi.fn(),
  reconcileHoldingListings: vi.fn(),
}));
import {
  pendingTransferQuantity,
  reconcileHoldingListings,
} from '../../services/inventoryIntegrity';
import { acceptTransfer, createHolding, splitHolding, transferHolding } from './service';
const actor = { id: 'user', organizationId: 'owner' };
const holding = {
  id: 'holding',
  batch_id: 'batch',
  holder_organization_id: 'owner',
  quantity_kg: '10.000',
  warehouse_location: 'warehouse',
  status: 'available',
  created_at: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getClient.mockResolvedValue({ query: mocks.query, release: mocks.release });
  vi.mocked(pendingTransferQuantity).mockResolvedValue(0);
  mocks.query.mockResolvedValue({ rows: [] });
});

describe('holdings workflow transaction boundaries', () => {
  it('rejects a self transfer before acquiring a transaction', async () => {
    await expect(
      transferHolding(actor, 'holding', { toOrganizationId: 'owner', quantityKg: 1 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      response: { error: 'Choose a different destination organization' },
    });
    expect(mocks.getClient).not.toHaveBeenCalled();
  });

  it('rolls back when pending transfers consume requested free stock', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('FROM batch_holdings')
        ? [holding]
        : sql.includes('FROM organizations')
          ? [{ id: 'destination' }]
          : [],
    }));
    vi.mocked(pendingTransferQuantity).mockResolvedValue(8);
    await expect(
      transferHolding(actor, 'holding', { toOrganizationId: 'destination', quantityKg: 3 }),
    ).rejects.toMatchObject({ statusCode: 409, response: { code: 'INSUFFICIENT_INVENTORY' } });
    expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('rejects splits that do not conserve grams before changing inventory', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('FROM batch_holdings') ? [holding] : [],
    }));
    await expect(splitHolding(actor, 'holding', { quantities: [5, 4.999] })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(reconcileHoldingListings).not.toHaveBeenCalled();
  });

  it('rolls back holding insertion when its audit fails', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO audit_events')) throw new Error('audit failed');
      return {
        rows: sql.includes('FROM harvest_batches')
          ? [{ quantity_kg: '10' }]
          : sql.includes('SUM(quantity_kg)')
            ? [{ quantity: '0' }]
            : sql.includes('INSERT INTO batch_holdings')
              ? [holding]
              : [],
      };
    });
    await expect(createHolding(actor, { batchId: 'batch', quantityKg: 10 })).rejects.toThrow(
      'audit failed',
    );
    expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mocks.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('audits a successful holding creation before committing', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('FROM harvest_batches')
        ? [{ quantity_kg: '10' }]
        : sql.includes('SUM(quantity_kg)')
          ? [{ quantity: '0' }]
          : sql.includes('INSERT INTO batch_holdings')
            ? [holding]
            : [],
    }));
    await expect(createHolding(actor, { batchId: 'batch', quantityKg: 10 })).resolves.toEqual(
      holding,
    );
    const sql = mocks.query.mock.calls.map(([statement]) => String(statement));
    expect(
      sql.findIndex((statement) => statement.includes('INSERT INTO audit_events')),
    ).toBeLessThan(sql.indexOf('COMMIT'));
    expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
  });
});

it('accepts custody with source locking before transfer locking and excludes its own reservation', async () => {
  const transfer = {
    id: 'transfer',
    holding_id: 'holding',
    from_organization_id: 'owner',
    to_organization_id: 'receiver',
    quantity_kg: '3.000',
    status: 'requested',
  };
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('SELECT holding_id')
      ? [{ holding_id: 'holding' }]
      : sql.includes('SELECT * FROM batch_holdings')
        ? [holding]
        : sql.includes('SELECT * FROM custody_transfers')
          ? [transfer]
          : sql.includes('INSERT INTO batch_holdings')
            ? [{ ...holding, id: 'new' }]
            : sql.includes('UPDATE custody_transfers')
              ? [{ ...transfer, status: 'accepted' }]
              : [],
  }));
  vi.mocked(pendingTransferQuantity).mockResolvedValue(2);
  await expect(
    acceptTransfer({ id: 'receiver-user', organizationId: 'receiver' }, 'transfer'),
  ).resolves.toMatchObject({ transfer: { status: 'accepted' }, newHolding: { id: 'new' } });
  expect(pendingTransferQuantity).toHaveBeenCalledWith(expect.anything(), 'holding', 'transfer');
  expect(reconcileHoldingListings).toHaveBeenCalledWith(expect.anything(), 'holding', 5);
  const sql = mocks.query.mock.calls.map(([statement]) => String(statement));
  expect(
    sql.findIndex((statement) => statement.includes('SELECT * FROM batch_holdings')),
  ).toBeLessThan(
    sql.findIndex((statement) => statement.includes('SELECT * FROM custody_transfers')),
  );
  expect(mocks.query).toHaveBeenLastCalledWith('COMMIT');
});
