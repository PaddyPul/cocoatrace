import { Request, Response } from 'express';
import { query } from '../db';

export async function listAuditEvents(req: Request, res: Response): Promise<void> {
  const { entityType, entityId, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM audit_events';
  const params: any[] = [];
  if (entityType && entityId) {
    sql += ' WHERE entity_type=$1 AND entity_id=$2';
    params.push(entityType, entityId);
  }
  sql += ` ORDER BY occurred_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), Number(offset));
  const { rows } = await query(sql, params);
  res.json(rows);
}
