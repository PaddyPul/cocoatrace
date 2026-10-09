import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import app from '../../src/app';
import {pool,query} from '../../src/db';
import {loadBatchTrust} from '../../src/modules/trust/assessment';
type Actor={org:string;user:string;token:string};
let owner:Actor,outsider:Actor,readNetwork:Actor,exportNetwork:Actor,reviewer:Actor,buyer:Actor,privateSeller:Actor;
let farm:string,plot:string,batch:string,certificate:string,attestation:string,review:string,evidence:string,contract:string,foreignContract:string,privateContract:string,otherBatch:string,shipment:string;
async function actor(permissions:string[],type='exporter'):Promise<Actor>{
  const tag=crypto.randomUUID(),email=`provenance-${tag}@integration.test`,password='ProvenanceRegression123!';
  const org=(await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",['Provenance '+tag,type])).rows[0].id;
  const user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash(password,4),'Provenance reader'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',['provenance-'+tag,permissions])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  const login=await request(app).post('/auth/login').send({email,password});expect(login.status).toBe(200);
  return{org,user,token:login.body.accessToken};
}
async function deal(seller:Actor,batchId=batch){
  const holding=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,1) RETURNING id',[batchId,seller.org])).rows[0].id;
  const listing=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,origin_location,destination_location) VALUES($1,$2,1,1,'Ghana','Ghana') RETURNING id",[seller.org,holding])).rows[0].id;
  const offer=(await query("INSERT INTO trade_offers(listing_id,buyer_organization_id,quantity_kg,offered_price_per_kg,valid_until) VALUES($1,$2,1,1,NOW()+INTERVAL '1 day') RETURNING id",[listing,buyer.org])).rows[0].id;
  const created=(await query("INSERT INTO sales_contracts(listing_id,offer_id,seller_organization_id,buyer_organization_id,holding_id,quantity_kg,price_per_kg,eudr_due_diligence_reference) VALUES($1,$2,$3,$4,$5,1,1,'PROVENANCE-REFERENCE') RETURNING id",[listing,offer,seller.org,buyer.org,holding])).rows[0].id;
  return created;
}
const get=(mode='export',who:Actor=owner,parameters:Record<string,string>={})=>request(app).get(`/provenance/batches/${batch}${mode==='export'?'/export':''}`).query(parameters).set('Authorization',`Bearer ${who.token}`);
beforeAll(async()=>{
  owner=await actor(['batch.read','provenance.export']);outsider=await actor(['batch.read','provenance.export','analytics.read.network']);
  readNetwork=await actor(['batch.read','provenance.export','provenance.read.network']);exportNetwork=await actor(['batch.read','provenance.export','provenance.export.network']);reviewer=await actor([],'certifier');buyer=await actor([]);privateSeller=await actor([]);
  farm=(await query("INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'Provenance source','Northern','Test') RETURNING id",[owner.org])).rows[0].id;
  plot=(await query("INSERT INTO farm_plots(farm_id,plot_code,area_hectares,crops,gps_lat,gps_lng,eudr_cutoff_checked) VALUES($1,'PROVENANCE',1,ARRAY['peanut'],0,0,false) RETURNING id",[farm])).rows[0].id;
  batch=(await query("INSERT INTO harvest_batches(farm_id,plot_ids,crop,harvest_date,quantity_kg,current_holder_id,organic_claim_status) VALUES($1,$2,'peanut',CURRENT_DATE,10,$3,'self_declared') RETURNING id",[farm,[plot],owner.org])).rows[0].id;
  certificate=(await query("INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$2,$3,ARRAY['peanut'],CURRENT_DATE-10,CURRENT_DATE+10,'Independent certifier','PROVENANCE-CERT') RETURNING id",[reviewer.org,owner.org,farm])).rows[0].id;
  attestation=(await query("INSERT INTO batch_attestations(batch_id,certificate_id,certifier_user_id,certifier_organization_id,provenance_hash) VALUES($1,$2,$3,$4,'sha256:provenance-fixture') RETURNING id",[batch,certificate,reviewer.user,reviewer.org])).rows[0].id;
  await query('UPDATE harvest_batches SET attestation_id=$1 WHERE id=$2',[attestation,batch]);
  review=(await query("INSERT INTO trust_claim_reviews(entity_type,entity_id,claim_key,claim_source,reviewer_user_id,reviewer_organization_id,review_method,status) VALUES('batch',$1,'eudr','Independent review',$2,$3,'Document and location review','reviewed') RETURNING id",[batch,reviewer.user,reviewer.org])).rows[0].id;
  evidence=(await query("INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,validation_status,malware_scan_status) VALUES($1,$2,'certificate_pdf','Certificate.pdf',repeat('a',64),'batch',$3,'validated','clean') RETURNING id",[owner.user,owner.org,batch])).rows[0].id;
  await query("INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,validation_status,malware_scan_status) VALUES($1,$2,'weighing_ticket','Weights.pdf',repeat('b',64),'batch',$3,'validated','clean')",[owner.user,owner.org,batch]);
  contract=await deal(owner);privateContract=await deal(privateSeller);
  otherBatch=(await query("INSERT INTO harvest_batches(crop,harvest_date,quantity_kg,current_holder_id,source_mode) VALUES('peanut',CURRENT_DATE,10,$1,'direct_inventory') RETURNING id",[privateSeller.org])).rows[0].id;
  foreignContract=await deal(privateSeller,otherBatch);
  shipment=(await query('INSERT INTO shipments(contract_id) VALUES($1) RETURNING id',[contract])).rows[0].id;
});
afterAll(async()=>{
  try{
    if(batch){
      await query("DELETE FROM audit_events WHERE entity_id=$1 OR actor_organization_id=ANY($2::uuid[])",[batch,[owner.org,outsider.org,readNetwork.org,exportNetwork.org,reviewer.org]]);
      await query('DELETE FROM shipment_milestones WHERE shipment_id=$1',[shipment]);await query('DELETE FROM shipments WHERE contract_id=ANY($1::uuid[])',[[contract,foreignContract,privateContract]]);
      await query('DELETE FROM sales_contracts WHERE id=ANY($1::uuid[])',[[contract,foreignContract,privateContract]]);
      await query('DELETE FROM trade_offers WHERE listing_id IN(SELECT id FROM listings WHERE holding_id IN(SELECT id FROM batch_holdings WHERE batch_id=ANY($1::uuid[])))',[[batch,otherBatch]]);
      await query('DELETE FROM listings WHERE holding_id IN(SELECT id FROM batch_holdings WHERE batch_id=ANY($1::uuid[]))',[[batch,otherBatch]]);await query('DELETE FROM batch_holdings WHERE batch_id=ANY($1::uuid[])',[[batch,otherBatch]]);
      await query("DELETE FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1",[batch]);await query('DELETE FROM trust_claim_reviews WHERE entity_id=$1 OR entity_id=$2',[batch,farm]);
      await query('UPDATE harvest_batches SET attestation_id=NULL WHERE id=$1',[batch]);await query('DELETE FROM batch_attestations WHERE batch_id=$1',[batch]);await query('DELETE FROM harvest_batches WHERE id=$1',[batch]);
      await query('DELETE FROM harvest_batches WHERE id=$1',[otherBatch]);
      await query('DELETE FROM organic_certificates WHERE id=$1',[certificate]);await query('DELETE FROM farm_plots WHERE farm_id=$1',[farm]);await query('DELETE FROM farms WHERE id=$1',[farm]);
    }
  }finally{await pool.end();}
});
describe('bounded complete provenance views and downloads',()=>{
  it('shares authoritative reviewed/revoked trust and preserves view shape versus export attribution',async()=>{
    const detail=await get('read',owner,{contractId:contract}),download=await get('export',owner,{contractId:contract});
    expect(detail.status,JSON.stringify(detail.body)).toBe(200);expect(download.status,JSON.stringify(download.body)).toBe(200);
    expect(detail.body.trust).toEqual((await loadBatchTrust([batch])).get(batch));expect(download.body.trust).toEqual(detail.body.trust);
    expect(download.body.trust.organic.status).toBe('reviewed');expect(download.body.trust.eudr.status).toBe('reviewed');expect(download.body.completenessPercent).toBe(100);
    expect(detail.body.generatedBy).toBeUndefined();expect(detail.body.exportType).toBeUndefined();expect(download.body.generatedBy.userId).toBe(owner.user);
    expect(download.headers['cache-control']).toBe('no-store');expect(download.headers['content-disposition']).toContain('attachment;');expect(JSON.stringify(download.body.evidenceItems)).not.toContain('storage_path');
    await query("UPDATE trust_claim_reviews SET status='revoked' WHERE id=$1",[review]);
    try{const revoked=await get('export');expect(revoked.status).toBe(200);expect(revoked.body.trust).toEqual((await loadBatchTrust([batch])).get(batch));expect(revoked.body.trust.eudr.status).toBe('revoked');}
    finally{await query("UPDATE trust_claim_reviews SET status='reviewed' WHERE id=$1",[review]);}
  });
  it('keeps read-network and export-network authorities separate and blocks contract splicing',async()=>{
    expect((await get('read',outsider)).status).toBe(403);expect((await get('export',outsider)).status).toBe(403);
    expect((await get('read',readNetwork)).status).toBe(200);expect((await get('export',readNetwork)).status).toBe(403);
    expect((await get('export',exportNetwork)).status).toBe(200);expect((await get('read',exportNetwork)).status).toBe(403);
    for(const mode of ['read','export'])for(const deniedId of [foreignContract,privateContract]){const denied=await get(mode,owner,{contractId:deniedId});expect(denied.status,JSON.stringify(denied.body)).toBe(403);expect(denied.headers['content-disposition']).toBeUndefined();}
  });
  it.each([['invalid','clean'],['validated','infected']])('does not increase completeness using %s/%s evidence metadata',async(validation,malware)=>{
    await query('UPDATE evidence_items SET validation_status=$1,malware_scan_status=$2 WHERE id=$3',[validation,malware,evidence]);
    try{for(const mode of ['read','export']){const res=await get(mode,owner,{contractId:contract});expect(res.status,JSON.stringify(res.body)).toBe(200);expect(res.body.completenessPercent).toBe(83);expect(res.body.evidenceItems.find((item:{id:string})=>item.id===evidence)).toMatchObject({validation_status:validation,malware_scan_status:malware});}}
    finally{await query("UPDATE evidence_items SET validation_status='validated',malware_scan_status='clean' WHERE id=$1",[evidence]);}
  });
  it('refuses evidence collection overflow with no partial attachment or success audit',async()=>{
    const extra=(await query("INSERT INTO evidence_items(uploader_user_id,uploader_organization_id,type,file_name,sha256_hash,linked_entity_type,linked_entity_id,validation_status,malware_scan_status) SELECT $1,$2,'other','Overflow.pdf',repeat('c',64),'batch',$3,'validated','clean' FROM generate_series(1,1001) RETURNING id",[owner.user,owner.org,batch])).rows.map(row=>row.id);
    const before=(await query("SELECT COUNT(*)::int count FROM audit_events WHERE entity_id=$1 AND action='provenance.export'",[batch])).rows[0].count;
    try{for(const mode of ['read','export']){const res=await get(mode);expect(res.status,JSON.stringify(res.body)).toBe(422);expect(res.body.code).toBe(mode==='read'?'PROVENANCE_READ_LIMIT':'PROVENANCE_EXPORT_LIMIT');expect(res.headers['content-disposition']).toBeUndefined();}expect((await query("SELECT COUNT(*)::int count FROM audit_events WHERE entity_id=$1 AND action='provenance.export'",[batch])).rows[0].count).toBe(before);}
    finally{await query('DELETE FROM evidence_items WHERE id=ANY($1::uuid[])',[extra]);}
  });
  it('refuses milestone overflow instead of exporting a truncated shipment',async()=>{
    const extra=(await query("INSERT INTO shipment_milestones(shipment_id,milestone,recorded_by_user_id) SELECT $1,'planning',$2 FROM generate_series(1,1001) RETURNING id",[shipment,owner.user])).rows.map(row=>row.id);
    try{const res=await get('export',owner,{contractId:contract});expect(res.status,JSON.stringify(res.body)).toBe(422);expect(res.body.code).toBe('PROVENANCE_EXPORT_LIMIT');expect(res.headers['content-disposition']).toBeUndefined();}
    finally{await query('DELETE FROM shipment_milestones WHERE id=ANY($1::uuid[])',[extra]);}
  });
  it('checks byte limits before returning a large linked evidence field',async()=>{
    await query('UPDATE evidence_items SET claim_description=$1 WHERE id=$2',['x'.repeat(4*1024*1024),evidence]);
    try{const res=await get();expect(res.status,JSON.stringify(res.body)).toBe(422);expect(res.body.code).toBe('PROVENANCE_EXPORT_LIMIT');expect(res.headers['content-disposition']).toBeUndefined();}
    finally{await query('UPDATE evidence_items SET claim_description=NULL WHERE id=$1',[evidence]);}
  });
  it('persists export attribution with scoped metadata before sending a successful file',async()=>{
    const res=await get('export',owner,{contractId:contract});expect(res.status,JSON.stringify(res.body)).toBe(200);
    const audit=(await query("SELECT * FROM audit_events WHERE entity_id=$1 AND actor_user_id=$2 AND action='provenance.export' ORDER BY occurred_at DESC,id DESC LIMIT 1",[batch,owner.user])).rows[0];
    expect(audit.actor_organization_id).toBe(owner.org);expect(audit.metadata.contractId).toBe(contract);expect(audit.metadata.bytes).toBeGreaterThan(0);expect(JSON.stringify(audit.metadata)).not.toContain(owner.token);
  });
});
