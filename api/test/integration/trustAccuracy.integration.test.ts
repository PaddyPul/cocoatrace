import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { pool, query } from '../../src/db';
let org: string, certifier: string, user: string, reviewer: string, token: string, certifierToken: string;
async function organization(type: string) {
  return (await query("INSERT INTO organizations(name,type,jurisdiction,verification_status) VALUES($1,$2,'GH','verified') RETURNING id",[`Trust ${crypto.randomUUID()}`,type])).rows[0].id;
}
beforeAll(async () => {
  org=await organization('exporter'); certifier=await organization('certifier');
  const email=`trust-${crypto.randomUUID()}@integration.test`;
  user=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[org,email,await bcrypt.hash('TrustTestPassword123!',4),'Trust Test'])).rows[0].id;
  reviewer=(await query('INSERT INTO users(organization_id,email,password_hash,name) VALUES($1,$2,$3,$4) RETURNING id',[certifier,`review-${crypto.randomUUID()}@integration.test`,await bcrypt.hash('TrustTestPassword123!',4),'Reviewer'])).rows[0].id;
  const role=(await query('INSERT INTO roles(name,permissions) VALUES($1,$2) RETURNING id',[`trust-${crypto.randomUUID()}`,['listing.read','batch.read','provenance.export','certificate.issue','batch.attest']])).rows[0].id;
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user,role]);
  await query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[reviewer,role]);
  const login=await request(app).post('/auth/login').send({email,password:'TrustTestPassword123!'}); expect(login.status).toBe(200);token=login.body.accessToken;
  const reviewerEmail=(await query('SELECT email FROM users WHERE id=$1',[reviewer])).rows[0].email;
  const certifierLogin=await request(app).post('/auth/login').send({email:reviewerEmail,password:'TrustTestPassword123!'});expect(certifierLogin.status).toBe(200);certifierToken=certifierLogin.body.accessToken;
});
afterAll(async()=>{await pool.end();});
async function fixture() {
  const farm=(await query("INSERT INTO farms(farmer_organization_id,name,region,district,verification_status) VALUES($1,'Trust Farm','Northern','Tamale','verified') RETURNING id",[org])).rows[0].id;
  const batch=(await query("INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id,organic_claim_status) VALUES($1,'cocoa',CURRENT_DATE,10,$2,'attested') RETURNING id",[farm,org])).rows[0].id;
  const certificate=(await query("INSERT INTO organic_certificates(certifier_organization_id,farmer_organization_id,farm_id,standard,crop_scope,valid_from,valid_to,issuing_authority,accreditation_reference) VALUES($1,$2,$3,'EU_ORGANIC',ARRAY['cocoa'],CURRENT_DATE-10,CURRENT_DATE+10,'Test authority','REF123') RETURNING id",[certifier,org,farm])).rows[0].id;
  const attestation=(await query("INSERT INTO batch_attestations(batch_id,certificate_id,certifier_user_id,certifier_organization_id,provenance_hash) VALUES($1,$2,$3,$4,'testhash') RETURNING id",[batch,certificate,reviewer,certifier])).rows[0].id;
  await query('UPDATE harvest_batches SET attestation_id=$1 WHERE id=$2',[attestation,batch]);
  const holding=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',[batch,org])).rows[0].id;
  const listing=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'USD','FOB','Tema','London') RETURNING id",[org,holding])).rows[0].id;
  const slug=`trust-${crypto.randomUUID()}`;
  await query("INSERT INTO product_profiles(batch_id,slug,display_name,lot_code,visibility) VALUES($1,$2,'Trust Cocoa',$2,'published')",[batch,slug]);
  return {farm,batch,certificate,listing,slug};
}
const getListing=(id:string)=>request(app).get(`/listings/${id}`).set('Authorization',`Bearer ${token}`);
describe('authoritative trust across marketplace, passport and provenance',()=>{
  it('derives revoked certificate state at read time across public and private surfaces',async()=>{
    const f=await fixture(); expect((await getListing(f.listing)).body.trust.organic.status).toBe('reviewed');
    await query("UPDATE organic_certificates SET status='revoked' WHERE id=$1",[f.certificate]);
    const listing=await getListing(f.listing); expect(listing.status).toBe(200); expect(listing.body.trust.organic.status).toBe('revoked');expect(listing.body.organic_claim_status).not.toBe('attested');
    const product=await request(app).get(`/public/products/${f.slug}`);expect(product.status).toBe(200);expect(product.body.trust.organic.status).toBe('revoked');expect(product.body.product.organicClaimStatus).not.toBe('attested');
    const provenance=await request(app).get(`/provenance/batches/${f.batch}`).set('Authorization',`Bearer ${token}`);expect(provenance.status).toBe(200);expect(provenance.body.trust.organic.status).toBe('revoked');expect(provenance.body.policyCheckResults[0].passed).toBe(false);
  });
  it('invalidates expired and wrong crop certificates despite stored attested flags',async()=>{
    const f=await fixture();await query('UPDATE organic_certificates SET valid_to=CURRENT_DATE-1 WHERE id=$1',[f.certificate]);expect((await getListing(f.listing)).body.trust.organic.status).toBe('expired');
    await query("UPDATE organic_certificates SET valid_to=CURRENT_DATE+10,crop_scope=ARRAY['shea nuts'] WHERE id=$1",[f.certificate]);expect((await getListing(f.listing)).body.trust.organic.status).toBe('unknown');
  });
  it('never infers origin or EUDR verification from legacy verified flags or zero coordinates',async()=>{
    const f=await fixture();const plot=await query("INSERT INTO farm_plots(farm_id,plot_code,area_hectares,gps_lat,gps_lng,verification_status,eudr_cutoff_checked,deforestation_risk_status) VALUES($1,'P',1,0,0,'verified',TRUE,'clear') RETURNING id",[f.farm]);
    await query('UPDATE harvest_batches SET plot_ids=$1::uuid[] WHERE id=$2',[[plot.rows[0].id],f.batch]);
    const p=await request(app).get(`/provenance/batches/${f.batch}/export`).set('Authorization',`Bearer ${token}`);expect(p.status).toBe(200);expect(p.body.trust.origin.status).toBe('self_declared');expect(p.body.trust.eudr.status).not.toBe('reviewed');expect(p.body.eudrReadiness.plotGeolocationPresent).toBe(true);expect(p.body.eudrReadiness.ready).toBe(false);
  });
  it('publishes attributable independent review metadata while withholding private references',async()=>{
    const f=await fixture();await query("INSERT INTO trust_claim_reviews(entity_type,entity_id,claim_key,claim_source,source_reference,reviewer_user_id,reviewer_organization_id,review_method) VALUES('farm',$1,'verification','field_visit','FIELD123',$2,$3,'independent_field_review')",[f.farm,reviewer,certifier]);
    const listing=await getListing(f.listing);expect(listing.body.trust.origin).toMatchObject({status:'reviewed',claimSource:'field_visit',sourceReference:'FIELD123',reviewMethod:'independent_field_review'});
    await query("UPDATE trust_claim_reviews SET source_reference='https://private-storage/document.pdf' WHERE entity_id=$1",[f.farm]);expect((await getListing(f.listing)).body.trust.origin.sourceReference).toBeNull();
  });
});

