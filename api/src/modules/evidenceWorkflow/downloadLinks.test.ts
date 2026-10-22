import { describe, it, expect, vi } from 'vitest';
const live = vi.hoisted(() => ({ authenticate: vi.fn(), authorize: vi.fn() }));
vi.mock('../../services/authSessionService', () => ({ authenticateSession: live.authenticate }));
vi.mock('./download', () => ({ authorizeEvidenceDownload: live.authorize }));
import {
  downloadLink,
  verifyDownloadLink,
  DOWNLOAD_LINK_SECONDS,
  revalidateDownloadAccess,
} from './downloadLinks';
import { requestLogSerializer } from '../../logger';
const actor = { id: 'user', organizationId: 'org', sessionId: 'session' };
const now = Date.UTC(2026, 9, 22);
const query = (url: string) => Object.fromEntries(new URL(url, 'http://local').searchParams);
describe('session-bound expiring private download links', () => {
  it('expires at the exact boundary and accepts within the bounded window', () => {
    const link = downloadLink(actor, 'evidence', now);
    const q = query(link.downloadUrl);
    expect(link.lifetimeSeconds).toBe(60);
    expect(() => verifyDownloadLink(actor, 'evidence', q, now + 59000)).not.toThrow();
    expect(() =>
      verifyDownloadLink(actor, 'evidence', q, now + DOWNLOAD_LINK_SECONDS * 1000),
    ).toThrow(/expired/);
  });
  it('binds evidence, user, organization and session and rejects tampering or excessive future expiry', () => {
    const q = query(downloadLink(actor, 'evidence', now).downloadUrl);
    for (const changed of [
      { ...actor, id: 'other' },
      { ...actor, organizationId: 'other' },
      { ...actor, sessionId: 'other' },
    ])
      expect(() => verifyDownloadLink(changed, 'evidence', q, now)).toThrow(/invalid/);
    expect(() => verifyDownloadLink(actor, 'other', q, now)).toThrow(/invalid/);
    expect(() =>
      verifyDownloadLink(actor, 'evidence', { ...q, expires: String(Number(q.expires) + 60) }, now),
    ).toThrow(/invalid/);
    expect(() => verifyDownloadLink(actor, 'evidence', q, now - 1000)).toThrow(/invalid/);
  });
  it('rejects partial, duplicated, oversized and unknown query parameters while retaining the live-auth legacy action', () => {
    for (const q of [
      { expires: '1' },
      { signature: 'a'.repeat(64) },
      { expires: ['1234567890'], signature: 'a'.repeat(64) },
      { ...query(downloadLink(actor, 'evidence', now).downloadUrl), extra: 'x' },
      { expires: '9'.repeat(1000), signature: 'bad' },
    ])
      expect(() => verifyDownloadLink(actor, 'evidence', q, now)).toThrow(/invalid/);
    expect(() => verifyDownloadLink(actor, 'evidence', {}, now)).not.toThrow();
  });
  it('omits signed link credentials from request logs', () => {
    const link = downloadLink(actor, 'evidence', now);
    expect(requestLogSerializer({ url: link.downloadUrl, method: 'GET' })).toEqual({
      url: '/evidence/evidence/download',
      method: 'GET',
    });
  });
});

it('rechecks final session, current permissions, MFA and evidence eligibility before release', async () => {
  const q = query(downloadLink(actor, 'evidence').downloadUrl);
  live.authenticate.mockResolvedValue(null);
  await expect(revalidateDownloadAccess('credential', 'evidence', q)).rejects.toMatchObject({
    statusCode: 401,
  });
  live.authenticate.mockResolvedValue({ ...actor, permissions: [] });
  await expect(revalidateDownloadAccess('credential', 'evidence', q)).rejects.toMatchObject({
    statusCode: 403,
  });
  live.authenticate.mockResolvedValue({
    ...actor,
    permissions: ['evidence.read'],
    mfa: { required: true, verified: false },
  });
  await expect(revalidateDownloadAccess('credential', 'evidence', q)).rejects.toMatchObject({
    code: 'MFA_REQUIRED',
  });
  expect(live.authorize).not.toHaveBeenCalled();
  live.authenticate.mockResolvedValue({ ...actor, permissions: ['evidence.read'] });
  live.authorize.mockResolvedValue({
    denial: { status: 423, body: { error: 'Scan state changed', code: 'EVIDENCE_NOT_SCAN_CLEAN' } },
  });
  await expect(revalidateDownloadAccess('credential', 'evidence', q)).rejects.toMatchObject({
    statusCode: 423,
  });
  live.authorize.mockResolvedValue({ item: {} });
  await expect(revalidateDownloadAccess('credential', 'evidence', q)).resolves.toBeUndefined();
});
