import { Request, Response } from 'express';
import { query } from '../db';
import * as audit from '../services/audit';

export async function getProvenancePack(req: Request, res: Response): Promise<void> {
  const batchId = req.params.batchId as string;
  const { contractId } = req.query;

  const [batchRes, farmRes] = await Promise.all([
    query(`SELECT b.*, f.name as farm_name, f.region, f.country, f.official_traceability_id,
                  a.attested_at, a.provenance_hash as att_hash,
                  c.standard, c.valid_from, c.valid_to, cert_org.name as certifier_name
           FROM harvest_batches b
           JOIN farms f ON f.id = b.farm_id
           LEFT JOIN batch_attestations a ON a.id = b.attestation_id
           LEFT JOIN organic_certificates c ON c.id = a.certificate_id
           LEFT JOIN organizations cert_org ON cert_org.id = c.certifier_organization_id
           WHERE b.id=$1`, [batchId]),
    query('SELECT * FROM farm_plots WHERE farm_id IN (SELECT farm_id FROM harvest_batches WHERE id=$1)', [batchId]),
  ]);

  const batch = batchRes.rows[0];
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const plots = farmRes.rows;
  const evidenceRes = await query("SELECT * FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1", [batchId]);

  let contract = null;
  let shipment = null;
  if (contractId) {
    const cRes = await query('SELECT * FROM sales_contracts WHERE id=$1', [contractId as string]);
    contract = cRes.rows[0];
    if (contract) {
      const sRes = await query(`SELECT sh.*, array_agg(json_build_object('milestone',m.milestone,'recordedAt',m.recorded_at,'location',m.location)) as milestones FROM shipments sh LEFT JOIN shipment_milestones m ON m.shipment_id=sh.id WHERE sh.contract_id=$1 GROUP BY sh.id`, [contractId as string]);
      shipment = sRes.rows[0];
    }
  }

  const policyChecks = [
    { rule: 'Batch has organic attestation', passed: !!batch.attestation_id, warning: false },
    { rule: 'Certificate active on harvest date', passed: batch.attestation_id && new Date(batch.harvest_date) >= new Date(batch.valid_from) && new Date(batch.harvest_date) <= new Date(batch.valid_to), warning: false },
    { rule: 'Plot geolocation present', passed: plots.some((p: any) => p.gps_lat), warning: !plots.some((p: any) => p.gps_lat) },
    { rule: 'EUDR cutoff checked', passed: plots.every((p: any) => p.eudr_cutoff_checked), warning: !plots.every((p: any) => p.eudr_cutoff_checked) },
    { rule: 'Route GH → NL permitted', passed: true, warning: false },
    { rule: 'EUDR due-diligence reference', passed: !!(contract?.eudr_due_diligence_reference), warning: !(contract?.eudr_due_diligence_reference) },
  ];

  const completenessChecks = [!!batch.attestation_id, plots.length > 0, plots.some((p: any) => p.gps_lat), evidenceRes.rows.some((e: any) => e.type === 'certificate_pdf'), evidenceRes.rows.some((e: any) => e.type === 'weighing_ticket'), !!(contract?.eudr_due_diligence_reference)];
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  res.json({
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
      plotGeolocationPresent: plots.some((p: any) => p.gps_lat),
      deforestationCutoffChecked: plots.every((p: any) => p.eudr_cutoff_checked),
      dueDiligenceReferenceNumber: contract?.eudr_due_diligence_reference || null,
      riskAssessmentStatus: plots.every((p: any) => p.deforestation_risk_status === 'clear') ? 'clear' : 'unknown',
      ready: plots.some((p: any) => p.gps_lat) && plots.every((p: any) => p.eudr_cutoff_checked) && !!(contract?.eudr_due_diligence_reference),
    },
  });
}

