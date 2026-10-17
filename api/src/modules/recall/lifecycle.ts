import { TRACE_LIMITS, TraceBudget, TraceIncompleteError, checkTraceSize } from '../trace/limits';
import { ForbiddenError, ValidationError } from '../../errors';
import { calculateTraceForward } from '../../services/recallTrace';
import { accessibleTraceLotIds, loadTraceGraph } from '../../services/traceGraphRepository';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { registerRecallParticipants } from './notifications';
import { lockRecallBoundary } from './safety';

import {
  configureActivationTimeout,
  loadActivationSourceLots,
  persistRecallActivation,
  type RecallInput,
} from './activationRepository';

export async function activateRecall(actor: TradeActor, canManageAll: boolean, input: RecallInput) {
  return inTradeTransaction(async (client) => {
    const budget = new TraceBudget(TRACE_LIMITS.activationMs);
    await configureActivationTimeout(client);
    await lockRecallBoundary(client, true);
    budget.step();
    const runQuery = (sql: string, params?: unknown[]) => client.query(sql, params);
    checkTraceSize(input.lots.length + input.batchIds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
    const sourceLots = await loadActivationSourceLots(client, input.batchIds);
    checkTraceSize(sourceLots.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
    const seeds = [...input.lots];
    for (const batchId of input.batchIds) {
      const sourceLot = sourceLots.find((lot) => lot.batch_id === batchId);
      if (!sourceLot)
        throw new ValidationError(
          'Selected batch has no source material lot and cannot be quantity-traced',
        );
      if (!seeds.some((seed) => seed.lotId === sourceLot.id)) seeds.push({ lotId: sourceLot.id });
    }
    if (!canManageAll) {
      const accessible = await accessibleTraceLotIds(
        actor.organizationId,
        false,
        runQuery,
        seeds.map((seed) => seed.lotId),
      );
      if (seeds.some((seed) => !accessible.has(seed.lotId)))
        throw new ForbiddenError(
          'You can only initiate recalls from lots connected to your organization',
        );
    }
    const graph = await loadTraceGraph(
      runQuery,
      seeds.map((seed) => seed.lotId),
    );
    budget.step();
    const impact = calculateTraceForward(graph, seeds);
    budget.step();
    const affectedBatchIds = [
      ...new Set(impact.impactedLots.map((lot) => lot.batchId).filter(Boolean)),
    ] as string[];
    const { recall, withdrawnListingIds } = await persistRecallActivation(
      client,
      actor,
      input,
      impact,
      affectedBatchIds,
      budget,
    );
    await registerRecallParticipants(client, recall.id);
    budget.step();
    await recordTradeAudit(client, actor, 'recall.activate', 'recall_notice', recall.id, {
      reason: input.reason,
      affectedBatchIds,
      affectedLotIds: impact.impactedLots.map((lot) => lot.id),
      withdrawnListingIds,
      holdScope: 'entire affected batch; quantities and commitments unchanged',
    });
    budget.step();
    return {
      ...recall,
      analysis: impact.analysis,
      batch_ids: affectedBatchIds,
      affected_lots: impact.impactedLots,
      impact: impact.totals,
    };
  }).catch((error) => {
    if ((error as { code?: string }).code === '57014')
      throw new TraceIncompleteError('DATABASE_TIMEOUT');
    throw error;
  });
}
