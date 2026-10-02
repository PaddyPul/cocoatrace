import { loadBatchTrust, legacyOrganicStatus, hasGeolocation } from '../modules/trust/assessment';
import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';
import { hasBatchRelationship, hasExplicitPermission } from '../services/resourcePolicy';

const evidenceProjection = `id,type,file_name,file_size_bytes,mime_type,
  sha256_hash,review_status,linked_entity_type,linked_entity_id,claim_description,created_at`;

type ContractContext = Record<string, unknown> & { eudr_due_diligence_reference?: string | null };
type ShipmentContext = Record<string, unknown> & { origin_port?: string | null };

async function loadContractContext(
  batchId: string,
  contractId: string | undefined,
  organizationId: string,
  networkAccess: boolean,
): Promise<{ allowed: boolean; contract: ContractContext | null; shipment: ShipmentContext | null }> {
  if (!contractId) return { allowed: true, contract: null, shipment: null };
  const contractResult = await query(
    `SELECT c.* FROM sales_contracts c
      JOIN batch_holdings h ON h.id=c.holding_id
      WHERE c.id=$1 AND h.batch_id=$2
        AND ($3::boolean OR c.seller_organization_id=$4 OR c.buyer_organization_id=$4)`,
    [contractId, batchId, networkAccess, organizationId],
  );
  const contract = contractResult.rows[0];
  if (!contract) return { allowed: false, contract: null, shipment: null };
  const shipmentResult = await query(
    `SELECT sh.*, array_agg(json_build_object(
       'milestone',m.milestone,'recordedAt',m.recorded_at,'location',m.location,'notes',m.notes
     )) FILTER (WHERE m.id IS NOT NULL) AS milestones
     FROM shipments sh LEFT JOIN shipment_milestones m ON m.shipment_id=sh.id
     WHERE sh.contract_id=$1 GROUP BY sh.id`,
    [contractId],
  );
  return { allowed: true, contract, shipment: shipmentResult.rows[0] || null };
}

