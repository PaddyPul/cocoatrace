import {
  legacyAuditRecords,
  readAuditRecords,
  readAuditSummary,
} from '../modules/catalog/auditRecords';
import { withCatalogRead } from '../modules/catalog/paging';
import { Request, Response } from 'express';
import { downloadAuditReport } from '../modules/catalog/exportDownloads';

export async function listAuditEvents(req: Request, res: Response): Promise<void> {
  res
    .set('Cache-Control', 'no-store')
    .json(await withCatalogRead((execute) => legacyAuditRecords(execute, req.user!, req.query)));
}
export async function pageAuditEvents(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store').json(await readAuditRecords(req.user!, req.query));
}
export async function summaryAuditEvents(req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store').json(await readAuditSummary(req.user!, req.query));
}

export async function exportAuditLog(req: Request, res: Response): Promise<void> {
  const report = await downloadAuditReport(req.user!, req.query);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.json"`);
  res.send(report.payload);
}
