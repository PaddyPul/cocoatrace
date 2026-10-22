import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  query: vi.fn(),
  sql: vi.fn(),
  audit: vi.fn(),
  register: vi.fn(),
  retain: vi.fn(),
  queue: vi.fn(),
  cleanup: vi.fn(),
  put: vi.fn(),
  move: vi.fn(),
  scan: vi.fn(),
}));
vi.mock('../db', () => ({
  query: m.query,
  getClient: async () => ({ query: m.sql, release: vi.fn() }),
}));
vi.mock('./auditWriter', () => ({ recordAudit: m.audit }));
vi.mock('../config/env', () => ({
  config: {
    evidenceUploadSigningSecret: 'test-secret',
    evidenceMaxFileBytes: 1000,
    evidenceOrganizationQuotaBytes: 10000,
    environment: 'test',
  },
}));
vi.mock('../modules/evidenceCleanup/repository', () => ({
  registerObject: m.register,
  retainUploadObjects: m.retain,
  queueIntentObjects: m.queue,
}));
vi.mock('../modules/evidenceCleanup/worker', () => ({ cleanupObjectNow: m.cleanup }));
vi.mock('./evidenceStorage', () => ({
  evidenceStorage: () => ({ provider: 'test', put: m.put, move: m.move }),
}));
vi.mock('./evidenceMalwareScanner', () => ({ evidenceMalwareScanner: () => ({ scan: m.scan }) }));
vi.mock('./evidenceFilePolicy', () => ({
  validateEvidenceMetadata: (fileName: string, mimeType: string) => ({ fileName, mimeType }),
  validateEvidenceContent: () => 'application/pdf',
}));
vi.mock('./resourcePolicy', () => ({ canAccessEvidenceEntity: async () => true }));
import { completeUploadIntent, createUploadIntent } from './evidenceUploadService';
const actor = { id: 'user', organizationId: 'org' };
const content = Buffer.from('file');
const intent = {
  id: 'intent',
  uploader_user_id: 'user',
  uploader_organization_id: 'org',
  quarantine_object_key: 'quarantine/private',
  expires_at: new Date(Date.now() + 600000),
  status: 'pending',
  declared_size_bytes: 4,
  claimed_mime_type: 'application/pdf',
};
function complete() {
  const expires = Math.floor(intent.expires_at.getTime() / 1000);
  const signature = crypto
    .createHmac('sha256', 'test-secret')
    .update(`intent.${intent.quarantine_object_key}.${expires}`)
    .digest('hex');
  return completeUploadIntent('intent', expires, signature, content);
}
beforeEach(() => {
  vi.resetAllMocks();
  m.query.mockImplementation(async (sql: string) => ({
    rows: sql.startsWith('SELECT *') ? [intent] : [{ id: 'intent' }],
    rowCount: 1,
  }));
  m.sql.mockImplementation(async (sql: string) => ({
    rows: sql.includes('stored_bytes')
      ? [{ stored_bytes: 0, cleanup_bytes: 0, legacy_reserved_bytes: 0 }]
      : [{ id: 'evidence' }],
    rowCount: 1,
  }));
  m.scan.mockResolvedValue({ status: 'clean', engine: 'test' });
  m.cleanup.mockResolvedValue(undefined);
});
describe('evidence business audit boundaries', () => {
  it('rolls back intent and reservation when audit fails', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      createUploadIntent(
        actor as never,
        {
          type: 'other',
          fileName: 'file.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 4,
          linkedEntityType: 'batch',
          linkedEntityId: 'batch',
        } as never,
      ),
    ).rejects.toThrow('audit unavailable');
    expect(m.register).toHaveBeenCalledOnce();
    expect(m.sql.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(m.sql.mock.calls.map(([sql]) => sql)).not.toContain('COMMIT');
  });
  it('preserves content hash and empty metadata on completion', async () => {
    await complete();
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      'evidence.upload.complete',
      'evidence_item',
      'evidence',
      {},
      { newStateHash: `sha256:${crypto.createHash('sha256').update(content).digest('hex')}` },
    );
    expect(m.queue).not.toHaveBeenCalled();
  });
  it('preserves recorded document expiry in completion and its audit without replacing the content hash', async () => {
    const expiresAt = '2027-06-30T23:59:59.999Z';
    m.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('SELECT *')
        ? [{ ...intent, document_expires_at: expiresAt }]
        : [{ id: 'intent' }],
      rowCount: 1,
    }));
    await complete();
    const insert = m.sql.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO evidence_items'),
    );
    expect(insert?.[1]?.[14]).toBe(expiresAt);
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      'evidence.upload.complete',
      'evidence_item',
      'evidence',
      { documentExpiresAt: expiresAt },
      { newStateHash: `sha256:${crypto.createHash('sha256').update(content).digest('hex')}` },
    );
  });
  it('rolls back completion and queues both provider objects on audit failure', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(complete()).rejects.toThrow('audit unavailable');
    expect(m.retain).toHaveBeenCalledOnce();
    expect(m.queue).toHaveBeenCalledWith(expect.anything(), 'intent', 'upload_rejected');
    expect(m.cleanup).toHaveBeenCalledTimes(2);
    expect(m.sql.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });
  it.each(['infected', 'failed'])(
    'rolls back %s scan transition when audit fails and queues cleanup',
    async (status) => {
      if (status === 'failed') m.scan.mockRejectedValueOnce(new Error('private scanner detail'));
      else
        m.scan.mockResolvedValueOnce({
          status: 'infected',
          signature: 'private-signature',
          engine: 'test',
        });
      m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
      await expect(complete()).rejects.toThrow('audit unavailable');
      expect(m.audit).toHaveBeenCalledWith(
        expect.anything(),
        actor,
        `evidence.scan.${status}`,
        'evidence_upload_intent',
        'intent',
      );
      expect(m.sql.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
      expect(m.queue).toHaveBeenCalledOnce();
      expect(m.move).not.toHaveBeenCalled();
    },
  );
  it('rejects lost completion transition before retention or audit', async () => {
    const previous = m.sql.getMockImplementation()!;
    m.sql.mockImplementation(async (sql: string, ...args: unknown[]) =>
      sql.includes("SET status='completed'") ? { rows: [], rowCount: 0 } : previous(sql, ...args),
    );
    await expect(complete()).rejects.toThrow('no longer clean and scanning');
    expect(m.retain).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.queue).toHaveBeenCalledOnce();
  });
});
