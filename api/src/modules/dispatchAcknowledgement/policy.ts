import { createHash } from 'node:crypto';
import { z } from 'zod';
export const acknowledgementBody = z
  .object({ exceptionHash: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) })
  .strict();
export function exceptionHash(row: {
  id: string;
  contract_id: string;
  dispatch_exception_reason: string | null;
  dispatch_exception_recorded_at: Date | string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        row.id,
        row.contract_id,
        row.dispatch_exception_reason,
        row.dispatch_exception_recorded_at
          ? new Date(row.dispatch_exception_recorded_at).toISOString()
          : null,
      ]),
    )
    .digest('hex');
}
