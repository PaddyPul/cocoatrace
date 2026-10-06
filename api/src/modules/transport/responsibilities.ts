/** Product recording authority; does not redefine contractual risk transfer. */
export const incoterms = [
  'EXW',
  'FCA',
  'FAS',
  'FOB',
  'CFR',
  'CIF',
  'CPT',
  'CIP',
  'DAP',
  'DPU',
  'DDP',
] as const;
export type Party = 'buyer' | 'seller';
export const milestoneOrder = [
  'planning',
  'booked',
  'requested',
  'accepted',
  'cargo_ready',
  'export_cleared',
  'picked_up',
  'warehouse_received',
  'handed_over',
  'port_received',
  'loaded',
  'departed',
  'arrived',
  'customs_cleared',
  'unloaded',
  'delivered',
] as const;
export type TransportFacts = {
  incoterm?: string;
  seller_organization_id: string;
  buyer_organization_id: string;
  transport_coordinator_organization_id?: string;
  current_milestone?: string;
  origin_confirmed?: boolean;
  unloading_confirmed?: boolean;
  import_confirmed?: boolean;
};
export function coordinatorParty(term: string | undefined): Party | null {
  if (!incoterms.includes(term as (typeof incoterms)[number])) return null;
  return ['EXW', 'FCA', 'FAS', 'FOB'].includes(term!) ? 'buyer' : 'seller';
}
export function milestoneParty(term: string | undefined, milestone: string): Party | null {
  const coordinator = coordinatorParty(term);
  if (!coordinator) return null;
  switch (milestone) {
    case 'planning':
    case 'booked':
    case 'requested':
    case 'accepted':
    case 'departed':
    case 'arrived':
      return coordinator;
    case 'cargo_ready':
      return 'seller';
    case 'export_cleared':
      return term === 'EXW' ? 'buyer' : 'seller';
    case 'picked_up':
    case 'warehouse_received':
    case 'handed_over':
    case 'port_received':
      return term === 'EXW' ? 'buyer' : 'seller';
    case 'loaded':
      return ['EXW', 'FAS'].includes(term!) ? 'buyer' : 'seller';
    case 'customs_cleared':
      return term === 'DDP' ? 'seller' : 'buyer';
    case 'unloaded':
      return term === 'DPU' ? 'seller' : 'buyer';
    case 'delivered':
      return 'buyer'; // Destination receipt report, not Incoterm legal delivery.
    default:
      return null;
  }
}
export function partyOf(facts: TransportFacts, organizationId: string): Party | null {
  if (facts.seller_organization_id === facts.buyer_organization_id) return null;
  return organizationId === facts.seller_organization_id
    ? 'seller'
    : organizationId === facts.buyer_organization_id
      ? 'buyer'
      : null;
}
export function canArrange(facts: TransportFacts, organizationId: string): boolean {
  const party = partyOf(facts, organizationId);
  return (
    !!party &&
    coordinatorParty(facts.incoterm) === party &&
    facts.transport_coordinator_organization_id === organizationId
  );
}
export function canRecord(
  facts: TransportFacts,
  organizationId: string,
  milestone: string,
): boolean {
  const party = partyOf(facts, organizationId);
  return !!party && milestoneParty(facts.incoterm, milestone) === party;
}
export function progressPrerequisite(facts: TransportFacts, milestone: string): string | null {
  const current = milestoneOrder.indexOf(
    facts.current_milestone as (typeof milestoneOrder)[number],
  );
  if (
    facts.incoterm === 'EXW' &&
    [
      'export_cleared',
      'picked_up',
      'warehouse_received',
      'handed_over',
      'port_received',
      'loaded',
      'departed',
      'arrived',
      'customs_cleared',
      'unloaded',
      'delivered',
    ].includes(milestone) &&
    !(facts.origin_confirmed ?? current >= milestoneOrder.indexOf('cargo_ready'))
  )
    return 'The seller must first confirm cargo ready for collection.';
  if (facts.incoterm === 'FAS' && milestone === 'loaded' && !facts.origin_confirmed)
    return 'The seller must confirm alongside handover before the buyer records vessel loading.';
  if (
    ['departed', 'arrived', 'customs_cleared', 'unloaded', 'delivered'].includes(milestone) &&
    !(facts.origin_confirmed ?? current >= milestoneOrder.indexOf('handed_over'))
  )
    return 'Record the authorized origin handover or loading before reporting onward transport or receipt.';
  if (
    facts.incoterm === 'DDP' &&
    ['unloaded', 'delivered'].includes(milestone) &&
    !(facts.import_confirmed ?? current >= milestoneOrder.indexOf('customs_cleared'))
  )
    return 'The seller must confirm import clearance (or explain why it is not applicable) before destination receipt.';
  if (
    facts.incoterm === 'DPU' &&
    milestone === 'delivered' &&
    !(facts.unloading_confirmed ?? current >= milestoneOrder.indexOf('unloaded'))
  )
    return 'The seller must confirm destination unloading before the buyer reports receipt.';
  return null;
}
export function transportPermissions(facts: TransportFacts, organizationId: string) {
  const current = milestoneOrder.indexOf(
    facts.current_milestone as (typeof milestoneOrder)[number],
  );
  return {
    canArrange: canArrange(facts, organizationId),
    party: partyOf(facts, organizationId),
    supported: coordinatorParty(facts.incoterm) !== null,
    milestones: milestoneOrder.filter(
      (milestone, index) => index > current && canRecord(facts, organizationId, milestone),
    ),
    responsibilities: Object.fromEntries(
      milestoneOrder.map((milestone) => [milestone, milestoneParty(facts.incoterm, milestone)]),
    ),
  };
}