async function unreviewedSupply() {
  const farm=(await query("INSERT INTO farms(farmer_organization_id,name,region,district) VALUES($1,'API Trust Farm','Northern','Tamale') RETURNING id",[org])).rows[0].id;
  const batch=(await query("INSERT INTO harvest_batches(farm_id,crop,harvest_date,quantity_kg,current_holder_id) VALUES($1,'cocoa',CURRENT_DATE,10,$2) RETURNING id",[farm,org])).rows[0].id;
  return {farm,batch};
}
function certificateInput(farm:string) {
  const date=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  return {farmerOrganizationId:org,farmId:farm,standard:'EU_ORGANIC',cropScope:['cocoa'],validFrom:date(-10),validTo:date(10),issuingAuthority:'Independent authority',accreditationReference:'API123'};
}
const issue=(farm:string,auth=certifierToken)=>request(app).post('/certificates').set('Authorization',`Bearer ${auth}`).send(certificateInput(farm));
const attest=(batch:string,certificate:string,auth=certifierToken)=>request(app).post(`/batches/${batch}/attest`).set('Authorization',`Bearer ${auth}`).send({certificateId:certificate,notes:'Documented certificate review'});
describe('independent certification writes and provenance auditing',()=>{
  it('prevents suppliers from self-certifying even when their role grants certificate permissions',async()=>{
    const f=await unreviewedSupply();const result=await issue(f.farm,token);expect(result.status).toBe(403);
    const counts=await query('SELECT COUNT(*)::int AS count FROM organic_certificates WHERE farm_id=$1',[f.farm]);expect(counts.rows[0].count).toBe(0);
  });
  it('records actual independent reviewer metadata on issuance and attestation and refuses duplicate attestation',async()=>{
    const f=await unreviewedSupply();const certificate=await issue(f.farm);expect(certificate.status).toBe(201);
    const result=await attest(f.batch,certificate.body.id);expect(result.status).toBe(201);
    const duplicate=await attest(f.batch,certificate.body.id);expect(duplicate.status).toBe(409);
    const reviews=await query("SELECT entity_type,reviewer_user_id,reviewer_organization_id,review_method,source_reference,expires_at FROM trust_claim_reviews WHERE (entity_type='certificate' AND entity_id=$1) OR (entity_type='batch' AND entity_id=$2) ORDER BY entity_type",[certificate.body.id,f.batch]);
    expect(reviews.rows).toHaveLength(2);
    for(const review of reviews.rows) {expect(review.reviewer_user_id).toBe(reviewer);expect(review.reviewer_organization_id).toBe(certifier);expect(review.source_reference).toBe(certificate.body.id);expect(review.expires_at).toBeTruthy();}
    expect(reviews.rows.map(r=>r.review_method).sort()).toEqual(['certificate_attestation','certificate_issuance']);
    const provenance=await request(app).get(`/provenance/batches/${f.batch}`).set('Authorization',`Bearer ${token}`);expect(provenance.status).toBe(200);expect(provenance.body.trust.organic.status).toBe('reviewed');
    const count=await query('SELECT COUNT(*)::int AS count FROM batch_attestations WHERE batch_id=$1',[f.batch]);expect(count.rows[0].count).toBe(1);
  });
  it('blocks attestation using an expired or revoked certificate without writing review or attestation rows',async()=>{
    for(const state of ['expired','revoked']) {
      const f=await unreviewedSupply();const certificate=await issue(f.farm);expect(certificate.status).toBe(201);
      if(state==='expired') await query('UPDATE organic_certificates SET valid_to=CURRENT_DATE-1 WHERE id=$1',[certificate.body.id]);
      else {const revoke=await request(app).post(`/certificates/${certificate.body.id}/revoke`).set('Authorization',`Bearer ${certifierToken}`).send({reason:'Withdrawn by issuer'});expect(revoke.status).toBe(200);}
      const result=await attest(f.batch,certificate.body.id);expect(result.status).toBe(400);
      const counts=await query('SELECT COUNT(*)::int AS count FROM batch_attestations WHERE batch_id=$1',[f.batch]);expect(counts.rows[0].count).toBe(0);
      const reviews=await query("SELECT COUNT(*)::int AS count FROM trust_claim_reviews WHERE entity_type='batch' AND entity_id=$1",[f.batch]);expect(reviews.rows[0].count).toBe(0);
    }
  });
});

