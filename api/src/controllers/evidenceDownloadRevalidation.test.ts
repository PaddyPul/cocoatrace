import { expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
const ports = vi.hoisted(() => ({
  verify: vi.fn(),
  revalidate: vi.fn(),
  bytes: vi.fn(),
  response: vi.fn(),
}));
vi.mock('../modules/evidenceWorkflow/downloadLinks', () => ({
  issueDownloadLink: vi.fn(),
  verifyDownloadLink: ports.verify,
  revalidateDownloadAccess: ports.revalidate,
}));
vi.mock('../modules/evidenceWorkflow/httpResponse', () => ({
  respondWithEvidenceDownload: ports.response,
}));
import { downloadEvidence } from './evidenceController';
it('passes final live authorization to the byte adapter and prevents release on revocation', async () => {
  const query = { expires: '1792627200', signature: 'synthetic' };
  const actor = { id: 'user', organizationId: 'org' };
  ports.revalidate.mockRejectedValue(new Error('Session revoked during provider read'));
  ports.response.mockImplementation(
    async (_actor: unknown, _id: unknown, _response: unknown, authorize: () => Promise<void>) => {
      await authorize();
      ports.bytes();
    },
  );
  const request = {
    user: actor,
    params: { id: 'document' },
    query,
    authToken: 'synthetic-session',
  } as unknown as Request;
  await expect(downloadEvidence(request, {} as Response)).rejects.toThrow(
    'Session revoked during provider read',
  );
  expect(ports.verify).toHaveBeenCalledWith(actor, 'document', query);
  expect(ports.revalidate).toHaveBeenCalledWith('synthetic-session', 'document', query);
  expect(ports.bytes).not.toHaveBeenCalled();
});
