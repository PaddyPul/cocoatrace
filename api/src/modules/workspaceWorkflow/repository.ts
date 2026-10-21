import { query } from '../../db';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { onboardingSchema, pilotFeedbackSchema } from '../../validation';
import type { AuditActor } from '../../services/auditWriter';
export interface OnboardingRow {
  user_id: string;
  status: string;
  current_step: number;
  primary_goal: string | null;
  pilot_mode: boolean;
  completed_at: Date | null;
  updated_at: Date;
}
export interface FeedbackRow {
  id: string;
  page: string;
  task: string;
  rating: number;
  comment: string;
  created_at: Date;
}
export async function findOnboarding(userId: string): Promise<OnboardingRow | undefined> {
  const result = await query<OnboardingRow>('SELECT * FROM user_onboarding WHERE user_id=$1', [
    userId,
  ]);
  return result.rows[0];
}
export async function saveOnboarding(
  actor: AuditActor,
  input: z.infer<typeof onboardingSchema>,
  client?: PoolClient,
): Promise<OnboardingRow> {
  const { status, currentStep, primaryGoal, pilotMode } = input;
  const result = await (client ? client.query.bind(client) : query)<OnboardingRow>(
    `INSERT INTO user_onboarding (user_id,status,current_step,primary_goal,pilot_mode,completed_at)
     VALUES ($1,$2,$3,$4,$5,CASE WHEN $2='completed' THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id) DO UPDATE SET status=EXCLUDED.status,
       current_step=EXCLUDED.current_step, primary_goal=EXCLUDED.primary_goal,
       pilot_mode=EXCLUDED.pilot_mode,
       completed_at=CASE WHEN EXCLUDED.status='completed' THEN COALESCE(user_onboarding.completed_at,NOW()) ELSE NULL END,
       updated_at=NOW()
     RETURNING *`,
    [actor.id, status, currentStep, primaryGoal || null, pilotMode],
  );
  return result.rows[0];
}
export async function insertFeedback(
  actor: AuditActor,
  input: z.infer<typeof pilotFeedbackSchema>,
): Promise<FeedbackRow> {
  const { page, task, rating, comment } = input;
  const result = await query<FeedbackRow>(
    `INSERT INTO pilot_feedback (user_id,organization_id,page,task,rating,comment)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, page, task, rating, comment, created_at`,
    [actor.id, actor.organizationId, page, task, rating, comment],
  );
  return result.rows[0];
}
