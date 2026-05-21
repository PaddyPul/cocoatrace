import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function listPaymentRequests(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT p.*, c.seller_organization_id, c.buyer_organization_id
     FROM payment_requests p
     JOIN sales_contracts c ON c.id = p.contract_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY p.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getPaymentRequest(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT p.*, c.seller_organization_id, c.buyer_organization_id, c.quantity_kg, c.price_per_kg, c.incoterm,
            s.name as seller_name, b.name as buyer_name
     FROM payment_requests p
     JOIN sales_contracts c ON c.id = p.contract_id
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     WHERE p.id=$1`,
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Payment request not found' });
    return;
  }
  if (rows[0].seller_organization_id !== req.user!.organizationId && rows[0].buyer_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json(rows[0]);
}

export async function createPaymentRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { amountTotal, currency } = req.body;
  const contractRes = await query('SELECT * FROM sales_contracts WHERE id=$1 AND seller_organization_id=$2', [id, req.user!.organizationId]);
  if (!contractRes.rows[0]) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  const { rows } = await query(
    'INSERT INTO payment_requests (contract_id, requested_by_organization_id, amount_total, currency) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, req.user!.organizationId, amountTotal, currency]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'payment.request', entityType: 'payment_request', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function payPaymentRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { transactionReference } = req.body;
  const check = await query(
    'SELECT p.id, c.buyer_organization_id FROM payment_requests p JOIN sales_contracts c ON c.id=p.contract_id WHERE p.id=$1',
    [id]
  );
  if (!check.rows[0]) {
    res.status(404).json({ error: 'Payment request not found' });
    return;
  }
  if (check.rows[0].buyer_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Only the buyer can settle this payment' });
    return;
  }
  const { rows } = await query("UPDATE payment_requests SET status='settled', payment_reference_external=$1, settled_at=NOW() WHERE id=$2 RETURNING *", [transactionReference, id]);
  await query("UPDATE sales_contracts SET status='settled' WHERE id=$1", [rows[0].contract_id]);
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'payment.settle', entityType: 'payment_request', entityId: id });
  res.json(rows[0]);
}
