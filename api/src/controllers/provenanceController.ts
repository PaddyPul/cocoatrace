import { Request, Response } from 'express';
import { query } from '../db';
import { hashObject } from '../services/audit';
import { completeProvenancePack } from '../modules/catalog/provenanceExport';

export async function getProvenancePack(req: Request, res: Response): Promise<void> {
  const report=await completeProvenancePack(req.user!,req.params.batchId as string,req.query,'read');
  const {exportType: _exportType,version: _version,generatedBy: _generatedBy,...view}=report.payload;
  res.setHeader('Cache-Control','no-store');
  res.json(view);
}
export async function exportProvenancePack(req: Request, res: Response): Promise<void> {
  const batchId=req.params.batchId as string;
  const report=await completeProvenancePack(req.user!,batchId,req.query,'export');
  await query(`INSERT INTO audit_events
    (actor_user_id,actor_organization_id,action,entity_type,entity_id,new_state_hash,reason,metadata)
    VALUES($1,$2,'provenance.export','harvest_batch',$3,$4,'Exported provenance pack as json',$5)`,
    [req.user!.id,req.user!.organizationId,batchId,hashObject({batchId,at:report.payload.generatedAt}),
      JSON.stringify({contractId:report.payload.contractId,bytes:Buffer.byteLength(report.serialized,'utf8')})]);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  res.setHeader('Content-Disposition',`attachment; filename="provenance-pack-${batchId}.json"`);
  res.send(report.serialized);
}
