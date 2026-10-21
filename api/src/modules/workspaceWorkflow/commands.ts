import { findOnboarding, saveOnboarding, insertFeedback } from './repository';
import type { AuditActor } from '../../services/auditWriter';
import type { z } from 'zod';
import * as audit from '../../services/audit';
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
  const row = await saveOnboarding(actor, input);
  if (input.status === 'completed') {
    await audit.record({
      actorUserId: actor.id,
      actorOrganizationId: actor.organizationId,
      action: 'onboarding.complete',
      entityType: 'user',
      entityId: actor.id,
    });
  }
  return row;
}

export async function createFeedback(
  actor: AuditActor,
  input: z.infer<typeof pilotFeedbackSchema>,
) {
  const row = await insertFeedback(actor, input);
  return row;
}
