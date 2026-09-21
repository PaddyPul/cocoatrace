export interface ReadinessFacts {
  batchesTotal: number;
  batchesAttested: number;
  productsTotal: number;
  productsPublished: number;
  productsWithEvidence: number;
  activeRecalls: number;
  shipmentsInProgress: number;
}

export interface ReadinessRecommendation {
  priority: 'urgent' | 'high' | 'medium' | 'complete';
  title: string;
  detail: string;
  action: string;
  path: string;
  basedOn: string[];
}

export function adviseReadiness(facts: ReadinessFacts) {
  const verification = facts.batchesTotal ? facts.batchesAttested / facts.batchesTotal : 0;
  const publishing = facts.productsTotal ? facts.productsPublished / facts.productsTotal : 0;
  const evidence = facts.productsTotal ? facts.productsWithEvidence / facts.productsTotal : 0;
  const available: number[] = [];
  if (facts.batchesTotal > 0) available.push(verification);
  if (facts.productsTotal > 0) available.push(publishing, evidence);
  const score = available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length * 100) : 0;
  const recommendations: ReadinessRecommendation[] = [];

  if (facts.activeRecalls > 0) recommendations.push({
    priority: 'urgent', title: 'Resolve the active safety response first',
    detail: `${facts.activeRecalls} active recall notice${facts.activeRecalls === 1 ? '' : 's'} can affect products and recipients.`,
    action: 'Open Trace & Recall', path: '/recalls', basedOn: ['activeRecalls'],
  });
  if (facts.batchesTotal === 0) recommendations.push({
    priority: 'high', title: 'Create the first source record', detail: 'Readiness cannot be measured until a real harvest batch exists.',
    action: 'Create a batch', path: '/batches', basedOn: ['batchesTotal'],
  });
  else if (facts.batchesAttested < facts.batchesTotal) recommendations.push({
    priority: 'high', title: 'Verify the batches buyers will rely on',
    detail: `${facts.batchesTotal - facts.batchesAttested} of ${facts.batchesTotal} batches still need attestation.`,
    action: 'Review batches', path: '/batches', basedOn: ['batchesTotal', 'batchesAttested'],
  });
  if (facts.productsTotal === 0) recommendations.push({
    priority: 'medium', title: 'Create a scannable product identity', detail: 'Connect a product passport and QR destination to a traceable batch.',
    action: 'Create a product', path: '/products', basedOn: ['productsTotal'],
  });
  else {
    if (facts.productsWithEvidence < facts.productsTotal) recommendations.push({
      priority: 'high', title: 'Close the evidence gaps',
      detail: `${facts.productsTotal - facts.productsWithEvidence} product passport${facts.productsTotal - facts.productsWithEvidence === 1 ? '' : 's'} lack approved supporting evidence.`,
      action: 'Add evidence', path: '/evidence', basedOn: ['productsTotal', 'productsWithEvidence'],
    });
    if (facts.productsPublished < facts.productsTotal) recommendations.push({
      priority: 'medium', title: 'Publish buyer-ready passports',
      detail: `${facts.productsTotal - facts.productsPublished} product passport${facts.productsTotal - facts.productsPublished === 1 ? '' : 's'} remain private or in draft.`,
      action: 'Review products', path: '/products', basedOn: ['productsTotal', 'productsPublished'],
    });
  }
  if (!recommendations.length) recommendations.push({
    priority: 'complete', title: 'Core product records are ready for review',
    detail: 'The measured verification, evidence and publishing checks have no open gaps. This is not a legal compliance determination.',
    action: 'Review products', path: '/products', basedOn: ['batchesAttested', 'productsPublished', 'productsWithEvidence'],
  });

  return { score, recommendations: recommendations.slice(0, 4) };
}
