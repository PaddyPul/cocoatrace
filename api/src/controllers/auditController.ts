import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listAuditEvents(req: Request, res: Response): Promise<void> {
  const { entityType, entityId, limit = 50, offset = 0 } = req.query;
  const perms = req.user!.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('audit.view');
  let sql = 'SELECT * FROM audit_events';
  const params: any[] = [];
  const conditions: string[] = [];
  if (!seeAll) {
    conditions.push('actor_organization_id = $1');
    params.push(req.user!.organizationId);
  }
  if (entityType && entityId) {
    conditions.push(`entity_type=$${params.length + 1} AND entity_id=$${params.length + 2}`);
    params.push(entityType, entityId);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ` ORDER BY occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), Number(offset));
  const { rows } = await query(sql, params);
  res.json(rows);
}

export async function exportAuditLog(req: Request, res: Response): Promise<void> {
  const { entityType, entityId } = req.query;
  const perms = req.user!.permissions || [];
  const seeAll = perms.includes('*') || perms.includes('audit.view');
  let sql = 'SELECT * FROM audit_events';
  const params: any[] = [];
  const conditions: string[] = [];
  if (!seeAll) {
    conditions.push('actor_organization_id = $1');
    params.push(req.user!.organizationId);
  }
  if (entityType && entityId) {
    conditions.push(`entity_type=$${params.length + 1} AND entity_id=$${params.length + 2}`);
    params.push(entityType, entityId);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY occurred_at DESC';
  const { rows } = await query(sql, params);

  audit.record({
    actorUserId: req.user!.id,
    actorOrganizationId: req.user!.organizationId,
    action: 'export',
    entityType: 'audit',
    entityId: 'audit-log',
    reason: 'Audit log export requested',
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.json"`);
  res.json(rows);
}
