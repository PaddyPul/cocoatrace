import { insertFarm, insertPlot, lockOwnedFarm } from './repository';
import type { AuditActor } from '../../services/auditWriter';
import type { z } from 'zod';
import { createFarmSchema, createPlotSchema } from '../../validation';
import { inTradeTransaction as inTransaction, recordTradeAudit } from '../trading/transaction';
export async function createFarm(actor: AuditActor, input: z.infer<typeof createFarmSchema>) {
  const farm = await inTransaction(async (client) => {
    const created = await insertFarm(client, actor.organizationId, input);
    await recordTradeAudit(client, actor, 'farm.create', 'farm', created.id, {
      claimSource: 'supplier_declaration',
    });
    return created;
  });
  return farm;
}

export async function createPlot(
  actor: AuditActor,
  id: string,
  input: z.infer<typeof createPlotSchema>,
) {
  const { geolocationSource } = input;
  const plot = await inTransaction(async (client) => {
    if (!(await lockOwnedFarm(client, id, actor.organizationId))) return null;
    const created = await insertPlot(client, id, input);
    await recordTradeAudit(client, actor, 'plot.create', 'plot', created.id, {
      claimSource: 'supplier_declaration',
      geolocationSource,
    });
    return created;
  });
  return plot;
}
