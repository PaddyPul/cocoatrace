import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listOrganizations(req: Request, res: Response): Promise<void> {
  const { type } = req.query;
  const perms = req.user!.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('organization.admin');
  if (!seeAll) {
    const { rows } = await query('SELECT * FROM organizations WHERE id = $1 ORDER BY name', [req.user!.organizationId]);
    res.json(rows);
    return;
  }
  let sql = 'SELECT * FROM organizations ORDER BY name';
  let params: any[] = [];
  if (type) {
    sql = 'SELECT * FROM organizations WHERE type = $1 ORDER BY name';
    params = [type];
  }
  const { rows } = await query(sql, params);
  res.json(rows);
}

export async function createOrganization(req: Request, res: Response): Promise<void> {
  const { name, type, jurisdiction, legalRegistrationNumber } = req.body;
  const { rows } = await query(
    'INSERT INTO organizations (name, type, jurisdiction, legal_registration_number) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, type, jurisdiction, legalRegistrationNumber || null]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'organization.create', entityType: 'organization', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function listOrganizationMembers(req: Request, res: Response): Promise<void> {
  if (req.params.id !== req.user!.organizationId && !req.user!.permissions?.includes('*')) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.active, u.mfa_enabled, u.created_at,
            array_agg(r.name) as roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.organization_id = $1
     GROUP BY u.id`,
    [req.params.id]
  );
  res.json(rows);
}
