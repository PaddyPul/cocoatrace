import { inDatabaseTransaction } from '../services/databaseTransaction';
import { recordAudit } from '../services/auditWriter';
import { editSourcingRequest } from '../modules/sourcing/edit';
import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';
import { withCatalogRead } from '../modules/catalog/paging';
import { legacySourcing, sourcingPage, sourcingSummary } from '../modules/catalog/sourcingRecords';
import { structureSourcingBrief } from '../services/sourcingStructurer';

export async function structureRequest(req: Request, res: Response): Promise<void> {
  res.json(structureSourcingBrief(req.body.brief));
}

export async function listRequests(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute => legacySourcing(execute, req.user!)));
}
export async function listRequestPage(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute => sourcingPage(execute, req.user!, req.query)));
}
export async function summarizeRequests(req: Request, res: Response): Promise<void> {
  res.json(await withCatalogRead(execute => sourcingSummary(execute, req.user!)));
}

export async function createRequest(req: Request, res: Response): Promise<void> {
  const {
    title, commodity, quantityKg, originCountries, qualityRequirements,
    assuranceRequirements, deliveryLocation, incoterm, requiredBy,
    offerDeadline, visibility, status,
  } = req.body;
  const result = await query(
    `INSERT INTO sourcing_requests (
      buyer_organization_id,created_by_user_id,title,commodity,quantity_kg,
      origin_countries,quality_requirements,assurance_requirements,delivery_location,
      incoterm,required_by,offer_deadline,visibility,status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.user!.organizationId, req.user!.id, title, commodity, quantityKg,
      originCountries || [], qualityRequirements || {}, assuranceRequirements || {},
      deliveryLocation, incoterm || 'CIF', requiredBy || null, offerDeadline || null,
      visibility || 'matched', status || 'draft']
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'sourcing_request.create', entityType: 'sourcing_request', entityId: result.rows[0].id });
  res.status(201).json(result.rows[0]);
}

export async function updateRequest(req: Request, res: Response): Promise<void> {
  const result = await inDatabaseTransaction(async client => {
    const row = await editSourcingRequest(client.query.bind(client), req.user!, req.params.id, req.body);
    await recordAudit(client, req.user!, 'sourcing_request.update', 'sourcing_request', req.params.id, { changedFields: Object.keys(req.body) });
    return row;
  });
  res.json(result);
}
