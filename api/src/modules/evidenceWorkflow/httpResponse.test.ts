import { EventEmitter } from 'events';
import { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EvidenceTransferBusyError } from '../security/evidenceConcurrency';
import { prepareEvidenceDownload } from './download';
import { respondWithEvidenceDownload } from './httpResponse';
vi.mock('./download', () => ({ prepareEvidenceDownload: vi.fn() }));
const prepare = vi.mocked(prepareEvidenceDownload);
const actor = { id: 'user', organizationId: 'buyer', permissions: ['contract.read'] };
function response() {
  const events = new EventEmitter();
  const result = Object.assign(events, {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  });
  result.status.mockReturnValue(result);
  result.json.mockImplementation(() => {
    events.emit('finish');
    return result;
  });
  result.send.mockImplementation(() => {
    events.emit('finish');
    return result;
  });
  return { res: result as unknown as Response, result };
}
beforeEach(() => vi.resetAllMocks());
describe('evidence HTTP response adapter', () => {
  it('emits exact private attachment headers and hooks finish and close', async () => {
    const lease = {
      mime: 'application/pdf',
      filename: 'private proof.pdf',
      read: vi.fn(async () => Buffer.from('bytes')),
      responseEnded: vi.fn(),
      fail: vi.fn(),
    };
    prepare.mockResolvedValue({ lease });
    const { res, result } = response();
    await respondWithEvidenceDownload(actor, 'id', res);
    expect(result.setHeader.mock.calls).toEqual([
      ['Content-Type', 'application/pdf'],
      ['Content-Disposition', "attachment; filename*=UTF-8''private%20proof.pdf"],
      ['Cache-Control', 'no-store'],
    ]);
    expect(result.send).toHaveBeenCalledWith(Buffer.from('bytes'));
    expect(lease.responseEnded).toHaveBeenCalledTimes(1);
    result.emit('close');
    expect(lease.responseEnded).toHaveBeenCalledTimes(2);
  });
  it('preserves missing stored bytes response and releases on send errors', async () => {
    const lease = {
      mime: 'application/pdf',
      filename: 'proof.pdf',
      read: vi.fn(async (): Promise<Buffer | null> => null),
      responseEnded: vi.fn(),
      fail: vi.fn(),
    };
    prepare.mockResolvedValue({ lease });
    const { res, result } = response();
    await respondWithEvidenceDownload(actor, 'id', res);
    expect(result.status).toHaveBeenCalledWith(404);
    expect(result.json).toHaveBeenCalledWith({ error: 'Stored file not found' });
    expect(lease.responseEnded).toHaveBeenCalled();
    lease.read.mockResolvedValue(Buffer.from('bytes'));
    result.send.mockImplementation(() => {
      throw new Error('HTTP failed');
    });
    await expect(respondWithEvidenceDownload(actor, 'id', res)).rejects.toThrow('HTTP failed');
    expect(lease.fail).toHaveBeenCalledTimes(1);
  });
  it('observes an already disconnected response before starting private storage work', async () => {
    const responseEnded = vi.fn();
    const lease = {
      mime: 'application/pdf',
      filename: 'proof.pdf',
      responseEnded,
      fail: vi.fn(),
      read: vi.fn(async () => {
        expect(responseEnded).toHaveBeenCalledTimes(1);
        return Buffer.from('bytes');
      }),
    };
    prepare.mockResolvedValue({ lease });
    const { res } = response();
    Object.defineProperty(res, 'destroyed', { value: true });
    await respondWithEvidenceDownload(actor, 'id', res);
    expect(lease.read).toHaveBeenCalledTimes(1);
  });
  it('passes policy denials unchanged and advertises admission retry only', async () => {
    const { res, result } = response();
    prepare.mockResolvedValue({
      denial: { status: 423, body: { error: 'Blocked', code: 'EVIDENCE_NOT_SCAN_CLEAN' } },
    });
    await respondWithEvidenceDownload(actor, 'id', res);
    expect(result.status).toHaveBeenCalledWith(423);
    expect(result.json).toHaveBeenCalledWith({ error: 'Blocked', code: 'EVIDENCE_NOT_SCAN_CLEAN' });
    prepare.mockRejectedValue(new EvidenceTransferBusyError('tenant'));
    await expect(respondWithEvidenceDownload(actor, 'id', res)).rejects.toThrow('capacity');
    expect(result.setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });
});
