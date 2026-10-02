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
    await lockRecallBoundary(client,true);
    const runQuery = (sql:string, params?:any[]) => client.query(sql,params);
    const graph = await loadTraceGraph(runQuery);
    const seeds = [...input.lots];
    for (const batchId of input.batchIds) {
      const sourceLot = graph.lots.find(lot => lot.batchId === batchId);
      if (!sourceLot) throw new ValidationError('Selected batch has no source material lot and cannot be quantity-traced');
      if (!seeds.some(seed => seed.lotId===sourceLot.id)) seeds.push({lotId:sourceLot.id});
    }
    if (!canManageAll) {
      const accessible=await accessibleTraceLotIds(actor.organizationId,false,runQuery);
      if (seeds.some(seed => !accessible.has(seed.lotId))) throw new ForbiddenError('You can only initiate recalls from lots connected to your organization');
    }
    const impact=calculateTraceForward(graph,seeds);
    const affectedBatchIds=[...new Set(impact.impactedLots.map(lot=>lot.batchId).filter(Boolean))] as string[];
    const recall=(await client.query(`INSERT INTO recall_notices
      (reference_code,title,reason,instructions,severity,status,initiated_by_user_id,initiated_by_organization_id)
      VALUES($1,$2,$3,$4,$5,'active',$6,$7) RETURNING *`,
      [input.referenceCode,input.title,input.reason,input.instructions,input.severity,actor.id,actor.organizationId])).rows[0];
    if(affectedBatchIds.length) await client.query('INSERT INTO recall_affected_batches(recall_id,batch_id) SELECT $1,unnest($2::uuid[])',[recall.id,affectedBatchIds]);
    for(const lot of impact.impactedLots) {
      await client.query(`INSERT INTO recall_affected_lots(recall_id,lot_id,source_equivalent_kg,recall_quantity_kg,relationship_depth)
        VALUES($1,$2,$3,$4,$5)`,[recall.id,lot.id,lot.sourceEquivalentKg,lot.recallQuantityKg,lot.relationshipDepth]);
      await client.query("INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id) VALUES($1,'lot',$2)",[recall.id,lot.id]);
    }
    await client.query(`INSERT INTO recall_safety_holds(recall_id,entity_type,entity_id)
      SELECT $1,'holding',id FROM batch_holdings WHERE batch_id=ANY($2::uuid[]) ON CONFLICT DO NOTHING`,[recall.id,affectedBatchIds]);
    const withdrawn=await client.query(`UPDATE listings listing SET active=FALSE FROM batch_holdings holding
      WHERE listing.holding_id=holding.id AND holding.batch_id=ANY($1::uuid[]) AND listing.active RETURNING listing.id`,[affectedBatchIds]);
    await registerRecallParticipants(client,recall.id);
    await recordTradeAudit(client,actor,'recall.activate','recall_notice',recall.id,{reason:input.reason,
      affectedBatchIds,affectedLotIds:impact.impactedLots.map(lot=>lot.id),withdrawnListingIds:withdrawn.rows.map(row=>row.id),
      holdScope:'entire affected batch; quantities and commitments unchanged'});
    return {...recall,batch_ids:affectedBatchIds,affected_lots:impact.impactedLots,impact:impact.totals};
  });
}
