import { describe, expect, it } from 'vitest';
import { assessBatchTrust, assessReview, hasGeolocation, legacyOrganicStatus, ClaimReview } from './assessment';
const now = new Date('2026-10-02T10:00:00Z');
const batch = { id:'batch',plot_ids:['p'],farm_id:'farm',farmer_organization_id:'farmer',current_holder_id:'farmer',crop:'cocoa',source_mode:'farm_traceable',organic_claim_status:'attested',attestation_id:'a',attestation_batch_id:'batch',attestation_certifier_id:'certifier',attestation_user_org:'certifier',certificate_farm_id:'farm',certificate_farmer_id:'farmer',certificate_certifier_id:'certifier',certificate_crop_scope:['cocoa'],certificate_valid_from:'2026-01-01',certificate_valid_to:'2026-12-31',certificate_status:'active',certifier_type:'certifier',certifier_workspace_status:'verified',certificate_reference:'CERT123',attested_at:'2026-09-01',harvest_date:'2026-08-01' };
const review: ClaimReview = {entity_type:'farm',entity_id:'farm',claim_key:'verification',claim_source:'independent_field_review',source_reference:'REF123',review_method:'field_review',reviewed_at:'2026-09-01',expires_at:'2026-12-31',status:'reviewed',reviewer_name:'Independent Reviewer',reviewer_organization_id:'reviewer'};
describe('authoritative trust assessment', () => {
  it('requires a current valid scoped certificate linked to the attested farm and owner', () => {
    expect(assessBatchTrust(batch,[],[],now).organic.status).toBe('reviewed');
    for (const change of [{attestation_user_org:'outsider'},{certificate_crop_scope:['shea nuts']},{certificate_farm_id:'other'},{certificate_farmer_id:'other'},{attestation_batch_id:'other'},{certificate_valid_from:'2026-09-01'},{certificate_certifier_id:'farmer'},{source_mode:'direct_inventory'}]) expect(assessBatchTrust({...batch,...change},[],[],now).organic.status).not.toBe('reviewed');
  });
  it('revokes suspended/revoked claims and expires stored attestation without editing the batch', () => {
    expect(assessBatchTrust({...batch,certificate_status:'revoked'},[],[],now).organic.status).toBe('revoked');
    expect(assessBatchTrust({...batch,certificate_status:'suspended'},[],[],now).organic.status).toBe('revoked');
    const trust = assessBatchTrust({...batch,certificate_valid_to:'2026-09-30'},[],[],now);
    expect(trust.organic.status).toBe('expired'); expect(legacyOrganicStatus(trust)).toBe('self_declared');
  });
  it('does not upgrade stored verified flags, coordinate zero or empty plots to independent review', () => {
    const trust = assessBatchTrust({...batch,verification_status:'verified'},[],[],now);
    expect(trust.origin.status).toBe('self_declared'); expect(trust.eudr.status).toBe('unknown');
    expect(hasGeolocation({id:'p',gps_lat:0,gps_lng:0,eudr_cutoff_checked:true,deforestation_risk_status:'clear'})).toBe(true);
    expect(hasGeolocation({id:'p',gps_lat:null,gps_lng:0,eudr_cutoff_checked:true,deforestation_risk_status:'clear'})).toBe(false);
  });
  it('exposes documented review provenance, lets revocation win and rejects self-review', () => {
    expect(assessBatchTrust(batch,[],[review],now).origin).toMatchObject({status:'reviewed',claimSource:'independent_field_review',sourceReference:'REF123',reviewMethod:'field_review',reviewerName:'Independent Reviewer'});
    expect(assessBatchTrust(batch,[],[review,{...review,status:'revoked',reviewed_at:'2026-10-01'}],now).origin.status).toBe('revoked');
    expect(assessBatchTrust(batch,[],[{...review,reviewer_organization_id:'farmer'}],now).origin.status).toBe('self_declared');
  });
  it('never publishes a private document URL or email as review reference', () => {
    expect(assessReview({...review,source_reference:'https://storage/private.pdf'},now).sourceReference).toBeNull();
    expect(assessReview({...review,source_reference:'someone@example.com'},now).sourceReference).toBeNull();
  });
  it('keeps EUDR unknown without a whole-batch documented review and real plotted geometry', () => {
    const r = {...review,entity_type:'batch',entity_id:'batch',claim_key:'eudr'};
    expect(assessBatchTrust(batch,[],[r],now).eudr.status).toBe('unknown');
    expect(assessBatchTrust({...batch,plot_ids:[]},[{id:'p',gps_lat:0,gps_lng:0,eudr_cutoff_checked:true,deforestation_risk_status:'clear'}],[r],now).eudr.status).toBe('unknown');
    expect(assessBatchTrust(batch,[{id:'p',gps_lat:0,gps_lng:0,eudr_cutoff_checked:true,deforestation_risk_status:'clear'}],[r],now).eudr.status).toBe('reviewed');
    expect(assessBatchTrust({...batch,current_holder_id:'buyer'},[{id:'p',gps_lat:0,gps_lng:0,eudr_cutoff_checked:true,deforestation_risk_status:'clear'}],[{...r,reviewer_organization_id:'farmer'}],now).eudr.status).toBe('self_declared');
  });
});
