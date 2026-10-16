import { z } from 'zod';
export const timingBody = z
  .object({
    expectedRevision: z.number().int().min(0),
    etaArrival: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (value) =>
          Number(value.slice(0, 4)) > 0 &&
          !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
          new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
        'Use a real calendar date',
      ),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export function arrivalOverdue(
  eta: string | null,
  milestone: string,
  status: string,
  now = new Date(),
): boolean {
  return Boolean(
    eta &&
      status !== 'cancelled' &&
      !['arrived', 'customs_cleared', 'unloaded', 'delivered'].includes(milestone) &&
      eta < now.toISOString().slice(0, 10),
  );
}
