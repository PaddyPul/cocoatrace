import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';
import { buildTradeActions } from '../services/tradeNextAction';

const defaultOnboarding = {
  status: 'not_started', current_step: 0, primary_goal: null,
  pilot_mode: false, completed_at: null,
};

export async function getOnboarding(req: Request, res: Response): Promise<void> {
  const result = await query('SELECT * FROM user_onboarding WHERE user_id=$1', [req.user!.id]);
  res.json(result.rows[0] || { user_id: req.user!.id, ...defaultOnboarding });
}

export async function updateOnboarding(req: Request, res: Response): Promise<void> {
  const { status, currentStep, primaryGoal, pilotMode } = req.body;
  const result = await query(
    `INSERT INTO user_onboarding (user_id,status,current_step,primary_goal,pilot_mode,completed_at)
     VALUES ($1,$2,$3,$4,$5,CASE WHEN $2='completed' THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id) DO UPDATE SET status=EXCLUDED.status,
       current_step=EXCLUDED.current_step, primary_goal=EXCLUDED.primary_goal,
       pilot_mode=EXCLUDED.pilot_mode,
       completed_at=CASE WHEN EXCLUDED.status='completed' THEN COALESCE(user_onboarding.completed_at,NOW()) ELSE NULL END,
       updated_at=NOW()
     RETURNING *`,
    [req.user!.id, status, currentStep, primaryGoal || null, pilotMode]
  );
  if (status === 'completed') {
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'onboarding.complete', entityType: 'user', entityId: req.user!.id });
  }
  res.json(result.rows[0]);
}

export async function createFeedback(req: Request, res: Response): Promise<void> {
  const { page, task, rating, comment } = req.body;
  const result = await query(
    `INSERT INTO pilot_feedback (user_id,organization_id,page,task,rating,comment)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, page, task, rating, comment, created_at`,
    [req.user!.id, req.user!.organizationId, page, task, rating, comment]
  );
  res.status(201).json(result.rows[0]);
}

export async function listFeedback(req: Request, res: Response): Promise<void> {
  const allAccess = (req.user!.permissions || []).includes('*');
  const result = await query(
    `SELECT f.*, u.name AS user_name, o.name AS organization_name
     FROM pilot_feedback f JOIN users u ON u.id=f.user_id JOIN organizations o ON o.id=f.organization_id
     WHERE ($1::boolean OR f.organization_id=$2) ORDER BY f.created_at DESC LIMIT 500`,
    [allAccess, req.user!.organizationId]
  );
  res.json(result.rows);
}

export async function getTradeActions(req: Request, res: Response): Promise<void> {
  const organizationId=req.user!.organizationId;
  const [offers,deals]=await Promise.all([
    query(`SELECT o.id,o.status,o.buyer_organization_id,l.seller_organization_id,b.name buyer_name,s.name seller_name
      FROM trade_offers o JOIN listings l ON l.id=o.listing_id JOIN organizations b ON b.id=o.buyer_organization_id JOIN organizations s ON s.id=l.seller_organization_id
      WHERE o.status='pending' AND (o.buyer_organization_id=$1 OR l.seller_organization_id=$1)`,[organizationId]),
    query(`SELECT c.id,c.status,c.seller_organization_id,c.buyer_organization_id,c.payment_terms_status,c.payment_plan,c.currency,
      seller.name seller_name,buyer.name buyer_name,p.id payment_request_id,p.status payment_status,p.security_status,
      i.id installment_id,i.status installment_status,i.installment_type,i.amount_due,
      sh.id shipment_id,sh.transport_coordinator_organization_id,sh.current_milestone,
      (SELECT accepted_at FROM delivery_acceptances WHERE contract_id=c.id) AS delivery_accepted_at,
      (SELECT status FROM delivery_discrepancies WHERE contract_id=c.id AND status<>'resolved' LIMIT 1) AS delivery_discrepancy_status,
      (SELECT requested_by_organization_id FROM contract_cancellation_requests WHERE contract_id=c.id AND status='requested') AS cancellation_requested_by_organization_id
      FROM sales_contracts c JOIN organizations seller ON seller.id=c.seller_organization_id JOIN organizations buyer ON buyer.id=c.buyer_organization_id
      LEFT JOIN LATERAL(SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)p ON TRUE
      LEFT JOIN LATERAL(SELECT * FROM payment_installments WHERE payment_request_id=p.id AND status IN('payment_submitted','due') ORDER BY CASE status WHEN 'payment_submitted' THEN 0 ELSE 1 END,sequence_number LIMIT 1)i ON TRUE
      LEFT JOIN LATERAL(SELECT * FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)sh ON TRUE
      WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1 ORDER BY c.created_at DESC`,[organizationId]),
  ]);
  res.json(buildTradeActions(offers.rows,deals.rows,organizationId));
}
