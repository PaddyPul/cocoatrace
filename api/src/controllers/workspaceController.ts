import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

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