describe('certificate suspension and permanent revocation',()=>{
  it('refreshes trust on suspension and reviewed reinstatement but cannot revive a revoked certificate',async()=>{
    const f=await unreviewedSupply();const certificate=await issue(f.farm);expect(certificate.status).toBe(201);
    expect((await attest(f.batch,certificate.body.id)).status).toBe(201);
    const holding=(await query('INSERT INTO batch_holdings(batch_id,holder_organization_id,quantity_kg) VALUES($1,$2,10) RETURNING id',[f.batch,org])).rows[0].id;
    const listing=(await query("INSERT INTO listings(seller_organization_id,holding_id,available_quantity_kg,price_per_kg,currency,incoterm,origin_location,destination_location) VALUES($1,$2,10,5,'USD','FOB','Tema','London') RETURNING id",[org,holding])).rows[0].id;
    const action=(name:string)=>request(app).post(`/certificates/${certificate.body.id}/${name}`).set('Authorization',`Bearer ${certifierToken}`).send({reason:'Regression reviewed decision'});
    expect((await action('suspend')).status).toBe(200);
    expect((await getListing(listing)).body.trust.organic.status).toBe('revoked');
    expect((await action('reinstate')).status).toBe(200);
    expect((await getListing(listing)).body.trust.organic.status).toBe('reviewed');
    const reviews=await query("SELECT review_method,status,reviewer_user_id FROM trust_claim_reviews WHERE entity_type='certificate' AND entity_id=$1 ORDER BY reviewed_at,id",[certificate.body.id]);
    expect(reviews.rows).toHaveLength(2);
    expect(reviews.rows.find(row=>row.review_method==='certificate_issuance').status).toBe('revoked');
    expect(reviews.rows.find(row=>row.review_method==='certificate_reinstatement')).toMatchObject({status:'reviewed',reviewer_user_id:reviewer});
    const audit=await query("SELECT COUNT(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='certificate.reinstate'",[certificate.body.id]);expect(audit.rows[0].count).toBe(1);
    expect((await action('revoke')).status).toBe(200);
    expect((await action('suspend')).status).toBe(409);
    expect((await action('reinstate')).status).toBe(409);
    expect((await getListing(listing)).body.trust.organic.status).toBe('revoked');
  });
});
