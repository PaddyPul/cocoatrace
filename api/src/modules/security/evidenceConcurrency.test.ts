import { describe, expect, it, vi } from 'vitest';
import { EvidenceConcurrency, EvidenceTransferBusyError } from './evidenceConcurrency';
import { AppError } from '../../errors';
describe('process evidence transfer admission', () => {
  it('rejects tenant saturation without queueing or retaining rejected work', () => {
    const budget = new EvidenceConcurrency();
    const a = budget.acquire('a'),
      b = budget.acquire('a');
    expect(() => budget.acquire('a')).toThrow(EvidenceTransferBusyError);
    try {
      budget.acquire('a');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 503,
        code: 'EVIDENCE_TRANSFER_BUSY',
        scope: 'tenant',
      });
    }
    expect(budget.snapshot()).toEqual({ activeTransfers: 2, activeTenants: 1 });
    const other = budget.acquire('b');
    other();
    a();
    b();
  });
  it('rejects global saturation and admits another tenant once a slot releases', () => {
    const budget = new EvidenceConcurrency({ globalLimit: 2, tenantLimit: 1 });
    const a = budget.acquire('a'),
      b = budget.acquire('b');
    expect(() => budget.acquire('c')).toThrow(EvidenceTransferBusyError);
    try {
      budget.acquire('c');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 503,
        code: 'EVIDENCE_TRANSFER_BUSY',
        scope: 'global',
      });
    }
    expect(budget.snapshot()).toEqual({ activeTransfers: 2, activeTenants: 2 });
    a();
    const c = budget.acquire('c');
    a();
    expect(budget.snapshot().activeTransfers).toBe(2);
    b();
    c();
    expect(budget.snapshot()).toEqual({ activeTransfers: 0, activeTenants: 0 });
  });
  it('release is idempotent and cannot release a later transfer', () => {
    const budget = new EvidenceConcurrency();
    const a = budget.acquire('a'),
      b = budget.acquire('a');
    a();
    a();
    expect(budget.snapshot()).toEqual({ activeTransfers: 1, activeTenants: 1 });
    b();
    b();
    const c = budget.acquire('a');
    a();
    expect(budget.snapshot().activeTransfers).toBe(1);
    c();
    expect(budget.snapshot()).toEqual({ activeTransfers: 0, activeTenants: 0 });
  });
  it('finally releases successful work and sync or async failures', async () => {
    const budget = new EvidenceConcurrency({ globalLimit: 1, tenantLimit: 1 });
    expect(await budget.run('a', () => 42)).toBe(42);
    await expect(
      budget.run('a', () => {
        throw Error('sync');
      }),
    ).rejects.toThrow('sync');
    await expect(
      budget.run('a', async () => {
        throw Error('async');
      }),
    ).rejects.toThrow('async');
    expect(budget.snapshot()).toEqual({ activeTransfers: 0, activeTenants: 0 });
  });
  it('competing tenants reserve atomically and rejected callbacks never run', async () => {
    const budget = new EvidenceConcurrency({ globalLimit: 2, tenantLimit: 1 });
    let finishA!: () => void, finishB!: () => void;
    const a = budget.run(
      'a',
      () =>
        new Promise<void>((resolve) => {
          finishA = resolve;
        }),
    );
    const callback = vi.fn();
    const rejected = budget.run('a', callback);
    const b = budget.run(
      'b',
      () =>
        new Promise<void>((resolve) => {
          finishB = resolve;
        }),
    );
    await expect(rejected).rejects.toMatchObject({
      code: 'EVIDENCE_TRANSFER_BUSY',
      scope: 'tenant',
    });
    expect(callback).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual({ activeTransfers: 2, activeTenants: 2 });
    finishA();
    finishB();
    await Promise.all([a, b]);
    expect(budget.snapshot()).toEqual({ activeTransfers: 0, activeTenants: 0 });
  });
  it('removes all completed tenant entries without map growth', () => {
    const budget = new EvidenceConcurrency();
    for (let i = 0; i < 10000; i++) budget.acquire(`tenant-${i}`)();
    expect(budget.snapshot()).toEqual({ activeTransfers: 0, activeTenants: 0 });
  });
  it.each([
    { globalLimit: 0 },
    { tenantLimit: 0 },
    { globalLimit: 1, tenantLimit: 2 },
    { globalLimit: 1.5 },
    { tenantLimit: NaN },
    { globalLimit: Infinity },
  ])('rejects invalid capacity %j', (limits) => {
    expect(() => new EvidenceConcurrency(limits)).toThrow(TypeError);
  });
  it('does not allocate without authenticated tenant identity', () => {
    const budget = new EvidenceConcurrency();
    expect(() => budget.acquire('')).toThrow(TypeError);
    expect(budget.snapshot()).toEqual({ activeTransfers: 0, activeTenants: 0 });
  });
});
