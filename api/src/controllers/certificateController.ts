import { privateCertificateDetail } from '../modules/catalog/privateResources';
import { legacyCertificates } from '../modules/catalog/certificates';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { issueCertificateRecord, changeCertificateStatusRecord } from '../modules/trust/certification';

export async function listCertificates(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute => legacyCertificates(execute, req.user!, req.query)));
}

export async function getCertificate(req: Request, res: Response): Promise<void> {
  const detail = await withCatalogRead(execute => privateCertificateDetail(execute,req.user!,req.params.id as string));
  if (!detail) { res.status(404).json({error:'Certificate not found'}); return; }
  res.json(detail);
}

export async function issueCertificate(req: Request, res: Response): Promise<void> {
  res.status(201).json(await issueCertificateRecord(req.user!, req.body));
}

export async function updateCertificateStatus(req: Request, res: Response): Promise<void> {
  res.json(await changeCertificateStatusRecord(req.user!, req.params.id as string, req.params.action as string, req.body.reason));
}
