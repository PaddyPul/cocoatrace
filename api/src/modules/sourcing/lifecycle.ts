import { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import type { Execute } from '../catalog/paging';
export const closeoutSchema = z
  .object({
    status: z.enum(['awarded', 'closed']),
    reason: z.string().trim().min(10).max(2000),
    confirmed: z.literal(true),
    contractId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if ((data.status === 'awarded') !== Boolean(data.contractId))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Award requires an existing contract; closed requests must omit contractId',
      });
  });
export async function closeoutSourcing(
  execute: Execute,
  actor: { id: string; organizationId: string },
  id: string,
  body: unknown,
) {
  if (!z.string().uuid().safeParse(id).success) throw new ValidationError('Invalid request ID');
  const data = closeoutSchema.parse(body);
  const request = (
    await execute(
      'SELECT * FROM sourcing_requests WHERE id=$1 AND buyer_organization_id=$2 FOR UPDATE',
      [id, actor.organizationId],
    )
  ).rows[0];
  if (!request) throw new NotFoundError('Sourcing request');
  if (!['draft', 'open'].includes(String(request.status)))
    throw new ConflictError('This request is already terminal');
  if (data.status === 'awarded' && request.status !== 'open')
    throw new ConflictError('Publish the request before recording an award');
  if (data.contractId) {
    // Historical offers have no sourcing provenance. This is an explicit reviewed association.
    const contract = (
      await execute(
        `SELECT c.id,c.status,b.crop AS commodity FROM sales_contracts c JOIN batch_holdings h ON h.id=c.holding_id JOIN harvest_batches b ON b.id=h.batch_id
      WHERE c.id=$1 AND c.buyer_organization_id=$2 FOR UPDATE OF c`,
        [data.contractId, actor.organizationId],
      )
    ).rows[0];
    if (!contract) throw new NotFoundError('Buyer contract');
    if (
      contract.status === 'cancelled' ||
      String(contract.commodity).trim().toLowerCase() !==
        String(request.commodity).trim().toLowerCase()
    )
      throw new ValidationError('Choose a noncancelled buyer contract with the same commodity');
  }
  await execute(
    `INSERT INTO sourcing_request_closeouts(request_id,buyer_organization_id,actor_user_id,status,reason,contract_id,association_basis)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      actor.organizationId,
      actor.id,
      data.status,
      data.reason,
      data.contractId || null,
      data.contractId ? 'buyer_manual' : null,
    ],
  );
  return (
    await execute(
      'UPDATE sourcing_requests SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *',
      [id, data.status],
    )
  ).rows[0];
}
export async function sourcingCloseout(execute: Execute, organizationId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new ValidationError('Invalid request ID');
  const request = (
    await execute('SELECT id FROM sourcing_requests WHERE id=$1 AND buyer_organization_id=$2', [
      id,
      organizationId,
    ])
  ).rows[0];
  if (!request) throw new NotFoundError('Sourcing request');
  return {
    closeout:
      (
        await execute(
          'SELECT status,reason,contract_id,association_basis,created_at FROM sourcing_request_closeouts WHERE request_id=$1',
          [id],
        )
      ).rows[0] || null,
  };
}
