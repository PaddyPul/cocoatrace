import { Request, Response } from 'express';
import { downloadProvenanceReport } from '../modules/catalog/exportDownloads';
import { completeProvenancePack } from '../modules/catalog/provenanceExport';

export async function getProvenancePack(req: Request, res: Response): Promise<void> {
  const report = await completeProvenancePack(
    req.user!,
    req.params.batchId as string,
    req.query,
    'read',
  );
  const {
    exportType: _exportType,
    version: _version,
    generatedBy: _generatedBy,
    ...view
  } = report.payload;
  res.setHeader('Cache-Control', 'no-store');
  res.json(view);
}
export async function exportProvenancePack(req: Request, res: Response): Promise<void> {
  const batchId = req.params.batchId as string;
  const report = await downloadProvenanceReport(req.user!, batchId, req.query);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="provenance-pack-${batchId}.json"`);
  res.send(report.serialized);
}
