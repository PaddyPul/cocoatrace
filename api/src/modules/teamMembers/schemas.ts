import { z } from 'zod';
export const pageSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).default(''),
    cursor: z.string().uuid().optional(),
  })
  .strict();
export const targetSchema = z.object({ id: z.string().uuid() }).strict();
export const decisionSchema = z
  .object({
    reason: z.string().trim().min(10).max(1000),
    currentPassword: z.string().min(1).max(1024),
  })
  .strict();
export const roleSchema = decisionSchema.extend({ role: z.string().min(1).max(100) }).strict();
