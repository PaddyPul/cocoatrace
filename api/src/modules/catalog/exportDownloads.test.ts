import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '../../services/authSessionService';
const calls = vi.hoisted(() => ({
  audit: vi.fn(),
  provenance: vi.fn(),
  auditWrite: vi.fn(),
  provenanceWrite: vi.fn(),
}));
vi.mock('./auditExport', () => ({ completeAuditExport: calls.audit }));
vi.mock('./provenanceExport', () => ({ completeProvenancePack: calls.provenance }));
vi.mock('./exportAttribution', () => ({
  recordAuditDownload: calls.auditWrite,
  recordProvenanceDownload: calls.provenanceWrite,
}));
import { downloadAuditReport, downloadProvenanceReport } from './exportDownloads';
const actor: AuthenticatedActor = {
  id: 'user',
  sessionId: 'session',
  organizationId: 'org',
  email: 'test@example.invalid',
  name: 'Test',
  roles: [],
  permissions: [],
  orgName: 'Org',
  orgType: 'buyer',
};
beforeEach(() => {
  vi.resetAllMocks();
});
describe('download attribution boundary', () => {
  it('returns the exact bounded report only after attribution succeeds', async () => {
    const report = { payload: '[]', count: 0, bytes: 2 };
    calls.audit.mockResolvedValue(report);
    await expect(downloadAuditReport(actor, { entityType: 'batch' })).resolves.toBe(report);
    expect(calls.audit).toHaveBeenCalledWith(actor, { entityType: 'batch' });
    expect(calls.auditWrite).toHaveBeenCalledWith(actor, report);
  });
  it('refuses to return a completed file if its durable attribution fails', async () => {
    calls.audit.mockResolvedValue({ payload: 'private report' });
    calls.auditWrite.mockRejectedValue(new Error('audit unavailable'));
    await expect(downloadAuditReport(actor, {})).rejects.toThrow('audit unavailable');
  });
  it('retains export mode, authorized batch and exact provenance payload', async () => {
    const report = { serialized: '{}', payload: {} };
    calls.provenance.mockResolvedValue(report);
    await expect(
      downloadProvenanceReport(actor, 'batch-id', { contractId: 'contract' }),
    ).resolves.toBe(report);
    expect(calls.provenance).toHaveBeenCalledWith(
      actor,
      'batch-id',
      { contractId: 'contract' },
      'export',
    );
    expect(calls.provenanceWrite).toHaveBeenCalledWith(actor, 'batch-id', report);
  });
  it('never attributes an unauthorized or incomplete read as a successful download', async () => {
    calls.provenance.mockRejectedValue(new Error('denied'));
    await expect(downloadProvenanceReport(actor, 'batch', {})).rejects.toThrow('denied');
    expect(calls.provenanceWrite).not.toHaveBeenCalled();
  });
});
