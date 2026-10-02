import { Request, Response } from 'express';
import { query } from '../db';
import { issueCertificateRecord, changeCertificateStatusRecord } from '../modules/trust/certification';
import { hasCertificateRelationship, hasExplicitPermission } from '../services/resourcePolicy';

export async function listCertificates(req: Request, res: Response): Promise<void> {
  const { farmId } = req.query;
  const seeAll = hasExplicitPermission(req.user!, 'certificate.read.all');
  let sql = `SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id`;
  const params: any[] = [];
  const conditions: string[] = [];
  if (!seeAll) {
    conditions.push(`(c.certifier_organization_id=$1 OR c.farmer_organization_id=$1 OR EXISTS (
      SELECT 1 FROM harvest_batches b
      JOIN batch_holdings h ON h.batch_id=b.id
      JOIN sales_contracts sc ON sc.holding_id=h.id
      WHERE b.farm_id=c.farm_id AND (sc.seller_organization_id=$1 OR sc.buyer_organization_id=$1)
    ))`);
    params.push(req.user!.organizationId);
  }
  if (farmId) {
    conditions.push(`c.farm_id = $${params.length + 1}`);
    params.push(farmId);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY c.valid_to DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
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
