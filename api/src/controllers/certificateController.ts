import { legacyCertificates } from '../modules/catalog/certificates';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { query } from '../db';
import { issueCertificateRecord, changeCertificateStatusRecord } from '../modules/trust/certification';
import { hasCertificateRelationship, hasExplicitPermission } from '../services/resourcePolicy';

export async function listCertificates(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute => legacyCertificates(execute, req.user!, req.query)));
}

export async function getCertificate(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    'SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id WHERE c.id = $1',
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Certificate not found' });
    return;
  }
  const seeAll = hasExplicitPermission(req.user!, 'certificate.read.all');
  if (!seeAll && !await hasCertificateRelationship(req.user!, req.params.id)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json(rows[0]);
}

export async function issueCertificate(req: Request, res: Response): Promise<void> {
  res.status(201).json(await issueCertificateRecord(req.user!, req.body));
}

export async function updateCertificateStatus(req: Request, res: Response): Promise<void> {
  res.json(await changeCertificateStatusRecord(req.user!, req.params.id as string, req.params.action as string, req.body.reason));
}
