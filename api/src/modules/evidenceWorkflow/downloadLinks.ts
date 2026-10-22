import { createHmac, timingSafeEqual } from 'node:crypto';
import type { JwtPayload } from '../../middleware/auth';
import { config } from '../../config/env';
import { AppError } from '../../errors';
import { authenticateSession } from '../../services/authSessionService';
import { hasExplicitPermission } from '../../services/resourcePolicy';
import { authorizeEvidenceDownload } from './download';
export const DOWNLOAD_LINK_SECONDS = 60;
type LinkActor = Pick<JwtPayload, 'id' | 'organizationId' | 'sessionId'>;
function signature(actor: LinkActor, id: string, expires: number): string {
  return createHmac('sha256', config.evidenceUploadSigningSecret)
    .update(
      JSON.stringify([
        'evidence-download:v1',
        id,
        actor.id,
        actor.organizationId,
        actor.sessionId,
        expires,
      ]),
    )
    .digest('hex');
}
export function downloadLink(actor: LinkActor, id: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + DOWNLOAD_LINK_SECONDS;
  return {
    downloadUrl: `/evidence/${id}/download?expires=${expires}&signature=${signature(actor, id, expires)}`,
    expiresAt: new Date(expires * 1000).toISOString(),
    lifetimeSeconds: DOWNLOAD_LINK_SECONDS,
  };
}
export function verifyDownloadLink(
  actor: LinkActor,
  id: string,
  query: Record<string, unknown>,
  now = Date.now(),
): void {
  // The canonical authenticated action remains available to legacy API clients.
  // When any link parameter is supplied, the complete signed link must verify.
  if (Object.keys(query).length === 0) return;
  const expires =
    typeof query.expires === 'string' && /^\d{10}$/.test(query.expires)
      ? Number(query.expires)
      : NaN;
  if (
    Object.keys(query).some((key) => !['expires', 'signature'].includes(key)) ||
    !Number.isSafeInteger(expires) ||
    typeof query.signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(query.signature)
  )
    throw new AppError(
      'Download link is invalid. Request a new download.',
      403,
      'EVIDENCE_DOWNLOAD_LINK_INVALID',
    );
  const expected = signature(actor, id, expires);
  if (
    !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(query.signature, 'hex')) ||
    expires > Math.floor(now / 1000) + DOWNLOAD_LINK_SECONDS
  )
    throw new AppError(
      'Download link is invalid. Request a new download.',
      403,
      'EVIDENCE_DOWNLOAD_LINK_INVALID',
    );
  if (now >= expires * 1000)
    throw new AppError(
      'Download link expired. Request a new download.',
      410,
      'EVIDENCE_DOWNLOAD_LINK_EXPIRED',
    );
}
export async function issueDownloadLink(actor: JwtPayload, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new AppError('Invalid document identifier', 400, 'VALIDATION_ERROR');
  const authorized = await authorizeEvidenceDownload(actor, id);
  if ('denial' in authorized)
    throw new AppError(
      authorized.denial.body.error,
      authorized.denial.status,
      authorized.denial.body.code ?? 'EVIDENCE_DOWNLOAD_DENIED',
    );
  return downloadLink(actor, id);
}

/** Provider reads can outlast a role/session or evidence-state change. */
export async function revalidateDownloadAccess(
  credential: string,
  id: string,
  query: Record<string, unknown>,
): Promise<void> {
  const live = await authenticateSession(credential);
  if (!live) throw new AppError('Session ended. Sign in again.', 401, 'AUTHENTICATION_REQUIRED');
  if (live.mfa?.required && !live.mfa.verified)
    throw new AppError('Verify your passkey before downloading.', 403, 'MFA_REQUIRED');
  if (!hasExplicitPermission(live, 'evidence.read'))
    throw new AppError('Current document access is required', 403, 'FORBIDDEN');
  const authorized = await authorizeEvidenceDownload(live, id);
  if ('denial' in authorized)
    throw new AppError(
      authorized.denial.body.error,
      authorized.denial.status,
      authorized.denial.body.code ?? 'EVIDENCE_DOWNLOAD_DENIED',
    );
  verifyDownloadLink(live, id, query);
}
