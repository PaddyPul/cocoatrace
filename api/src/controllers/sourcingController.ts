import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listRequests(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT sr.*, o.name AS buyer_name
     FROM sourcing_requests sr
     JOIN organizations o ON o.id=sr.buyer_organization_id
     WHERE sr.buyer_organization_id=$1 OR sr.status='open'
     ORDER BY sr.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(result.rows);
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
  const { id } = req.params;
  const { status, title, offerDeadline } = req.body;
  const result = await query(
    `UPDATE sourcing_requests SET
       status=COALESCE($1,status), title=COALESCE($2,title),
       offer_deadline=COALESCE($3,offer_deadline), updated_at=NOW()
     WHERE id=$4 AND buyer_organization_id=$5 RETURNING *`,
    [status || null, title || null, offerDeadline || null, id, req.user!.organizationId]
  );
  if (!result.rows[0]) { res.status(404).json({ error: 'Sourcing request not found' }); return; }
  res.json(result.rows[0]);
}
