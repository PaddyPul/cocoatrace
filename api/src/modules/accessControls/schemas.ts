import { z } from 'zod';
export const targetSchema = z.object({
  kind: z.enum(['organizations', 'users']),
  id: z.string().uuid(),
});
export const listSchema = z.object({
  after: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});
export const decisionSchema = z
  .object({
    suspended: z.boolean(),
    reason: z.string().trim().min(10).max(1000),
    currentPassword: z.string().min(1).max(200),
  })
  .strict();
