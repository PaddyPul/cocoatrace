import { Request, Response } from 'express';
import { query, getClient } from '../db';
import * as audit from '../services/audit';
import { buildInstallments, PaymentPlan, requiredBeforeDispatch } from '../services/paymentProtection';
import { config } from '../config/env';

const configuredFeeBps = config.platformFeeBps;

export async function listOffers(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT t.*, l.seller_organization_id, l.origin_location, l.destination_location,
            buyer.name as buyer_name, seller.name as seller_name
     FROM trade_offers t
     JOIN listings l ON l.id = t.listing_id
     JOIN organizations buyer ON buyer.id = t.buyer_organization_id
     JOIN organizations seller ON seller.id = l.seller_organization_id
     WHERE l.seller_organization_id=$1 OR t.buyer_organization_id=$1
     ORDER BY t.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function makeOffer(req: Request, res: Response): Promise<void> {
  const listingId = req.params.id as string;
  const { quantityKg, offeredPricePerKg, currency, validUntil } = req.body;
  const listingRes = await query('SELECT * FROM listings WHERE id=$1 AND active=TRUE', [listingId]);
  if (!listingRes.rows[0]) {
    res.status(404).json({ error: 'Listing not found' });
    return;
  }
  if (quantityKg > listingRes.rows[0].available_quantity_kg) {
    res.status(400).json({ error: 'Quantity exceeds listing' });
    return;
  }
  const { rows } = await query(
    'INSERT INTO trade_offers (listing_id, buyer_organization_id, quantity_kg, offered_price_per_kg, currency, valid_until) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [listingId, req.user!.organizationId, quantityKg, offeredPricePerKg, currency, validUntil || new Date(Date.now() + 7 * 86400000)]
  );
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'offer.create', entityType: 'trade_offer', entityId: rows[0].id });
  res.status(201).json(rows[0]);
}

