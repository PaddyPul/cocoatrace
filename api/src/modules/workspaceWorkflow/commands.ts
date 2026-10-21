import { findOnboarding, saveOnboarding, insertFeedback } from './repository';
import { recordAudit, type AuditActor } from '../../services/auditWriter';
import { inDatabaseTransaction } from '../../services/databaseTransaction';
import type { z } from 'zod';
import { onboardingSchema, pilotFeedbackSchema } from '../../validation';
const defaultOnboarding = {
  status: 'not_started',
  current_step: 0,
  primary_goal: null,
  pilot_mode: false,
  completed_at: null,
};
export async function getOnboarding(userId: string) {
  const row = await findOnboarding(userId);
  return row || { user_id: userId, ...defaultOnboarding };
}

export async function updateOnboarding(actor: AuditActor, input: z.infer<typeof onboardingSchema>) {
  if (input.status !== 'completed') return saveOnboarding(actor, input);
  return inDatabaseTransaction(async (client) => {
    const row = await saveOnboarding(actor, input, client);
    await recordAudit(client, actor, 'onboarding.complete', 'user', actor.id);
    return row;
  });
}

export async function createFeedback(
  actor: AuditActor,
  input: z.infer<typeof pilotFeedbackSchema>,
) {
  const row = await insertFeedback(actor, input);
  return row;
}
