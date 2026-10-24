import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AppError } from '../errors';
const mocks = vi.hoisted(() => ({
  parser: vi.fn(),
  authorize: vi.fn(),
  acquire: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
}));
vi.mock('express', () => ({ default: { raw: () => mocks.parser } }));
vi.mock('../services/evidenceUploadService', () => ({ authorizeUploadContent: mocks.authorize }));
vi.mock('../controllers/evidenceController', () => ({ uploadEvidenceContent: mocks.complete }));
vi.mock('../modules/security/evidenceConcurrency', () => ({
  evidenceConcurrency: { acquire: mocks.acquire },
}));
import { createEvidenceContentHandler } from './evidenceContent';
function input() {
  return {
    req: {
      params: { id: 'intent' },
      query: { expires: '123', signature: 'signature' },
      headers: {},
      destroy: vi.fn(),
    } as unknown as Request,
    res: { setHeader: vi.fn() } as unknown as Response,
    next: vi.fn(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ organizationId: 'trusted-tenant' });
  mocks.acquire.mockReturnValue(mocks.release);
  mocks.parser.mockImplementation((_req, _res, done) => done());
  mocks.complete.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
describe('pre-body evidence admission lifetime', () => {
  it('never parses invalid signed capabilities', async () => {
    mocks.authorize.mockRejectedValueOnce(new AppError('Invalid', 403));
    const { req, res, next } = input();
    await createEvidenceContentHandler()(req, res, next);
    expect(mocks.parser).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
  it('rejects saturation before reading body and supplies retry guidance', async () => {
    mocks.acquire.mockImplementationOnce(() => {
      throw new AppError('Busy', 503, 'EVIDENCE_TRANSFER_BUSY');
    });
    const { req, res, next } = input();
    await createEvidenceContentHandler()(req, res, next);
    expect(mocks.parser).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
    expect(next.mock.calls[0][0].code).toBe('EVIDENCE_TRANSFER_BUSY');
  });
  it('rejects encoded bodies before allocating capacity or parsing', async () => {
    const { req, res, next } = input();
    req.headers['content-encoding'] = 'gzip';
    await createEvidenceContentHandler()(req, res, next);
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.parser).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].code).toBe('EVIDENCE_BODY_ENCODING');
  });
  it('releases parser failures without completing an intent', async () => {
    mocks.parser.mockImplementationOnce((_req, _res, done) => done(new AppError('Too large', 413)));
    const { req, res, next } = input();
    await createEvidenceContentHandler()(req, res, next);
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(413);
  });
  it('normalizes a non-Error parser failure without exposing the raw rejection', async () => {
    mocks.parser.mockImplementationOnce((_req, _res, done) => done('raw parser details'));
    const { req, res, next } = input();
    await createEvidenceContentHandler()(req, res, next);
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('Evidence upload body failed');
  });
  it('retains capacity while processing continues and releases exactly once after failure', async () => {
    let reject!: (reason: Error) => void;
    mocks.complete.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { req, res, next } = input();
    const work = createEvidenceContentHandler()(req, res, next);
    await vi.waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(mocks.release).not.toHaveBeenCalled();
    reject(new Error('Storage unavailable'));
    await work;
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('terminates a body that never finishes and frees capacity without waiting indefinitely', async () => {
    vi.useFakeTimers();
    mocks.parser.mockImplementationOnce(() => undefined);
    const { req, res, next } = input();
    const work = createEvidenceContentHandler(50)(req, res, next);
    await vi.advanceTimersByTimeAsync(51);
    await work;
    expect(req.destroy).toHaveBeenCalledTimes(1);
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].code).toBe('EVIDENCE_BODY_TIMEOUT');
  });
});
