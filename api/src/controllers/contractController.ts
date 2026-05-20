import { Request, Response } from 'express';
import { query, getClient } from '../db';
import * as audit from '../services/audit';

export async function listOffers(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT t.*, l.origin_location, l.destination_location, o.name as buyer_name
     FROM trade_offers t
     JOIN listings l ON l.id = t.listing_id
     JOIN organizations o ON o.id = t.buyer_organization_id
     WHERE l.seller_organization_id=$1 OR t.buyer_organization_id=$1
     ORDER BY t.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function makeOffer(req: Request, res: Response): Promise<void> {
  const listingId = req.params.id as string;
  const { quantityKg, offeredPricePerKg, currency, validUntil } = req.body;
  const listingRes = await query('SELECT * FROM listings WHERE id=$1 AND active=TRUE', [listingId]);
  if (!listingRes.rows[0]) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }
  if (quantityKg > listingRes.rows[0].available_quantity_kg) {
    res.status(400).json({ error: 'Quantity exceeds listing' });
    return;
  }
  const { rows } = await query(
    'INSERT INTO trade_offers (listing_id, buyer_organization_id, quantity_kg, offered_price_per_kg, currency, valid_until) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [listingId, req.user!.organizationId, quantityKg, offeredPricePerKg, currency, validUntil || new Date(Date.now() + 7 * 86400000)]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'offer.create', entityType: 'trade_offer', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function acceptOffer(req: Request, res: Response): Promise<void> {
  const offerId = req.params.id as string;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const offRes = await client.query('SELECT o.*, l.holding_id, l.seller_organization_id, l.incoterm FROM trade_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=$1 AND o.status=$2', [offerId, 'pending']);
    const offer = offRes.rows[0];
    if (!offer) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Offer not found or not pending' });
      return;
    }
    if (offer.seller_organization_id !== req.user!.organizationId) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Not your listing' });
      return;
    }

    await client.query("UPDATE trade_offers SET status='accepted' WHERE id=$1", [offerId]);
    await client.query("UPDATE batch_holdings SET status='committed' WHERE id=$1", [offer.holding_id]);
    await client.query("UPDATE listings SET active=FALSE WHERE id=$1", [offer.listing_id]);

    const contractRes = await client.query(
      'INSERT INTO sales_contracts (listing_id, offer_id, seller_organization_id, buyer_organization_id, holding_id, quantity_kg, price_per_kg, currency, incoterm) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [offer.listing_id, offer.id, req.user!.organizationId, offer.buyer_organization_id, offer.holding_id, offer.quantity_kg, offer.offered_price_per_kg, offer.currency, offer.incoterm]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.create', entityType: 'sales_contract', entityId: contractRes.rows[0].id });
    res.json({ offer, contract: contractRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectOffer(req: Request, res: Response): Promise<void> {
  const offerId = req.params.id as string;
  const { rows } = await query("UPDATE trade_offers SET status='rejected' WHERE id=$1 RETURNING *", [offerId]);
  res.json(rows[0]);
}

export async function listContracts(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name, h.quantity_kg as holding_qty
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     JOIN batch_holdings h ON h.id = c.holding_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY c.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getContract(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name,
            ship.id as shipment_id, ship.vessel_name, ship.current_milestone, ship.eta_arrival, ship.container_reference
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     LEFT JOIN shipments ship ON ship.contract_id = c.id
     WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [id, req.user!.organizationId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  res.json(rows[0]);
}

export async function updateEudrReference(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { eudrDueDiligenceReference } = req.body;
  const { rows } = await query('UPDATE sales_contracts SET eudr_due_diligence_reference=$1 WHERE id=$2 AND buyer_organization_id=$3 RETURNING *', [eudrDueDiligenceReference, id, req.user!.organizationId]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.eudr.update', entityType: 'sales_contract', entityId: id });
  res.json(rows[0]);
}