export async function getProvenancePack(req: Request, res: Response): Promise<void> {
  const batchId = req.params.batchId as string;
  const contractId = typeof req.query.contractId === 'string' ? req.query.contractId : undefined;

  const batchRes = await query(`SELECT b.*, f.name as farm_name, f.farmer_organization_id, f.region, f.country, f.official_traceability_id,
                  a.attested_at, a.provenance_hash as att_hash,
                  c.standard, c.valid_from, c.valid_to, cert_org.name as certifier_name
           FROM harvest_batches b
           LEFT JOIN farms f ON f.id = b.farm_id
           LEFT JOIN batch_attestations a ON a.id = b.attestation_id
           LEFT JOIN organic_certificates c ON c.id = a.certificate_id
           LEFT JOIN organizations cert_org ON cert_org.id = c.certifier_organization_id
           WHERE b.id=$1`, [batchId]);

  const batch = batchRes.rows[0];
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  const networkAccess = hasExplicitPermission(req.user!, 'provenance.read.network');
  if (!networkAccess && !await hasBatchRelationship(req.user!, batchId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const contractContext = await loadContractContext(batchId, contractId, req.user!.organizationId, networkAccess);
  if (!contractContext.allowed) {
    res.status(403).json({ error: 'Contract is not related to this batch or organization' });
    return;
  }
  const { contract, shipment } = contractContext;
  const [farmRes, evidenceRes] = await Promise.all([
    query('SELECT p.* FROM farm_plots p JOIN harvest_batches b ON b.farm_id=p.farm_id WHERE b.id=$1 AND p.id=ANY(b.plot_ids)', [batchId]),
    query(`SELECT ${evidenceProjection} FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1`, [batchId]),
  ]);
  const plots = farmRes.rows;
  const trust = (await loadBatchTrust([batchId])).get(batchId)!;
  batch.organic_claim_status = legacyOrganicStatus(trust);

  const policyChecks = [
    { rule: 'Batch has organic attestation', passed: trust.organic.status === 'reviewed', warning: trust.organic.status !== 'reviewed' },
    { rule: 'Certificate active on harvest date', passed: trust.organic.status === 'reviewed', warning: trust.organic.status !== 'reviewed' },
    { rule: 'Plot geolocation present', passed: plots.length > 0 && plots.every(hasGeolocation), warning: !(plots.length > 0 && plots.every(hasGeolocation)) },
    { rule: 'EUDR independently reviewed', passed: trust.eudr.status === 'reviewed', warning: trust.eudr.status !== 'reviewed' },
    { rule: 'Route permitted', passed: !shipment || !!shipment.origin_port, warning: !shipment },
    { rule: 'EUDR due-diligence reference', passed: !!(contract?.eudr_due_diligence_reference), warning: !(contract?.eudr_due_diligence_reference) },
  ];

  const completenessChecks = [trust.organic.status === 'reviewed', plots.length > 0, plots.length > 0 && plots.every(hasGeolocation), evidenceRes.rows.some((e: any) => e.type === 'certificate_pdf'), evidenceRes.rows.some((e: any) => e.type === 'weighing_ticket'), !!(contract?.eudr_due_diligence_reference)];
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  res.json({
    trust,
    batchId,
    contractId: contractId || null,
    generatedAt: new Date().toISOString(),
    completenessPercent: completeness,
    status: completeness >= 95 ? 'complete' : 'incomplete',
    batch,
    plots,
    contract,
    shipment,
    evidenceItems: evidenceRes.rows,
    policyCheckResults: policyChecks,
    eudrReadiness: {
      plotGeolocationPresent: plots.length > 0 && plots.every(hasGeolocation),
      deforestationCutoffChecked: (plots.length > 0 && plots.every((p: any) => p.eudr_cutoff_checked)),
      dueDiligenceReferenceNumber: contract?.eudr_due_diligence_reference || null,
      riskAssessmentStatus: trust.eudr.status === 'reviewed' ? 'reviewed' : 'unknown',
      ready: trust.eudr.status === 'reviewed' && !!contract?.eudr_due_diligence_reference,
    },
  });
}

export async function exportProvenancePack(req: Request, res: Response): Promise<void> {
  const batchId = req.params.batchId as string;
  const contractId = typeof req.query.contractId === 'string' ? req.query.contractId : undefined;
  const format = typeof req.query.format === 'string' ? req.query.format : 'json';

  const batchRes = await query(`SELECT b.*, f.name as farm_name, f.farmer_organization_id, f.region, f.country, f.official_traceability_id,
                  a.attested_at, a.provenance_hash as att_hash,
                  c.standard, c.valid_from, c.valid_to, cert_org.name as certifier_name
           FROM harvest_batches b
           LEFT JOIN farms f ON f.id = b.farm_id
           LEFT JOIN batch_attestations a ON a.id = b.attestation_id
           LEFT JOIN organic_certificates c ON c.id = a.certificate_id
           LEFT JOIN organizations cert_org ON cert_org.id = c.certifier_organization_id
           WHERE b.id=$1`, [batchId]);

  const batch = batchRes.rows[0];
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  const networkAccess = hasExplicitPermission(req.user!, 'provenance.export.network');
  if (!networkAccess && !await hasBatchRelationship(req.user!, batchId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const contractContext = await loadContractContext(batchId, contractId, req.user!.organizationId, networkAccess);
  if (!contractContext.allowed) {
    res.status(403).json({ error: 'Contract is not related to this batch or organization' });
    return;
  }
  const { contract, shipment } = contractContext;
  const [farmRes, evidenceRes] = await Promise.all([
    query('SELECT p.* FROM farm_plots p JOIN harvest_batches b ON b.farm_id=p.farm_id WHERE b.id=$1 AND p.id=ANY(b.plot_ids)', [batchId]),
    query(`SELECT ${evidenceProjection} FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1`, [batchId]),
  ]);
  const plots = farmRes.rows;
  const trust = (await loadBatchTrust([batchId])).get(batchId)!;
  batch.organic_claim_status = legacyOrganicStatus(trust);

  const policyChecks = [
    { rule: 'Batch has organic attestation', passed: trust.organic.status === 'reviewed', warning: trust.organic.status !== 'reviewed' },
    { rule: 'Certificate active on harvest date', passed: trust.organic.status === 'reviewed', warning: trust.organic.status !== 'reviewed' },
    { rule: 'Plot geolocation present', passed: plots.length > 0 && plots.every(hasGeolocation), warning: !(plots.length > 0 && plots.every(hasGeolocation)) },
    { rule: 'EUDR independently reviewed', passed: trust.eudr.status === 'reviewed', warning: trust.eudr.status !== 'reviewed' },
    { rule: 'Route permitted', passed: !shipment || !!shipment.origin_port, warning: !shipment },
    { rule: 'EUDR due-diligence reference', passed: !!contract?.eudr_due_diligence_reference, warning: !contract?.eudr_due_diligence_reference },
  ];

  const completenessChecks = [
    trust.organic.status === 'reviewed', plots.length > 0, plots.length > 0 && plots.every(hasGeolocation),
    evidenceRes.rows.some((e: any) => e.type === 'certificate_pdf'),
    evidenceRes.rows.some((e: any) => e.type === 'weighing_ticket'),
    !!contract?.eudr_due_diligence_reference,
  ];

  const completenessPercent = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  const exportPayload: Record<string, any> = {
    trust,
    exportType: 'TraceOrigin Provenance Pack',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    generatedBy: { userId: req.user!.id, organizationId: req.user!.organizationId, email: req.user!.email },
    batchId, contractId: contractId || null, completenessPercent,
    status: completenessPercent >= 95 ? 'complete' : 'incomplete',
    batch, plots, contract, shipment, evidenceItems: evidenceRes.rows,
    policyCheckResults: policyChecks,
    eudrReadiness: {
      plotGeolocationPresent: plots.length > 0 && plots.every(hasGeolocation),
      deforestationCutoffChecked: (plots.length > 0 && plots.every((p: any) => p.eudr_cutoff_checked)),
      dueDiligenceReferenceNumber: contract?.eudr_due_diligence_reference || null,
      riskAssessmentStatus: trust.eudr.status === 'reviewed' ? 'reviewed' : 'unknown',
      ready: trust.eudr.status === 'reviewed' && !!contract?.eudr_due_diligence_reference,
    },
  };

  await audit.record({ actorUserId: req.user!.id, actorOrganizationId: req.user!.organizationId, action: 'provenance.export', entityType: 'harvest_batch', entityId: batchId, reason: `Exported provenance pack as ${format}` });

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="provenance-pack-${batchId}.json"`);
    res.json(exportPayload);
    return;
  }

  res.status(400).json({ error: 'Unsupported export format. Use ?format=json' });
}
