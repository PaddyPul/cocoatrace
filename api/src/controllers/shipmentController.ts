import { activatePaymentInstallments } from '../modules/payments/dueDates';
import { lockRecallBoundary, assertBatchNotRecalled } from '../modules/recall/safety';
import { Request, Response } from 'express';
import { getClient, query } from '../db';
import { dispatchDecision, PaymentPlan } from '../services/paymentProtection';
import { recordTradeAudit } from '../modules/trading/transaction';
import { completeTradeIfReady } from '../services/tradeSettlement';

// Includes legacy demo milestones so existing records remain readable.
const MILESTONE_ORDER = [
  'planning', 'booked', 'requested', 'accepted', 'cargo_ready', 'picked_up',
  'warehouse_received', 'handed_over', 'port_received', 'loaded', 'departed',
  'arrived', 'customs_cleared', 'delivered',
];

export async function listShipments(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT sh.*,c.seller_organization_id,c.buyer_organization_id,c.payment_plan,c.payment_terms_status,p.amount_confirmed,p.dispatch_required_amount,p.security_status,p.release_status,
            coordinator.name as transport_coordinator_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id=sh.contract_id
     LEFT JOIN organizations coordinator ON coordinator.id=sh.transport_coordinator_organization_id
     LEFT JOIN LATERAL(SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)p ON TRUE
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY sh.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getShipment(req: Request, res: Response): Promise<void> {
  const shipRes = await query(
    `SELECT sh.*,c.seller_organization_id,c.buyer_organization_id,c.incoterm,c.payment_plan,c.payment_terms_status,c.deposit_percentage,
            p.id payment_request_id,p.status payment_status,p.amount_total,p.amount_confirmed,p.dispatch_required_amount,p.security_status,p.release_status,
            seller.name as seller_name, buyer.name as buyer_name,
            coordinator.name as transport_coordinator_name
     FROM shipments sh
     JOIN sales_contracts c ON c.id=sh.contract_id
     JOIN organizations seller ON seller.id=c.seller_organization_id
     JOIN organizations buyer ON buyer.id=c.buyer_organization_id
     LEFT JOIN organizations coordinator ON coordinator.id=sh.transport_coordinator_organization_id
     LEFT JOIN LATERAL(SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1)p ON TRUE
     WHERE sh.id=$1`,
    [req.params.id]
  );
  if (!shipRes.rows[0]) {
    res.status(404).json({ error: 'Transport record not found' });
    return;
  }
  const shipment = shipRes.rows[0];
  const organizationId = req.user!.organizationId;
  if (shipment.seller_organization_id !== organizationId && shipment.buyer_organization_id !== organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const milestoneRes = await query(
    `SELECT sm.*, u.name as recorded_by_name, o.name as recorded_by_organization_name
       FROM shipment_milestones sm
       JOIN users u ON u.id=sm.recorded_by_user_id
       JOIN organizations o ON o.id=u.organization_id
      WHERE sm.shipment_id=$1 ORDER BY sm.recorded_at ASC`,
    [req.params.id]
  );
  res.json({ shipment, milestones: milestoneRes.rows });
}

export async function updateShipmentDetails(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const {
    serviceProviderName, bookingReference, transportMode, transportDocumentType,
    transportDocumentReference, trackingUrl, vesselName, containerReference,
    originLocation, destinationLocation, etaArrival,
  } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await lockRecallBoundary(client);
    const selected = await client.query(`SELECT c.status FROM sales_contracts c JOIN shipments sh ON sh.contract_id=c.id WHERE sh.id=$1 AND sh.transport_coordinator_organization_id=$2 FOR UPDATE OF c`, [id, req.user!.organizationId]);
    if (selected.rows[0]?.status === 'cancelled') {
      await client.query('ROLLBACK'); res.status(409).json({ error: 'This trade has been cancelled' }); return;
    }
  const { rows } = await client.query(
    `UPDATE shipments sh SET
       service_provider_name=COALESCE($1, service_provider_name),
       booking_reference=COALESCE($2, booking_reference),
       transport_mode=COALESCE($3, transport_mode),
       transport_document_type=COALESCE($4, transport_document_type),
       transport_document_reference=COALESCE($5, transport_document_reference),
       tracking_url=COALESCE($6, tracking_url),
       vessel_name=COALESCE($7, vessel_name),
       container_reference=COALESCE($8, container_reference),
       origin_port=COALESCE($9, origin_port),
       destination_port=COALESCE($10, destination_port),
       eta_arrival=COALESCE($11, eta_arrival),
       bill_of_lading_number=CASE WHEN $4='bill_of_lading' THEN COALESCE($5, bill_of_lading_number) ELSE bill_of_lading_number END,
       current_milestone=CASE WHEN current_milestone='planning' AND ($1 IS NOT NULL OR $2 IS NOT NULL) THEN 'booked' ELSE current_milestone END
     FROM sales_contracts c
     WHERE sh.id=$12 AND c.id=sh.contract_id
       AND sh.transport_coordinator_organization_id=$13
       AND sh.current_milestone <> 'delivered'
     RETURNING sh.*`,
    [
      serviceProviderName || null, bookingReference || null, transportMode || null,
      transportDocumentType || null, transportDocumentReference || null, trackingUrl || null,
      vesselName || null, containerReference || null, originLocation || null,
      destinationLocation || null, etaArrival || null, id, req.user!.organizationId,
    ]
  );
  if (!rows[0]) {
    await client.query('ROLLBACK');
    res.status(403).json({ error: 'Only the buyer or seller assigned by the Incoterm can edit the transport arrangement' });
    return;
  }
  if (rows[0].current_milestone === 'booked') {
    await client.query(
      `INSERT INTO shipment_milestones (shipment_id, milestone, recorded_by_user_id, notes)
       SELECT $1, 'booked', $2, 'External transport arrangement recorded'
       WHERE NOT EXISTS (SELECT 1 FROM shipment_milestones WHERE shipment_id=$1 AND milestone='booked')`,
      [id, req.user!.id]
    );
    await client.query("UPDATE sales_contracts SET status='fulfilment_in_progress' WHERE id=$1 AND status='accepted'", [rows[0].contract_id]);
  }
  await recordTradeAudit(client, req.user!, 'transport.arrangement.update', 'shipment', id);
  await client.query('COMMIT');
  res.json(rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function recordMilestone(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const {milestone,location,notes,exceptionalDispatch}=req.body,client=await getClient();
  try{await client.query('BEGIN');await lockRecallBoundary(client);const r=await client.query(`SELECT sh.*,c.seller_organization_id,c.buyer_organization_id,c.payment_plan,c.payment_terms_status,c.credit_days,c.holding_id,c.quantity_kg as contract_quantity_kg,c.status as contract_status,p.id payment_request_id,p.amount_confirmed,p.dispatch_required_amount,p.security_status
    FROM shipments sh JOIN sales_contracts c ON c.id=sh.contract_id JOIN payment_requests p ON p.contract_id=c.id WHERE sh.id=$1 FOR UPDATE OF sh,c,p`,[id]);const s=r.rows[0],org=req.user!.organizationId;
    if(!s){await client.query('ROLLBACK');res.status(404).json({error:'Transport record not found'});return;}if(s.seller_organization_id!==org&&s.buyer_organization_id!==org){await client.query('ROLLBACK');res.status(403).json({error:'Only a party can report progress'});return;}
    if(s.contract_status==='cancelled'){await client.query('ROLLBACK');res.status(409).json({error:'This trade has been cancelled'});return;}
    if(!MILESTONE_ORDER.includes(milestone)){await client.query('ROLLBACK');res.status(400).json({error:'Unknown transport milestone'});return;}const current=MILESTONE_ORDER.indexOf(s.current_milestone),next=MILESTONE_ORDER.indexOf(milestone);if(next<=current){await client.query('ROLLBACK');res.status(400).json({error:`Cannot go from ${s.current_milestone} to ${milestone}. Milestones must progress forward.`});return;}
    // A safety recall cannot be overridden by the exceptional-payment dispatch option.
    // Arrival, customs and receipt records stay available for containment and recovery.
    if(['picked_up','handed_over','port_received','loaded','departed'].includes(milestone)||(current<MILESTONE_ORDER.indexOf('picked_up')&&next>=MILESTONE_ORDER.indexOf('picked_up'))){const holding=await client.query('SELECT batch_id FROM batch_holdings WHERE id=$1',[s.holding_id]);if(holding.rows[0])await assertBatchNotRecalled(client,holding.rows[0].batch_id);}
    const crosses=['picked_up','handed_over','port_received','loaded','departed'].includes(milestone)||(current<MILESTONE_ORDER.indexOf('picked_up')&&next>=MILESTONE_ORDER.indexOf('picked_up'));let exception=false;
    if (crosses) { const issue = await client.query("SELECT id FROM payment_issues WHERE payment_request_id=$1 AND status<>'resolved' LIMIT 1", [s.payment_request_id]); if (issue.rows[0]) { await client.query('ROLLBACK'); res.status(409).json({ error: 'Resolve the active payment issue before dispatch', code: 'PAYMENT_ISSUE_HOLD' }); return; } }
    if(crosses){const d=dispatchDecision({plan:s.payment_plan as PaymentPlan,termsStatus:s.payment_terms_status,amountConfirmed:Number(s.amount_confirmed||0),dispatchRequiredAmount:Number(s.dispatch_required_amount||0),securityStatus:s.security_status||'not_required'});if(!d.allowed){if(!exceptionalDispatch){await client.query('ROLLBACK');res.status(409).json({error:d.reason,code:'PAYMENT_DISPATCH_GATE'});return;}if(s.seller_organization_id!==org){await client.query('ROLLBACK');res.status(403).json({error:'Only the seller can authorize exceptional dispatch'});return;}exception=true;await client.query(`UPDATE shipments SET dispatch_exception=TRUE,dispatch_exception_reason=$1,dispatch_exception_recorded_at=NOW(),dispatch_exception_recorded_by_user_id=$2 WHERE id=$3`,[exceptionalDispatch.reason,req.user!.id,id]);}}
    await client.query('INSERT INTO shipment_milestones(shipment_id,milestone,recorded_by_user_id,location,notes)VALUES($1,$2,$3,$4,$5)',[id,milestone,req.user!.id,location||null,notes||null]);
    if(next>=MILESTONE_ORDER.indexOf('loaded'))await client.query('UPDATE sales_contracts SET status=$1 WHERE id=$2',[exception||s.dispatch_exception?'payment_risk_exception':'in_transit',s.contract_id]);
    if(milestone==='delivered'){await activatePaymentInstallments(client,s.payment_request_id,'delivery',{creditDays:Number(s.credit_days||0)});const due=await client.query("SELECT 1 FROM payment_installments WHERE payment_request_id=$1 AND status='due' LIMIT 1",[s.payment_request_id]);if(due.rows[0])await client.query("UPDATE payment_requests SET status='payment_due',updated_at=NOW() WHERE id=$1",[s.payment_request_id]);await client.query('UPDATE sales_contracts SET status=$1 WHERE id=$2',[exception||s.dispatch_exception?'delivered_payment_risk':'delivered',s.contract_id]);await client.query(`INSERT INTO lot_distributions(lot_id,shipment_id,recipient_organization_id,quantity_kg,distribution_reference,dispatched_at) SELECT ml.id,$1,$2,$3,$4,COALESCE((SELECT recorded_at FROM shipment_milestones WHERE shipment_id=$1 AND milestone IN('loaded','departed') ORDER BY recorded_at LIMIT 1),NOW()) FROM batch_holdings h JOIN material_lots ml ON ml.batch_id=h.batch_id WHERE h.id=$5 ON CONFLICT(distribution_reference) DO UPDATE SET recipient_organization_id=EXCLUDED.recipient_organization_id,quantity_kg=EXCLUDED.quantity_kg`,[id,s.buyer_organization_id,s.contract_quantity_kg,`SHIP-${id}`,s.holding_id]);}
    const fields=`current_milestone=$1${milestone==='delivered'?', delivered_at=NOW()':''}`;const {rows}=await client.query(`UPDATE shipments SET ${fields} WHERE id=$2 RETURNING *`,[milestone,id]);if(milestone==='delivered')await completeTradeIfReady(client,s.contract_id);await recordTradeAudit(client,req.user!,`transport.milestone.${milestone}`,'shipment',id,{reason:exception?exceptionalDispatch.reason:null});await client.query('COMMIT');
    res.json({...rows[0],dispatchExceptionRecorded:exception});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
