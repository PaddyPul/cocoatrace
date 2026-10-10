import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../errors';
import { Actor, hasBatchRelationship, hasExplicitPermission } from '../../services/resourcePolicy';
import {
  assessBatchTrust,
  hasGeolocation,
  legacyOrganicStatus,
  ClaimReview,
  TrustPlot,
} from '../trust/assessment';
import { Execute, text, withCatalogRead } from './paging';

export type ProvenanceMode = 'read' | 'export';
export const PROVENANCE_EXPORT_MAX_RECORDS = 1000;
export const PROVENANCE_EXPORT_MAX_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const evidenceProjection = `e.id,e.type,e.file_name,e.file_size_bytes,e.mime_type,e.sha256_hash,e.review_status,
  e.validation_status,e.malware_scan_status,e.linked_entity_type,e.linked_entity_id,e.claim_description,e.created_at`;
const batchFrom = `FROM harvest_batches b LEFT JOIN farms f ON f.id=b.farm_id
  LEFT JOIN batch_attestations a ON a.id=b.attestation_id LEFT JOIN users au ON au.id=a.certifier_user_id
  LEFT JOIN organic_certificates c ON c.id=a.certificate_id LEFT JOIN organizations o ON o.id=c.certifier_organization_id`;
const batchProjection = `b.*,f.name AS farm_name,f.farmer_organization_id,f.region,f.country,f.official_traceability_id,
  a.attested_at,a.provenance_hash AS att_hash,c.standard,c.valid_from,c.valid_to,o.name AS certifier_name,
  au.organization_id AS attestation_user_org,a.batch_id AS attestation_batch_id,a.certifier_organization_id AS attestation_certifier_id,
  c.status AS certificate_status,c.farm_id AS certificate_farm_id,c.farmer_organization_id AS certificate_farmer_id,
  c.certifier_organization_id AS certificate_certifier_id,c.crop_scope AS certificate_crop_scope,
  c.valid_from AS certificate_valid_from,c.valid_to AS certificate_valid_to,c.accreditation_reference AS certificate_reference,
  o.type AS certifier_type,o.verification_status AS certifier_workspace_status`;
