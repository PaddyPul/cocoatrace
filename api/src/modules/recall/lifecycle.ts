import { TRACE_LIMITS, TraceBudget, TraceIncompleteError, checkTraceSize } from '../trace/limits';
import { ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { calculateTraceForward } from '../../services/recallTrace';
import { accessibleTraceLotIds, loadTraceGraph } from '../../services/traceGraphRepository';
import { inTradeTransaction, recordTradeAudit, TradeActor } from '../trading/transaction';
import { registerRecallParticipants } from './notifications';
import { lockRecallBoundary } from './safety';

type RecallInput = { referenceCode:string; title:string; reason:string; instructions:string; severity:string;
  batchIds:string[]; lots:Array<{lotId:string;quantityKg?:number}> };

export async function activateRecall(actor:TradeActor, canManageAll:boolean, input:RecallInput) {
  return inTradeTransaction(async client => {
    const budget = new TraceBudget(TRACE_LIMITS.activationMs);
    await client.query(`SET LOCAL statement_timeout = '${TRACE_LIMITS.statementMs}ms'`);
    await lockRecallBoundary(client,true);
    budget.step();
    const runQuery = (sql:string, params?:any[]) => client.query(sql,params);
    checkTraceSize(input.lots.length + input.batchIds.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
    const sourceLots = input.batchIds.length ? (await client.query('SELECT id,batch_id FROM material_lots WHERE batch_id=ANY($1::uuid[]) ORDER BY id LIMIT $2', [input.batchIds, TRACE_LIMITS.seeds + 1])).rows : [];
    checkTraceSize(sourceLots.length, TRACE_LIMITS.seeds, 'SEEDS_LIMIT');
    const seeds = [...input.lots];
    for (const batchId of input.batchIds) {
      const sourceLot = sourceLots.find(lot => lot.batch_id === batchId);
      if (!sourceLot) throw new ValidationError('Selected batch has no source material lot and cannot be quantity-traced');
      if (!seeds.some(seed => seed.lotId===sourceLot.id)) seeds.push({lotId:sourceLot.id});
    }
    if (!canManageAll) {
      const accessible=await accessibleTraceLotIds(actor.organizationId,false,runQuery,seeds.map(seed=>seed.lotId));
      if (seeds.some(seed => !accessible.has(seed.lotId))) throw new ForbiddenError('You can only initiate recalls from lots connected to your organization');
    }
    const graph = await loadTraceGraph(runQuery, seeds.map(seed => seed.lotId));
    budget.step();
    const impact=calculateTraceForward(graph,seeds);
    budget.step();
    const affectedBatchIds=[...new Set(impact.impactedLots.map(lot=>lot.batchId).filter(Boolean))] as string[];
    const recall=(await client.query(`INSERT INTO recall_notices
      (reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id)
      VALUES($1,$2,$3,$4,$5,'active',$6,$7) RETURNING *`,
      [input.referenceCode,input.title,input.reason,input.instructions,input.severity,actor.id,actor.organizationId])).rows[0];
    if(affectedBatchIds.length) await client.query('INSERT INTO recall_affected_batches(recall_id,batch_id) SELECT $1,unnest($2::uuid[])',[recall.id,affectedBatchIds]);
    await client.query(`INSERT INTO recall_affected_lots(recall_id,lot_id,source_equivalent_kg,recall_quantity_kg,relationship_depth)
      SELECT $1,lot_id,equivalent,recall_quantity,depth FROM unnest($2::uuid[],$3::numeric[],$4::numeric[],$5::int[])
      AS affected(lot_id,equivalent,recall_quantity,depth)`, [recall.id,impact.impactedLots.map(lot=>lot.id),
        impact.impactedLots.map(lot=>lot.sourceEquivalentKg),impact.impactedLots.map(lot=>lot.recallQuantityKg),impact.impactedLots.map(lot=>lot.relationshipDepth)]);
    await client.query("INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) SELECT $1,'lot',unnest($2::uuid[])", [recall.id,impact.impactedLots.map(lot=>lot.id)]);
    budget.step();
    await client.query(`INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id)
      SELECT $1,'holding',id FROM batch_holdings WHERE batch_id=ANY($2::uuid[]) ON CONFLICT DO NOTHING`,[recall.id,affectedBatchIds]);
    const withdrawn=await client.query(`UPDATE listings listing SET active=FALSE FROM batch_holdings holding
      WHERE listing.holding_id=holding.id AND holding.batch_id=ANY($1::uuid[]) AND listing.active RETURNING listing.id`,[affectedBatchIds]);
    budget.step();
    await registerRecallParticipants(client,recall.id);
    budget.step();
    await recordTradeAudit(client,actor,'recall.activate','recall_notice',recall.id,{reason:input.reason,
      affectedBatchIds,affectedLotIds:impact.impactedLots.map(lot=>lot.id),withdrawnListingIds:withdrawn.rows.map(row=>row.id),
      holdScope:'entire affected batch; quantities and commitments unchanged'});
    budget.step();
    return {...recall,analysis:impact.analysis,batch_ids:affectedBatchIds,affected_lots:impact.impactedLots,impact:impact.totals};
  }).catch(error => {
    if ((error as {code?: string}).code === '57014') throw new TraceIncompleteError('DATABASE_TIMEOUT');
    throw error;
  });
}
