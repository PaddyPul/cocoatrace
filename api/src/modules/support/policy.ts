import { createHash } from 'node:crypto';
import { z } from 'zod';
export const requestBody = z
  .object({
    idempotencyKey: z.string().uuid(),
    subject: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
    context: z.enum([
      'home',
      'supply',
      'marketplace',
      'offers',
      'agreement',
      'shipment',
      'payment',
      'evidence',
      'recall',
      'account',
      'other',
    ]),
    entityId: z.string().uuid().optional(),
  })
  .strict();
export const reviewBody = z
  .object({
    status: z.enum(['open', 'in_review', 'resolved']),
    expectedStatus: z.enum(['open', 'in_review', 'resolved']),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export type SupportInput = z.infer<typeof requestBody>;
export const bodyHash = (input: SupportInput): string =>
  createHash('sha256')
    .update(
      JSON.stringify([input.subject, input.description, input.context, input.entityId ?? null]),
    )
    .digest('hex');

export type SupportStatus = z.infer<typeof reviewBody>['status'];