const internalBatchFields = [
  'attestation_user_org',
  'attestation_batch_id',
  'attestation_certifier_id',
  'certificate_status',
  'certificate_farm_id',
  'certificate_farmer_id',
  'certificate_certifier_id',
  'certificate_crop_scope',
  'certificate_valid_from',
  'certificate_valid_to',
  'certificate_reference',
  'certifier_type',
  'certifier_workspace_status',
];
export function provenanceExportInput(
  batchId: string,
  parameters: Record<string, unknown>,
  mode: ProvenanceMode = 'export',
) {
  if (!UUID.test(batchId)) throw new ValidationError('Invalid batch ID');
  if (
    Object.keys(parameters).some(
      (name) => !(mode === 'export' ? ['contractId', 'format'] : ['contractId']).includes(name),
    )
  )
    throw new ValidationError('Unknown provenance export parameter');
  const format = parameters.format ?? 'json';
  if (format !== 'json') throw new ValidationError('Unsupported export format. Use ?format=json');
  const contractId = text(parameters.contractId, 'contract ID');
  if (contractId && !UUID.test(contractId)) throw new ValidationError('Invalid contract ID');
  return { contractId: contractId || null };
}
function overflow(mode: ProvenanceMode): never {
  throw new AppError(
    'Provenance export exceeds the complete report limit. No partial file was generated. Contact the platform operator.',
    422,
    mode === 'export' ? 'PROVENANCE_EXPORT_LIMIT' : 'PROVENANCE_READ_LIMIT',
  );
}
type Budget = { bytes: number; mode: ProvenanceMode };
async function rowsWithinBudget(
  execute: Execute,
  budget: Budget,
  select: string,
  from: string,
  where: string,
  args: unknown[],
  key: string,
  maximum = PROVENANCE_EXPORT_MAX_RECORDS,
  order = key,
) {
  const candidates = (
    await execute(
      `SELECT ${key} AS id ${from} WHERE ${where} ORDER BY ${key} LIMIT ${maximum + 1}`,
      args,
    )
  ).rows;
  if (candidates.length > maximum) overflow(budget.mode);
  if (!candidates.length) return [];
  const bound = `${where} AND ${key}=ANY($${args.length + 1}::uuid[])`;
  const parameters = [...args, candidates.map((row) => row.id)];
  const projected = `SELECT ${select} ${from} WHERE ${bound}`;
  const size = (
    await execute(
      `SELECT COALESCE(SUM(octet_length(row_to_json(record)::text)),0)::text AS bytes FROM (${projected}) record`,
      parameters,
    )
  ).rows[0];
  const bytes = Number(size?.bytes);
  if (!Number.isSafeInteger(bytes) || bytes < 0)
    throw new AppError(
      'Provenance export size could not be verified',
      503,
      'PROVENANCE_EXPORT_UNAVAILABLE',
    );
  budget.bytes += bytes + candidates.length + 2;
  if (budget.bytes > PROVENANCE_EXPORT_MAX_BYTES) overflow(budget.mode);
  const rows = (await execute(`${projected} ORDER BY ${order}`, parameters)).rows;
  if (rows.length !== candidates.length)
    throw new AppError(
      'Provenance export snapshot changed; retry',
      503,
      'PROVENANCE_EXPORT_UNAVAILABLE',
    );
  return rows;
}
export async function provenanceExportRead(
  execute: Execute,
  actor: Actor & { id: string; email: string },
  batchId: string,
  parameters: Record<string, unknown> = {},
  mode: ProvenanceMode = 'export',
) {
  const { contractId } = provenanceExportInput(batchId, parameters, mode);
  if (!(await execute('SELECT id FROM harvest_batches WHERE id=$1::uuid', [batchId])).rows.length)
    throw new NotFoundError('Batch');
  const network = hasExplicitPermission(actor, `provenance.${mode}.network`);
  if (!network && !(await hasBatchRelationship(actor, batchId, execute)))
    throw new ForbiddenError('Access denied');
  // Leave room for report keys, assessments and generated attribution; final UTF-8 check is also mandatory.
  const budget: Budget = { bytes: 64 * 1024, mode };
  const batch = (
    await rowsWithinBudget(
      execute,
      budget,
      batchProjection,
      batchFrom,
      'b.id=$1::uuid',
      [batchId],
      'b.id',
      1,
    )
  )[0];
  if (!batch) throw new NotFoundError('Batch');
  let contract: Record<string, unknown> | null = null,
    shipment: Record<string, unknown> | null = null;
  if (contractId) {
    contract =
      (
        await rowsWithinBudget(
          execute,
          budget,
          'c.*',
          'FROM sales_contracts c JOIN batch_holdings h ON h.id=c.holding_id',
          'c.id=$1::uuid AND h.batch_id=$2::uuid AND ($3::boolean OR c.seller_organization_id=$4::uuid OR c.buyer_organization_id=$4::uuid)',
          [contractId, batchId, network, actor.organizationId],
          'c.id',
          1,
        )
      )[0] || null;
    if (!contract)
      throw new ForbiddenError('Contract is not related to this batch or organization');
    shipment =
      (
        await rowsWithinBudget(
          execute,
          budget,
          'sh.*',
          'FROM shipments sh',
          'sh.contract_id=$1::uuid',
          [contractId],
          'sh.id',
          1,
        )
      )[0] || null;
    if (shipment) {
      const milestones = await rowsWithinBudget(
        execute,
        budget,
        'm.milestone,m.recorded_at AS "recordedAt",m.location,m.notes',
        'FROM shipment_milestones m',
        'm.shipment_id=$1::uuid',
        [shipment.id],
        'm.id',
        1000,
        'm.recorded_at,m.id',
      );
      shipment.milestones = milestones.length ? milestones : null;
    }
  }
  const plots = await rowsWithinBudget(
    execute,
    budget,
    'p.*',
    'FROM farm_plots p',
    'p.farm_id=$1::uuid AND p.id=ANY($2::uuid[])',
    [batch.farm_id, batch.plot_ids || []],
    'p.id',
  );
  const evidence = await rowsWithinBudget(
    execute,
    budget,
    evidenceProjection,
    'FROM evidence_items e',
    "e.linked_entity_type='batch' AND e.linked_entity_id=$1::uuid",
    [batchId],
    'e.id',
  );
  const reviews = await rowsWithinBudget(
    execute,
    budget,
    'r.id,r.entity_type,r.entity_id,r.claim_key,r.claim_source,r.source_reference,r.review_method,r.reviewed_at,r.expires_at,r.status,r.reviewer_organization_id,o.name AS reviewer_name',
    'FROM trust_claim_reviews r JOIN organizations o ON o.id=r.reviewer_organization_id JOIN users u ON u.id=r.reviewer_user_id AND u.organization_id=r.reviewer_organization_id',
    "((r.entity_type='batch' AND r.entity_id=$1::uuid) OR (r.entity_type='farm' AND r.entity_id=$2::uuid))",
    [batchId, batch.farm_id],
    'r.id',
  );
  const trust = assessBatchTrust(
    batch,
    plots as unknown as TrustPlot[],
    reviews as unknown as ClaimReview[],
  );
  batch.organic_claim_status = legacyOrganicStatus(trust);
  const geolocation = plots.length > 0 && (plots as unknown as TrustPlot[]).every(hasGeolocation);
  const validEvidence = evidence.filter(
    (item) => item.validation_status === 'validated' && item.malware_scan_status === 'clean',
  );
  const completenessChecks = [
    trust.organic.status === 'reviewed',
    plots.length > 0,
    geolocation,
    validEvidence.some((item) => item.type === 'certificate_pdf'),
    validEvidence.some((item) => item.type === 'weighing_ticket'),
    !!contract?.eudr_due_diligence_reference,
  ];
  const completenessPercent = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100,
  );
  for (const field of internalBatchFields) delete batch[field];
  const payload = {
    trust,
    exportType: 'TraceOrigin Provenance Pack',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    generatedBy: { userId: actor.id, organizationId: actor.organizationId, email: actor.email },
    batchId,
    contractId,
    completenessPercent,
    status: completenessPercent >= 95 ? 'complete' : 'incomplete',
    batch,
    plots,
    contract,
    shipment,
    evidenceItems: evidence,
    policyCheckResults: [
      {
        rule: 'Batch has organic attestation',
        passed: trust.organic.status === 'reviewed',
        warning: trust.organic.status !== 'reviewed',
      },
      {
        rule: 'Certificate active on harvest date',
        passed: trust.organic.status === 'reviewed',
        warning: trust.organic.status !== 'reviewed',
      },
      { rule: 'Plot geolocation present', passed: geolocation, warning: !geolocation },
      {
        rule: 'EUDR independently reviewed',
        passed: trust.eudr.status === 'reviewed',
        warning: trust.eudr.status !== 'reviewed',
      },
      { rule: 'Route permitted', passed: !shipment || !!shipment.origin_port, warning: !shipment },
      {
        rule: 'EUDR due-diligence reference',
        passed: !!contract?.eudr_due_diligence_reference,
        warning: !contract?.eudr_due_diligence_reference,
      },
    ],
    eudrReadiness: {
      plotGeolocationPresent: geolocation,
      deforestationCutoffChecked: plots.length > 0 && plots.every((p) => p.eudr_cutoff_checked),
      dueDiligenceReferenceNumber: contract?.eudr_due_diligence_reference || null,
      riskAssessmentStatus: trust.eudr.status === 'reviewed' ? 'reviewed' : 'unknown',
      ready: trust.eudr.status === 'reviewed' && !!contract?.eudr_due_diligence_reference,
    },
  };
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > PROVENANCE_EXPORT_MAX_BYTES) overflow(budget.mode);
  return { payload, serialized };
}
export function completeProvenancePack(
  actor: Actor & { id: string; email: string },
  batchId: string,
  parameters: Record<string, unknown> = {},
  mode: ProvenanceMode = 'export',
) {
  provenanceExportInput(batchId, parameters, mode);
  return withCatalogRead((execute) =>
    provenanceExportRead(execute, actor, batchId, parameters, mode),
  );
}
