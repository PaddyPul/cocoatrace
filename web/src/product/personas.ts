import { BadgeCheck, Building2, Eye, Leaf, PackageCheck, ShieldCheck, Ship, Store } from 'lucide-react';

export type Persona = {
  key: string;
  name: string;
  promise: string;
  firstMission: string;
  missionDetail: string;
  missionPath: string;
  goals: Array<{ key: string; label: string; detail: string }>;
  icon: typeof Leaf;
};

const personas: Record<string, Persona> = {
  exporter: {
    key: 'exporter', name: 'Exporter compliance team', icon: Store,
    promise: 'Turn a physical lot into a buyer-accepted assurance file.',
    firstMission: 'Prepare one export lot', missionDetail: 'Resolve origin, verification, evidence and product-passport gaps for a real buyer review.', missionPath: '/batches',
    goals: [
      { key: 'prepare_export', label: 'Prepare an export lot', detail: 'Make one lot complete and buyer-ready.' },
      { key: 'prove_origin', label: 'Prove origin and claims', detail: 'Connect farm, certificate and evidence.' },
      { key: 'recall_ready', label: 'Become recall-ready', detail: 'Verify genealogy and recipient visibility.' },
    ],
  },
  cooperative: {
    key: 'cooperative', name: 'Cooperative operations', icon: Building2,
    promise: 'Capture trustworthy origin and harvest records once, then reuse them with buyers.',
    firstMission: 'Complete one farm record', missionDetail: 'Confirm farm identity, plot geolocation and the first traceable batch.', missionPath: '/farms',
    goals: [
      { key: 'onboard_farms', label: 'Onboard member farms', detail: 'Create reusable origin records.' },
      { key: 'capture_harvest', label: 'Capture harvest batches', detail: 'Give each physical lot a traceable identity.' },
      { key: 'buyer_proof', label: 'Share buyer proof', detail: 'Reduce repeated paperwork.' },
    ],
  },
  farmer: {
    key: 'farmer', name: 'Farm or field operator', icon: Leaf,
    promise: 'Record only the origin facts needed to keep products eligible for trusted trade.',
    firstMission: 'Verify your farm', missionDetail: 'Review farm identity, plots and missing geolocation before recording a harvest.', missionPath: '/farms',
    goals: [
      { key: 'verify_farm', label: 'Verify my farm', detail: 'Complete identity and plot information.' },
      { key: 'record_harvest', label: 'Record a harvest', detail: 'Create the next traceable batch.' },
      { key: 'track_product', label: 'See where product went', detail: 'Follow the recorded chain of custody.' },
    ],
  },
  importer: {
    key: 'importer', name: 'Buyer or importer', icon: PackageCheck,
    promise: 'Review product assurance quickly and accept only evidence-backed lots.',
    firstMission: 'Review a product passport', missionDetail: 'Check origin, certification, evidence and live safety state before accepting a lot.', missionPath: '/products',
    goals: [
      { key: 'review_supplier', label: 'Review supplier evidence', detail: 'See what is proven and what is missing.' },
      { key: 'accept_lot', label: 'Approve a trade lot', detail: 'Complete due diligence before purchase.' },
      { key: 'monitor_risk', label: 'Monitor product risk', detail: 'Receive current safety and recall context.' },
    ],
  },
  certifier: {
    key: 'certifier', name: 'Certifier or auditor', icon: BadgeCheck,
    promise: 'Review claims in context and issue attestations that buyers can verify.',
    firstMission: 'Review a pending batch', missionDetail: 'Check certificate scope and attest the next eligible batch.', missionPath: '/batches',
    goals: [
      { key: 'review_claims', label: 'Review product claims', detail: 'See the farm and batch behind each claim.' },
      { key: 'issue_certificate', label: 'Manage certificates', detail: 'Maintain valid, reusable certification.' },
      { key: 'audit_evidence', label: 'Audit evidence', detail: 'Inspect source documents and hashes.' },
    ],
  },
  logistics: {
    key: 'logistics', name: 'Logistics partner', icon: Ship,
    promise: 'Add verified custody and movement events without seeing irrelevant commercial work.',
    firstMission: 'Update a shipment', missionDetail: 'Record the next physical milestone for an assigned shipment.', missionPath: '/shipments',
    goals: [
      { key: 'accept_shipment', label: 'Accept an assignment', detail: 'Confirm custody responsibility.' },
      { key: 'record_milestone', label: 'Record a milestone', detail: 'Keep the product journey current.' },
      { key: 'attach_document', label: 'Attach logistics proof', detail: 'Link bills of lading and delivery evidence.' },
    ],
  },
  regulator: {
    key: 'regulator', name: 'Regulator or oversight team', icon: Eye,
    promise: 'Investigate provenance and safety without operating private trade workflows.',
    firstMission: 'Run a trace investigation', missionDetail: 'Trace a lot backward to origin and forward to affected products.', missionPath: '/recalls',
    goals: [
      { key: 'investigate', label: 'Investigate a lot', detail: 'Trace source and downstream exposure.' },
      { key: 'review_audit', label: 'Review the audit trail', detail: 'See who changed sensitive records.' },
      { key: 'manage_incident', label: 'Coordinate an incident', detail: 'Confirm scope before public action.' },
    ],
  },
  admin: {
    key: 'admin', name: 'Network administrator', icon: ShieldCheck,
    promise: 'Operate a trusted multi-organization network with clear permissions and accountability.',
    firstMission: 'Review network readiness', missionDetail: 'Inspect exceptions, organizations and incomplete product identities.', missionPath: '/dashboard',
    goals: [
      { key: 'network_health', label: 'Monitor network health', detail: 'Resolve readiness and safety exceptions.' },
      { key: 'manage_access', label: 'Manage organizations', detail: 'Keep participant access accountable.' },
      { key: 'support_pilot', label: 'Run a pilot', detail: 'Review user feedback and task completion.' },
    ],
  },
};

export function personaFor(orgType?: string): Persona {
  return personas[orgType || ''] || personas.admin;
}
