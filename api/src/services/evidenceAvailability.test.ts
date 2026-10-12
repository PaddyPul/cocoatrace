import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  read: vi.fn(),
  execute: vi.fn(),
  configuration: { evidenceStorageTimeoutMs: 500 },
}));
vi.mock('./evidenceStorage', () => ({ evidenceStorage: () => ({ exists: mocks.exists }) }));
vi.mock('../config/env', () => ({ config: mocks.configuration }));
vi.mock('../modules/catalog/paging', () => ({ withCatalogRead: mocks.read }));
import {
  preflightEvidence,
  evidenceAvailabilityProjection,
  evidenceAvailabilityUsableSql,
} from './evidenceAvailability';
const proof = {
  id: 'proof',
  storage_key: 'evidence/test/key',
  storage_provider: 'local',
  sha256_hash: 'hash',
  file_size_bytes: '12',
  linked_entity_type: 'contract',
  linked_entity_id: 'contract',
  uploader_organization_id: 'buyer',
  type: 'payment_proof',
  validation_status: 'validated',
  malware_scan_status: 'clean',
  review_status: 'approved',
  malware_scanned_at: new Date('2026-10-12T00:00:00Z'),
  cleanup_state: 'retained',
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockImplementation((load: (execute: typeof mocks.execute) => Promise<unknown>) =>
    load(mocks.execute),
  );
  mocks.exists.mockResolvedValue(true);
});
describe('request-local evidence availability preflight', () => {
  it('finishes metadata reads before provider I/O and performs no provider work during locked rechecks', async () => {
    let reading = false;
    let transactionStarted = false;
    mocks.read.mockImplementation(async (load) => {
      reading = true;
      const rows = await load(mocks.execute);
      reading = false;
      return rows;
    });
    mocks.exists.mockImplementation(async () => {
      expect(reading).toBe(false);
      expect(transactionStarted).toBe(false);
      return true;
    });
    const cache = await preflightEvidence(async () => [proof]);
    transactionStarted = true;
    expect(cache.available({ ...proof })).toBe(true);
    expect(cache.available({ ...proof })).toBe(true);
    expect(mocks.exists).toHaveBeenCalledTimes(1);
  });
  it('never reuses availability after ownership, linkage, type, bytes, scan, review or cleanup facts change', async () => {
    const cache = await preflightEvidence(async () => [proof]);
    for (const field of Object.keys(proof))
      expect(cache.available({ ...proof, [field]: 'changed' })).toBe(false);
    expect(cache.available({ ...proof, id: 'other' })).toBe(false);
  });
  it('keeps false results and defers sanitized provider failure until a current row needs proof', async () => {
    mocks.exists
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('secret provider path'));
    const missing = await preflightEvidence(async () => [proof]);
    expect(missing.available(proof)).toBe(false);
    const offline = await preflightEvidence(async () => [proof]);
    expect(() => offline.available(proof)).toThrow(
      'Private evidence availability is unavailable. Retry later.',
    );
    expect(offline.available({ ...proof, storage_key: 'new' })).toBe(false);
  });
  it('does not share cached results between calls and rejects cleanup-ineligible records before provider requests', async () => {
    const ready = await preflightEvidence(async () => [proof]);
    expect(ready.available(proof)).toBe(true);
    const separate = await preflightEvidence(async () => []);
    expect(separate.available(proof)).toBe(false);
    for (const state of ['held', 'pending', 'processing', 'done', 'dead']) {
      const cache = await preflightEvidence(async () => [{ ...proof, cleanup_state: state }]);
      expect(cache.available({ ...proof, cleanup_state: state })).toBe(false);
    }
    expect(mocks.exists).toHaveBeenCalledTimes(1);
    expect(evidenceAvailabilityProjection('e')).toContain('AS cleanup_state');
    expect(evidenceAvailabilityUsableSql('e')).toContain("cleanup.state<>'retained'");
  });
  it('fails a complete candidate overflow before making any provider request', async () => {
    const cache = await preflightEvidence(async () =>
      Array.from({ length: 65 }, (_, i) => ({ ...proof, id: String(i) })),
    );
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(() => cache.available(proof)).toThrow('Too many candidate evidence documents.');
  });
  it('bounds concurrent provider work and applies one total deadline to all candidates', async () => {
    vi.useFakeTimers();
    let active = 0;
    let peak = 0;
    mocks.exists.mockImplementation(() => {
      active++;
      peak = Math.max(peak, active);
      return new Promise(() => {});
    });
    try {
      const pending = preflightEvidence(async () =>
        Array.from({ length: 20 }, (_, i) => ({ ...proof, id: String(i) })),
      );
      await vi.advanceTimersByTimeAsync(500);
      const cache = await pending;
      expect(peak).toBe(4);
      expect(mocks.exists).toHaveBeenCalledTimes(4);
      expect(() => cache.available({ ...proof, id: '0' })).toThrow(
        'Evidence availability checks timed out.',
      );
      await vi.advanceTimersByTimeAsync(10000);
      expect(mocks.exists).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
