import { describe, expect, it, vi } from 'vitest';
import path from 'path';
import { prepareEvidenceDownload, DownloadDependencies } from './download';
import { downloadDenial, DownloadEvidenceItem } from './policy';
import { containedLegacyPath, legacyUploadsRoot } from './storage';
const item: DownloadEvidenceItem = {
  linked_entity_type: 'contract',
  linked_entity_id: 'contract',
  uploader_organization_id: 'seller',
  buyer_organization_id: 'buyer',
  validation_status: 'validated',
  review_status: 'pending',
  malware_scan_status: 'clean',
  type: 'transport_document',
  release_status: 'authorized',
  storage_key: 'private/key',
  storage_provider: 's3',
  storage_path: null,
  detected_mime_type: 'application/pdf',
  mime_type: null,
  file_name: 'private.pdf',
};
const actor = { id: 'user', organizationId: 'buyer', permissions: ['contract.read'] };
function ports(read: DownloadDependencies['read'] = async () => Buffer.from('private')) {
  const release = vi.fn();
  return {
    release,
    deps: {
      find: vi.fn(async () => item),
      canAccess: vi.fn(async () => true),
      acquire: vi.fn(() => release),
      read: vi.fn(read),
      audit: vi.fn(async () => undefined),
    },
  };
}
describe('private evidence download boundary', () => {
  it('keeps access denial ahead of scan/payment details and admission/storage', async () => {
    const { deps } = ports();
    deps.canAccess.mockResolvedValue(false);
    expect(await prepareEvidenceDownload(actor, 'id', deps)).toEqual({
      denial: { status: 403, body: { error: 'You do not have access to this document' } },
    });
    expect(deps.audit).not.toHaveBeenCalled();
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.read).not.toHaveBeenCalled();
    expect(downloadDenial(undefined, 'buyer', false)?.status).toBe(404);
  });
  it('enforces scan/review and controlled-document release while preserving uploader access', () => {
    for (const patch of [
      { validation_status: 'pending' },
      { review_status: 'rejected' },
      { malware_scan_status: 'infected' },
    ])
      expect(downloadDenial({ ...item, ...patch }, 'buyer', true)?.body.code).toBe(
        'EVIDENCE_NOT_SCAN_CLEAN',
      );
    for (const type of ['transport_document', 'bill_of_lading', 'warehouse_release']) {
      expect(downloadDenial({ ...item, type, release_status: null }, 'buyer', true)?.status).toBe(
        423,
      );
      expect(
        downloadDenial({ ...item, type, release_status: null }, 'seller', false),
      ).toBeUndefined();
    }
    expect(
      downloadDenial({ ...item, type: 'commercial_invoice', release_status: null }, 'buyer', true),
    ).toBeUndefined();
  });
  it('holds admission after storage settles until response completion and releases only once', async () => {
    const { deps, release } = ports();
    const prepared = await prepareEvidenceDownload(actor, 'id', deps);
    if (!('lease' in prepared)) throw new Error('Expected lease');
    expect(await prepared.lease.read()).toEqual(Buffer.from('private'));
    expect(release).not.toHaveBeenCalled();
    prepared.lease.responseEnded();
    prepared.lease.responseEnded();
    prepared.lease.fail();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('holds admission if response closes before storage resolves', async () => {
    let settle: (content: Buffer) => void = () => {
      throw new Error('Not started');
    };
    const { deps, release } = ports(
      () =>
        new Promise<Buffer>((resolve) => {
          settle = resolve;
        }),
    );
    const prepared = await prepareEvidenceDownload(actor, 'id', deps);
    if (!('lease' in prepared)) throw new Error('Expected lease');
    const read = prepared.lease.read();
    prepared.lease.responseEnded();
    prepared.lease.responseEnded();
    expect(release).not.toHaveBeenCalled();
    settle(Buffer.from('done'));
    await read;
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('storage failure releases without requiring a response event', async () => {
    const { deps, release } = ports(async () => {
      throw new Error('Storage unavailable');
    });
    const prepared = await prepareEvidenceDownload(actor, 'id', deps);
    if (!('lease' in prepared)) throw new Error('Expected lease');
    await expect(prepared.lease.read()).rejects.toThrow('Storage unavailable');
    prepared.lease.fail();
    prepared.lease.responseEnded();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('audits only available authorized bytes and fails closed if access audit cannot persist', async () => {
    const { deps, release } = ports();
    deps.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    const prepared = await prepareEvidenceDownload(actor, 'id', deps);
    if (!('lease' in prepared)) throw new Error('Expected lease');
    await expect(prepared.lease.read()).rejects.toThrow('audit unavailable');
    expect(deps.audit).toHaveBeenCalledWith(actor, 'id', 7);
    expect(release).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(deps.audit.mock.calls)).not.toContain('private.pdf');
  });
  it('does not record release readiness when private storage has no bytes', async () => {
    const { deps } = ports(async () => null);
    const prepared = await prepareEvidenceDownload(actor, 'id', deps);
    if (!('lease' in prepared)) throw new Error('Expected lease');
    expect(await prepared.lease.read()).toBeNull();
    prepared.lease.responseEnded();
    expect(deps.audit).not.toHaveBeenCalled();
  });
  it('holds transfer admission through final asynchronous authorization after a client disconnect', async () => {
    const { deps, release } = ports();
    let finish = () => {};
    let entered = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const prepared = await prepareEvidenceDownload(actor, 'id', deps, async () => {
      entered();
      await waiting;
    });
    if (!('lease' in prepared)) throw new Error('Expected lease');
    const read = prepared.lease.read();
    await started;
    prepared.lease.responseEnded();
    expect(release).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalled();
    finish();
    await read;
    expect(release).toHaveBeenCalledTimes(1);
    expect(deps.audit).toHaveBeenCalledTimes(1);
  });
  it('retains the original uploads root and rejects root/sibling/traversal paths', () => {
    expect(legacyUploadsRoot).toBe(path.resolve(__dirname, '../../../uploads'));
    expect(containedLegacyPath(path.join(legacyUploadsRoot, 'private.pdf'))).toBe(
      path.join(legacyUploadsRoot, 'private.pdf'),
    );
    expect(containedLegacyPath(legacyUploadsRoot)).toBeUndefined();
    expect(containedLegacyPath(legacyUploadsRoot + '-other/private.pdf')).toBeUndefined();
    expect(containedLegacyPath(path.join(legacyUploadsRoot, '../outside.pdf'))).toBeUndefined();
  });
});
