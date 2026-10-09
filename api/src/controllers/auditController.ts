import { Request, Response } from 'express';
import { query } from '../db';
import crypto from 'node:crypto';
import { hashObject } from '../services/audit';
import { completeAuditExport } from '../modules/catalog/auditExport';
import { hasExplicitPermission } from '../services/resourcePolicy';

export async function listAuditEvents(req: Request, res: Response): Promise<void> {
  const { entityType, entityId, limit = 50, offset = 0 } = req.query;
  const seeAll = hasExplicitPermission(req.user!, 'audit.read.all');
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
  const report = await completeAuditExport(req.user!, req.query);
  // A successful download must have durable attribution. The old non-UUID entity ID
  // made the best-effort audit insert fail silently.
  await query(`INSERT INTO audit_events
    (actor_user_id,actor_organization_id,action,entity_type,entity_id,reason,metadata,new_state_hash)
    VALUES($1,$2,'export','audit',$3,'Audit log export requested',$4,$5)`,
    [req.user!.id, req.user!.organizationId, crypto.randomUUID(),
      JSON.stringify({ ...report.filters, recordCount: report.count, bytes: report.bytes,
        scope: hasExplicitPermission(req.user!, 'audit.export.all') ? 'network' : 'organization' }),
      hashObject({ count: report.count, bytes: report.bytes, at: new Date().toISOString() })]);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.json"`);
  res.send(report.payload);
}
