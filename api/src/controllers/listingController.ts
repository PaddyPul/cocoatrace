import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listListings(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT l.*, o.name as seller_name, b.crop, b.organic_claim_status, b.grade, b.harvest_date, f.name as farm_name, f.region as farm_region
     FROM listings l
     JOIN organizations o ON o.id = l.seller_organization_id
     JOIN batch_holdings h ON h.id = l.holding_id
     JOIN harvest_batches b ON b.id = h.batch_id
     JOIN farms f ON f.id = b.farm_id
     WHERE l.active = TRUE
     ORDER BY l.created_at DESC`
  );
  res.json(rows);
}

export async function createListing(req: Request, res: Response): Promise<void> {
  const { holdingId, availableQuantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation } = req.body;
  const holdingRes = await query('SELECT * FROM batch_holdings WHERE id=$1 AND holder_organization_id=$2 AND status=$3', [holdingId, req.user!.organizationId, 'available']);
  if (!holdingRes.rows[0]) {
    res.status(400).json({ error: 'Holding not found or not available' });
    return;
  }
  if (availableQuantityKg > holdingRes.rows[0].quantity_kg) {
    res.status(400).json({ error: 'Quantity exceeds holding' });
    return;
  }
  const { rows } = await query(
    'INSERT INTO listings (seller_organization_id, holding_id, available_quantity_kg, price_per_kg, currency, incoterm, origin_location, destination_location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.user!.organizationId, holdingId, availableQuantityKg, pricePerKg, currency, incoterm, originLocation, destinationLocation]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'listing.create', entityType: 'listing', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}
