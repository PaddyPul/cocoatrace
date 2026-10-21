import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  evidence: vi.fn(),
  journey: vi.fn(),
  notices: vi.fn(),
  trust: vi.fn(),
}));
vi.mock('../../db', () => ({ query: mocks.query }));
vi.mock('../catalog/publicEvidence', () => ({ readPublicEvidence: mocks.evidence }));
vi.mock('../catalog/publicJourney', () => ({ readPublicJourney: mocks.journey }));
vi.mock('../catalog/publicNotices', () => ({ readPublicNotices: mocks.notices }));
vi.mock('../catalog/paging', () => ({
  withCatalogRead: (work: (execute: unknown) => unknown) => work(mocks.query),
}));
vi.mock('../trust/assessment', () => ({
  loadBatchTrust: mocks.trust,
  legacyOrganicStatus: () => 'verified',
}));
import { readPublishedProduct, publishedQrSlug, recordPublishedScan } from './projection';
const product = {
  id: 'private-profile-id',
  batch_id: 'private-batch-id',
  slug: 'public-lot',
  display_name: 'Lot',
  brand_name: null,
  description: '',
  gtin: null,
  lot_code: 'lot',
  hero_image_url: 'javascript:alert(1)',
  published_at: '2026-01-01',
  crop: 'cocoa',
  harvest_date: '2025-12-01',
  quantity_kg: '10.000',
  moisture_percent: null,
  grade: 'A',
  provenance_hash: 'hash',
  current_holder_name: 'Holder',
  farm_name: 'Farm',
  farmer_name: 'Farmer',
  country: 'GH',
  region: 'Western',
  district: null,
  community: null,
  official_traceability_id: 'official-id',
  source_name: 'private-source',
  attestation_id: 'private-attestation',
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('SELECT pp.*')
      ? [product]
      : sql.includes('SELECT id FROM product_profiles')
        ? [{ id: product.id }]
        : sql.includes('COUNT(*)')
          ? [{ plot_count: 1 }]
          : [],
  }));
  for (const read of [mocks.evidence, mocks.journey])
    read.mockResolvedValue({ items: [], count: 0, hasMore: false, nextCursor: null });
  mocks.notices.mockResolvedValue({
    items: [{ severity: 'critical' }],
    count: 1,
    hasMore: false,
    nextCursor: null,
    safety: { status: 'critical' },
  });
  mocks.trust.mockResolvedValue(
    new Map([
      [product.batch_id, { organic: { status: 'reviewed' }, origin: { status: 'reviewed' } }],
    ]),
  );
});
describe('published product projection', () => {
  it('uses bounded public readers and exposes only the selected public fields', async () => {
    const result = await readPublishedProduct('public-lot');
    expect(result).toMatchObject({
      profile: { slug: 'public-lot', heroImageUrl: null },
      product: { quantityKg: 10, moisturePercent: null, organicClaimStatus: 'verified' },
      origin: { verificationStatus: 'verified' },
      safety: { activeRecalls: [{ severity: 'critical' }] },
    });
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(mocks.evidence).toHaveBeenCalledWith(
      'public-lot',
      {},
      { id: product.id, batchId: product.batch_id },
    );
    expect(mocks.notices).toHaveBeenCalledWith(
      'public-lot',
      { status: 'active' },
      { id: product.id, batchId: product.batch_id },
    );
  });
  it('suppresses the projection when publication changes during linked reads', async () => {
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string) =>
      sql.includes('SELECT id FROM product_profiles') ? { rows: [] } : original(sql),
    );
    await expect(readPublishedProduct('public-lot')).resolves.toBeUndefined();
    expect(mocks.query).toHaveBeenLastCalledWith(
      expect.stringContaining("visibility='published'"),
      [product.id, product.batch_id, 'public-lot'],
    );
  });
  it('does not load linked resources for unpublished profiles', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await expect(readPublishedProduct('draft')).resolves.toBeUndefined();
    expect(mocks.evidence).not.toHaveBeenCalled();
    expect(mocks.trust).not.toHaveBeenCalled();
  });
  it('requires publication independently for QR and scan writes', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await expect(publishedQrSlug('draft')).resolves.toBeUndefined();
    await expect(recordPublishedScan('draft')).resolves.toBe(false);
    for (const [sql] of mocks.query.mock.calls) expect(sql).toContain("visibility='published'");
  });
});