export async function acceptOffer(req: Request, res: Response): Promise<void> {
  const offerId = req.params.id as string;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const offRes = await client.query(`
      SELECT o.*, l.holding_id, l.seller_organization_id, l.incoterm,
             l.origin_location, l.destination_location,
             h.batch_id, h.quantity_kg as holding_quantity, h.warehouse_location
      FROM trade_offers o
      JOIN listings l ON l.id=o.listing_id
      JOIN batch_holdings h ON h.id=l.holding_id
      WHERE o.id=$1 AND o.status=$2
      FOR UPDATE OF o, l, h`, [offerId, 'pending']);
    const offer = offRes.rows[0];
    if (!offer) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Offer not found or not pending' });
      return;
    }
    if (offer.seller_organization_id !== req.user!.organizationId) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Not your listing' });
      return;
    }

    await client.query("UPDATE trade_offers SET status='accepted' WHERE id=$1", [offerId]);
    await client.query("UPDATE trade_offers SET status='rejected' WHERE listing_id=$1 AND id<>$2 AND status='pending'", [offer.listing_id, offerId]);
    const residualQuantity = Number(offer.holding_quantity) - Number(offer.quantity_kg);
    if (residualQuantity > 0) {
      await client.query(
        "INSERT INTO batch_holdings (batch_id, holder_organization_id, quantity_kg, warehouse_location, status) VALUES ($1,$2,$3,$4,'available')",
        [offer.batch_id, req.user!.organizationId, residualQuantity, offer.warehouse_location]
      );
    }
    await client.query("UPDATE batch_holdings SET quantity_kg=$1, status='committed' WHERE id=$2", [offer.quantity_kg, offer.holding_id]);
    await client.query("UPDATE listings SET active=FALSE WHERE id=$1", [offer.listing_id]);

    const contractRes = await client.query(
      `INSERT INTO sales_contracts (listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,currency,incoterm,payment_plan,deposit_percentage,payment_terms_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'deposit_balance',20,'draft') RETURNING *`,
      [offer.listing_id, offer.id, req.user!.organizationId, offer.buyer_organization_id, offer.holding_id, offer.quantity_kg, offer.offered_price_per_kg, offer.currency, offer.incoterm]
    );
    const contractValue=Number(offer.quantity_kg)*Number(offer.offered_price_per_kg);
    const paymentRes=await client.query(`INSERT INTO payment_requests(contract_id,requested_by_organization_id,amount_total,currency,status,payment_method,due_trigger,dispatch_required_amount,security_status)
      VALUES($1,$2,$3,$4,'awaiting_terms','deposit_balance','terms_agreed',$5,'not_required') RETURNING *`,
      [contractRes.rows[0].id,req.user!.organizationId,contractValue,offer.currency,requiredBeforeDispatch('deposit_balance',contractValue,20)]);
    for(const installment of buildInstallments('deposit_balance',contractValue,20)) await client.query(
      `INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status) VALUES($1,$2,$3,$4,$5,'awaiting_trigger')`,
      [paymentRes.rows[0].id,installment.installmentType,installment.sequenceNumber,installment.amountDue,installment.dueTrigger]);
    await client.query(`INSERT INTO platform_fee_invoices(contract_id,fee_payer,rate_bps,amount_total,currency) VALUES($1,'seller',$2,$3,$4)`,
      [contractRes.rows[0].id,configuredFeeBps,Math.round(contractValue*configuredFeeBps/100)/100,offer.currency]);
    const buyerArrangesCarriage = ['EXW', 'FCA', 'FAS', 'FOB'].includes(String(offer.incoterm).toUpperCase());
    const coordinatorOrganizationId = buyerArrangesCarriage ? offer.buyer_organization_id : req.user!.organizationId;
    const shipmentRes = await client.query(
      `INSERT INTO shipments (
         contract_id, transport_coordinator_organization_id, origin_port, destination_port,
         current_milestone, transport_mode
       ) VALUES ($1,$2,$3,$4,'planning','unspecified') RETURNING *`,
      [contractRes.rows[0].id, coordinatorOrganizationId, offer.origin_location, offer.destination_location]
    );
    await client.query('COMMIT');
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.create', entityType: 'sales_contract', entityId: contractRes.rows[0].id });
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'payment.prepare', entityType: 'payment_request', entityId: paymentRes.rows[0].id });
    await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'transport.workspace.create', entityType: 'shipment', entityId: shipmentRes.rows[0].id });
    res.json({ offer, contract: contractRes.rows[0], paymentRequest: paymentRes.rows[0], shipment: shipmentRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectOffer(req: Request, res: Response): Promise<void> {
  const offerId = req.params.id as string;
  const offerRes = await query(
    'SELECT o.id, l.seller_organization_id FROM trade_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=$1',
    [offerId]
  );
  if (!offerRes.rows[0]) {
    res.status(404).json({ error: 'Offer not found' });
    return;
  }
  if (offerRes.rows[0].seller_organization_id !== req.user!.organizationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const { rows } = await query("UPDATE trade_offers SET status='rejected' WHERE id=$1 RETURNING *", [offerId]);
  res.json(rows[0]);
}

export async function listContracts(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name, h.quantity_kg as holding_qty
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     JOIN batch_holdings h ON h.id = c.holding_id
     WHERE c.seller_organization_id=$1 OR c.buyer_organization_id=$1
     ORDER BY c.created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(rows);
}

export async function getContract(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { rows } = await query(
    `SELECT c.*, s.name as seller_name, b.name as buyer_name,
            ship.id as shipment_id, ship.vessel_name, ship.current_milestone, ship.eta_arrival, ship.container_reference,
            ship.dispatch_exception, ship.dispatch_exception_reason,
            ship.transport_coordinator_organization_id, ship.service_provider_name, ship.booking_reference,
            ship.transport_mode, ship.transport_document_type, ship.transport_document_reference, ship.tracking_url,
            coordinator.name as transport_coordinator_name,
            pay.id as payment_request_id, pay.status as payment_status, pay.amount_total as payment_amount,
            pay.currency as payment_currency, pay.payment_reference_external, pay.dispatch_required_amount, pay.amount_confirmed,
            pay.security_status,pay.security_provider,pay.security_reference,pay.release_status,pay.documents_presented_at,
            fee.id as platform_fee_invoice_id,fee.fee_payer,fee.rate_bps as platform_fee_rate_bps,fee.amount_total as platform_fee_amount,fee.status as platform_fee_status
     FROM sales_contracts c
     JOIN organizations s ON s.id = c.seller_organization_id
     JOIN organizations b ON b.id = c.buyer_organization_id
     LEFT JOIN LATERAL (SELECT * FROM shipments WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) ship ON TRUE
     LEFT JOIN organizations coordinator ON coordinator.id=ship.transport_coordinator_organization_id
     LEFT JOIN LATERAL (SELECT * FROM payment_requests WHERE contract_id=c.id ORDER BY created_at DESC LIMIT 1) pay ON TRUE
     LEFT JOIN platform_fee_invoices fee ON fee.contract_id=c.id
     WHERE c.id=$1 AND (c.seller_organization_id=$2 OR c.buyer_organization_id=$2)`,
    [id, req.user!.organizationId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }
  const documents = await query(
    `SELECT e.id, e.type, e.file_name, e.file_size_bytes, e.mime_type, e.sha256_hash,
            e.claim_description, e.review_status, e.created_at, o.name as uploader_name
     FROM evidence_items e
     JOIN organizations o ON o.id=e.uploader_organization_id
     WHERE e.linked_entity_type='contract' AND e.linked_entity_id=$1
     ORDER BY e.created_at DESC`,
    [id]
  );
  const installments=rows[0].payment_request_id?await query('SELECT * FROM payment_installments WHERE payment_request_id=$1 ORDER BY sequence_number',[rows[0].payment_request_id]):{rows:[]};
  res.json({ ...rows[0], documents: documents.rows, installments:installments.rows });
}

export async function updatePaymentTerms(req:Request,res:Response):Promise<void>{
  const id=req.params.id as string; const {paymentPlan,depositPercentage=20,creditDays=30,note}=req.body as {paymentPlan:PaymentPlan;depositPercentage?:number;creditDays?:number;note?:string};
  const client=await getClient();
  try{await client.query('BEGIN'); const r=await client.query(`SELECT c.*,p.id payment_request_id,p.amount_total FROM sales_contracts c JOIN payment_requests p ON p.contract_id=c.id
    WHERE c.id=$1 AND c.seller_organization_id=$2 FOR UPDATE OF c,p`,[id,req.user!.organizationId]); const c=r.rows[0];
    if(!c){await client.query('ROLLBACK');res.status(404).json({error:'Contract not found or only the seller can propose payment terms'});return;}
    if(c.payment_terms_status==='agreed'){await client.query('ROLLBACK');res.status(409).json({error:'Confirmed payment terms cannot be changed'});return;}
    const activity=await client.query("SELECT 1 FROM payment_installments WHERE payment_request_id=$1 AND status IN('payment_submitted','paid') LIMIT 1",[c.payment_request_id]);
    if(activity.rows[0]){await client.query('ROLLBACK');res.status(409).json({error:'Payment activity already exists'});return;}
    const total=Number(c.amount_total),required=requiredBeforeDispatch(paymentPlan,total,depositPercentage),security=paymentPlan==='bank_secured'?'awaiting_submission':'not_required';
    await client.query(`UPDATE sales_contracts SET payment_plan=$1,deposit_percentage=$2,credit_days=$3,payment_terms_note=$4,payment_terms_status='proposed',payment_terms_confirmed_at=NULL,payment_terms_confirmed_by_user_id=NULL WHERE id=$5`,[paymentPlan,depositPercentage,creditDays,note||null,id]);
    await client.query(`UPDATE payment_requests SET status='awaiting_terms',payment_method=$1,dispatch_required_amount=$2,amount_confirmed=0,security_status=$3,security_provider=NULL,security_reference=NULL,security_submitted_at=NULL,security_verified_at=NULL,security_verified_by_user_id=NULL,release_status='locked',updated_at=NOW() WHERE id=$4`,[paymentPlan,required,security,c.payment_request_id]);
    await client.query('DELETE FROM payment_installments WHERE payment_request_id=$1',[c.payment_request_id]);
    for(const i of buildInstallments(paymentPlan,total,depositPercentage)) await client.query(`INSERT INTO payment_installments(payment_request_id,installment_type,sequence_number,amount_due,due_trigger,status) VALUES($1,$2,$3,$4,$5,'awaiting_trigger')`,[c.payment_request_id,i.installmentType,i.sequenceNumber,i.amountDue,i.dueTrigger]);
    await client.query('COMMIT'); await audit.record({actorUserId:req.user!.id,actorOrganizationId:req.user!.organizationId,action:'payment.terms.propose',entityType:'sales_contract',entityId:id}); res.json({ok:true});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

export async function confirmPaymentTerms(req:Request,res:Response):Promise<void>{
  const id=req.params.id as string,client=await getClient();
  try{await client.query('BEGIN');const r=await client.query(`SELECT c.*,p.id payment_request_id FROM sales_contracts c JOIN payment_requests p ON p.contract_id=c.id WHERE c.id=$1 AND c.buyer_organization_id=$2 FOR UPDATE OF c,p`,[id,req.user!.organizationId]);const c=r.rows[0];
    if(!c){await client.query('ROLLBACK');res.status(404).json({error:'Contract not found or only the buyer can confirm its payment terms'});return;}
    if(c.payment_terms_status==='agreed'){await client.query('COMMIT');res.json({ok:true,alreadyConfirmed:true});return;}
    if(c.payment_terms_status!=='proposed'){await client.query('ROLLBACK');res.status(409).json({error:'The supplier must propose the payment terms before the buyer can confirm them'});return;}
    await client.query("UPDATE sales_contracts SET payment_terms_status='agreed',payment_terms_confirmed_at=NOW(),payment_terms_confirmed_by_user_id=$1 WHERE id=$2",[req.user!.id,id]);
    await client.query("UPDATE payment_installments SET status='due',updated_at=NOW() WHERE payment_request_id=$1 AND due_trigger='terms_agreed'",[c.payment_request_id]);
    const status=c.payment_plan==='bank_secured'?'awaiting_security':c.payment_plan==='pay_after_delivery'?'awaiting_delivery':c.payment_plan==='documentary_collection'?'awaiting_documents':'payment_due';
    await client.query(`UPDATE payment_requests SET status=$1,release_status=CASE WHEN $2='pay_after_delivery' THEN 'authorized' ELSE release_status END,updated_at=NOW() WHERE id=$3`,[status,c.payment_plan,c.payment_request_id]);
    await client.query('COMMIT');await audit.record({actorUserId:req.user!.id,actorOrganizationId:req.user!.organizationId,action:'payment.terms.confirm',entityType:'sales_contract',entityId:id});res.json({ok:true});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

export async function updateEudrReference(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { eudrDueDiligenceReference } = req.body;
  const { rows } = await query('UPDATE sales_contracts SET eudr_due_diligence_reference=$1 WHERE id=$2 AND buyer_organization_id=$3 RETURNING *', [eudrDueDiligenceReference, id, req.user!.organizationId]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.eudr.update', entityType: 'sales_contract', entityId: id });
  res.json(rows[0]);
}

export async function updateComplianceReference(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { scheme, reference } = req.body;
  const isEudr = String(scheme).trim().toUpperCase() === 'EUDR';
  const { rows } = await query(
    `UPDATE sales_contracts
        SET compliance_scheme=$1,
            compliance_reference=$2,
            eudr_due_diligence_reference=CASE WHEN $3 THEN $2 ELSE eudr_due_diligence_reference END
      WHERE id=$4 AND buyer_organization_id=$5
      RETURNING *`,
    [scheme.trim(), reference.trim(), isEudr, id, req.user!.organizationId]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Contract not found or not your contract' });
    return;
  }
  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'contract.compliance.update', entityType: 'sales_contract', entityId: id });
  res.json(rows[0]);
}
