import {legacyAuditRecords,readAuditRecords,readAuditSummary} from '../modules/catalog/auditRecords';
import {withCatalogRead} from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { query } from '../db';
import crypto from 'node:crypto';
import { hashObject } from '../services/audit';
import { completeAuditExport } from '../modules/catalog/auditExport';
import { hasExplicitPermission } from '../services/resourcePolicy';

export async function listAuditEvents(req:Request,res:Response):Promise<void>{
 res.set('Cache-Control','no-store').json(await withCatalogRead(execute=>legacyAuditRecords(execute,req.user!,req.query)));
}
export async function pageAuditEvents(req:Request,res:Response):Promise<void>{res.set('Cache-Control','no-store').json(await readAuditRecords(req.user!,req.query));}
export async function summaryAuditEvents(req:Request,res:Response):Promise<void>{res.set('Cache-Control','no-store').json(await readAuditSummary(req.user!,req.query));}

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
