import {
  issueDownloadLink,
  verifyDownloadLink,
  revalidateDownloadAccess,
} from '../modules/evidenceWorkflow/downloadLinks';
import { Request, Response } from 'express';
import { respondWithEvidenceDownload } from '../modules/evidenceWorkflow/httpResponse';
import { completeUploadIntent, createUploadIntent } from '../services/evidenceUploadService';
import { legacyEvidenceList } from '../modules/catalog/evidenceRecords';
import { withCatalogRead } from '../modules/catalog/paging';

export async function listEvidence(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead((execute) => legacyEvidenceList(execute, req.user!, req.query)));
}

export async function createEvidenceUploadIntent(req: Request, res: Response): Promise<void> {
  res.status(201).json(await createUploadIntent(req.user!, req.body));
}

export async function uploadEvidenceContent(req: Request, res: Response): Promise<void> {
  const expires = Number(req.query.expires);
  const signature = typeof req.query.signature === 'string' ? req.query.signature : '';
  if (!Number.isSafeInteger(expires) || !signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'A valid signed upload URL and file body are required' });
    return;
  }
  const evidence = await completeUploadIntent(
    req.params.id,
    expires,
    signature,
    req.body,
    req.headers['content-type'],
  );
  res.status(201).json(evidence);
}

export async function downloadEvidence(req: Request, res: Response): Promise<void> {
  verifyDownloadLink(req.user!, req.params.id, req.query);
  await respondWithEvidenceDownload(
    req.user!,
    req.params.id,
    res,
    () => revalidateDownloadAccess(req.authToken!, req.params.id, req.query),
    () => verifyDownloadLink(req.user!, req.params.id, req.query),
  );
}

export async function createEvidenceDownloadLink(req: Request, res: Response): Promise<void> {
  res.status(201).json(await issueDownloadLink(req.user!, req.params.id));
}
