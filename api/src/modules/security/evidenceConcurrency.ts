import { AppError } from '../../errors';
// Shared process capacity across upload/download: four 20 MiB raw buffers alone
// require 80 MiB before parser, scanner and adapter copies. Not a cluster budget.
export const EVIDENCE_GLOBAL_TRANSFER_LIMIT = 4;
export const EVIDENCE_TENANT_TRANSFER_LIMIT = 2;
export class EvidenceTransferBusyError extends AppError {
  readonly status = 503;
  constructor(readonly scope: 'global' | 'tenant') {
    super(
      'Evidence transfer capacity is busy. Retry after current transfers finish.',
      503,
      'EVIDENCE_TRANSFER_BUSY',
    );
    this.name = 'EvidenceTransferBusyError';
  }
}
export class EvidenceConcurrency {
  private active = 0;
  private readonly tenants = new Map<string, number>();
  private readonly globalLimit: number;
  private readonly tenantLimit: number;
  constructor(limits: { globalLimit?: number; tenantLimit?: number } = {}) {
    this.globalLimit = limits.globalLimit ?? EVIDENCE_GLOBAL_TRANSFER_LIMIT;
    this.tenantLimit = limits.tenantLimit ?? EVIDENCE_TENANT_TRANSFER_LIMIT;
    if (
      !Number.isSafeInteger(this.globalLimit) ||
      this.globalLimit < 1 ||
      !Number.isSafeInteger(this.tenantLimit) ||
      this.tenantLimit < 1 ||
      this.tenantLimit > this.globalLimit
    )
      throw new TypeError('Evidence capacity requires positive integer limits, tenant <= global.');
  }
  // Checks and reservation happen synchronously; no async caller can race them.
  acquire(tenantId: string): () => void {
    if (typeof tenantId !== 'string' || tenantId.length === 0)
      throw new TypeError('An authenticated tenant is required for evidence admission.');
    const tenantActive = this.tenants.get(tenantId) ?? 0;
    if (tenantActive >= this.tenantLimit) throw new EvidenceTransferBusyError('tenant');
    if (this.active >= this.globalLimit) throw new EvidenceTransferBusyError('global');
    this.active += 1;
    this.tenants.set(tenantId, tenantActive + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const remaining = (this.tenants.get(tenantId) ?? 1) - 1;
      if (remaining === 0) this.tenants.delete(tenantId);
      else this.tenants.set(tenantId, remaining);
    };
  }
  async run<T>(tenantId: string, work: () => T | Promise<T>): Promise<T> {
    const release = this.acquire(tenantId);
    try {
      return await work();
    } finally {
      release();
    }
  }
  snapshot(): { activeTransfers: number; activeTenants: number } {
    return { activeTransfers: this.active, activeTenants: this.tenants.size };
  }
}
export const evidenceConcurrency = new EvidenceConcurrency();
