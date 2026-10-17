import { Response } from 'express';
import { Actor } from '../../services/resourcePolicy';
import { prepareEvidenceDownload } from './download';

// Express lifecycle stays here; authorization and storage have no HTTP dependency.
export async function respondWithEvidenceDownload(
  actor: Actor,
  id: string,
  res: Response,
): Promise<void> {
  let prepared: Awaited<ReturnType<typeof prepareEvidenceDownload>>;
  try {
    prepared = await prepareEvidenceDownload(actor, id);
  } catch (error) {
    // Admission errors historically advertise a short retry; other failures do not.
    if (error instanceof Error && 'code' in error && error.code === 'EVIDENCE_TRANSFER_BUSY')
      res.setHeader('Retry-After', '1');
    throw error;
  }
  if ('denial' in prepared) {
    res.status(prepared.denial.status).json(prepared.denial.body);
    return;
  }
  const { lease } = prepared;
  res.once('finish', lease.responseEnded);
  res.once('close', lease.responseEnded);
  // A client can disconnect while authorization is still awaiting the database.
  if (res.destroyed || res.writableEnded) lease.responseEnded();
  try {
    const content = await lease.read();
    if (!content) {
      res.status(404).json({ error: 'Stored file not found' });
      return;
    }
    res.setHeader('Content-Type', lease.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(lease.filename)}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(content);
  } catch (error) {
    lease.fail();
    throw error;
  }
}
