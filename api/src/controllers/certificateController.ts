import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listCertificates(req: Request, res: Response): Promise<void> {
  const { farmId } = req.query;
  const perms = req.user!.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('certificate.read');
  let sql = `SELECT c.*, o.name as certifier_name FROM organic_certificates c JOIN organizations o ON o.id = c.certifier_organization_id`;
  const params: any[] = [];
  const conditions: string[] = [];
  if (!seeAll) {
    conditions.push('(c.certifier_organization_id = $1 OR c.farmer_organization_id = $1)');
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
  const perms = req.user!.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('certificate.read');
  if (!seeAll && rows[0].certifier_organization_id !== req.user!.organizationId && rows[0].farmer_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json(rows[0]);
}

export async function issueCertificate(req: Request, res: Response): Promise<void> {
  const { farmerOrganizationId, farmId, standard, cropScope, validFrom, validTo, issuingAuthority, accreditationReference } = req.body;
  const { rows } = await query(
    'INSERT INTO organic_certificates (certifier_organization_id, farmer_organization_id, farm_id, standard, crop_scope, valid_from, valid_to, issuing_authority, accreditation_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [req.user!.organizationId, farmerOrganizationId, farmId, standard, cropScope, validFrom, validTo, issuingAuthority, accreditationReference]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'certificate.issue', entityType: 'organic_certificate', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function updateCertificateStatus(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const action = req.params.action as string;
  const validActions: Record<string, string> = { suspend: 'suspended', revoke: 'revoked', reinstate: 'active' };
  if (!validActions[action]) {
    res.status(400).json({ error: 'Invalid action' });
    return;
  }
  const { rows } = await query('UPDATE organic_certificates SET status = $1 WHERE id = $2 AND certifier_organization_id = $3 RETURNING *', [validActions[action], id, req.user!.organizationId]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Certificate not found or not yours' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: `certificate.${action}`, entityType: 'organic_certificate', entityId: id, reason: req.body.reason });
  res.json(rows[0]);
}