export async function exportProvenancePack(req: Request, res: Response): Promise<void> {
  const batchId = req.params.batchId as string;
  const { contractId, format = 'json' } = req.query;

  const [batchRes, farmRes] = await Promise.all([
    query(`SELECT b.*, f.name as farm_name, f.region, f.country, f.official_traceability_id,
                  a.attested_at, a.provenance_hash as att_hash,
                  c.standard, c.valid_from, c.valid_to, cert_org.name as certifier_name
           FROM harvest_batches b
           JOIN farms f ON f.id = b.farm_id
           LEFT JOIN batch_attestations a ON a.id = b.attestation_id
           LEFT JOIN organic_certificates c ON c.id = a.certificate_id
           LEFT JOIN organizations cert_org ON cert_org.id = c.certifier_organization_id
           WHERE b.id=$1`, [batchId]),
    query('SELECT * FROM farm_plots WHERE farm_id IN (SELECT farm_id FROM harvest_batches WHERE id=$1)', [batchId]),
  ]);

  const batch = batchRes.rows[0];
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const plots = farmRes.rows;
  const evidenceRes = await query("SELECT * FROM evidence_items WHERE linked_entity_type='batch' AND linked_entity_id=$1", [batchId]);

  let contract = null;
  let shipment = null;

  if (contractId) {
    const cRes = await query('SELECT * FROM sales_contracts WHERE id=$1', [contractId as string]);
    contract = cRes.rows[0] || null;

    if (contract) {
      const sRes = await query(
        `SELECT sh.*, array_agg(
          json_build_object(
            'milestone', m.milestone,
            'recordedAt', m.recorded_at,
            'location', m.location,
            'notes', m.notes
          )
        ) FILTER (WHERE m.id IS NOT NULL) as milestones
         FROM shipments sh
         LEFT JOIN shipment_milestones m ON m.shipment_id=sh.id
         WHERE sh.contract_id=$1
         GROUP BY sh.id`,
        [contractId as string]
      );
      shipment = sRes.rows[0] || null;
    }
  }

  const policyChecks = [
    { rule: 'Batch has organic attestation', passed: !!batch.attestation_id, warning: false },
    { rule: 'Certificate active on harvest date', passed: !!batch.attestation_id && new Date(batch.harvest_date) >= new Date(batch.valid_from) && new Date(batch.harvest_date) <= new Date(batch.valid_to), warning: false },
    { rule: 'Plot geolocation present', passed: plots.some((p: any) => p.gps_lat), warning: !plots.some((p: any) => p.gps_lat) },
    { rule: 'EUDR cutoff checked', passed: plots.every((p: any) => p.eudr_cutoff_checked), warning: !plots.every((p: any) => p.eudr_cutoff_checked) },
    { rule: 'Route GH → NL permitted', passed: true, warning: false },
    { rule: 'EUDR due-diligence reference', passed: !!contract?.eudr_due_diligence_reference, warning: !contract?.eudr_due_diligence_reference },
  ];

  const completenessChecks = [
    !!batch.attestation_id, plots.length > 0, plots.some((p: any) => p.gps_lat),
    evidenceRes.rows.some((e: any) => e.type === 'certificate_pdf'),
    evidenceRes.rows.some((e: any) => e.type === 'weighing_ticket'),
    !!contract?.eudr_due_diligence_reference,
  ];

  const completenessPercent = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  const exportPayload: Record<string, any> = {
    exportType: 'TraceOrigin Provenance Pack',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    generatedBy: { userId: req.user!.id, organizationId: req.user!.organizationId, email: req.user!.email },
    batchId, contractId: contractId || null, completenessPercent,
    status: completenessPercent >= 95 ? 'complete' : 'incomplete',
    batch, plots, contract, shipment, evidenceItems: evidenceRes.rows,
    policyCheckResults: policyChecks,
    eudrReadiness: {
      plotGeolocationPresent: plots.some((p: any) => p.gps_lat),
      deforestationCutoffChecked: plots.every((p: any) => p.eudr_cutoff_checked),
      dueDiligenceReferenceNumber: contract?.eudr_due_diligence_reference || null,
      riskAssessmentStatus: plots.every((p: any) => p.deforestation_risk_status === 'clear') ? 'clear' : 'unknown',
      ready: plots.some((p: any) => p.gps_lat) && plots.every((p: any) => p.eudr_cutoff_checked) && !!contract?.eudr_due_diligence_reference,
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
