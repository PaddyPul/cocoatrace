export interface MaterialLot {
  id: string;
  lotCode: string;
  lotType: 'source' | 'production' | 'packaging';
  productName: string;
  quantityKg: number;
  batchId?: string;
  ownerName?: string;
  sourceMode?: 'farm_traceable' | 'direct_inventory' | null;
  sourceLabel?: string | null;
  downstreamLotCount?: number;
  distributionCount?: number;
}

export interface TraceLotResult extends MaterialLot {
  relationshipDepth: number;
  allocationConfidence: 'declared' | 'estimated';
  quantityRequiredKg?: number;
  percentOfLot?: number;
  sourceEquivalentKg?: number;
  sourceEquivalentPercent?: number;
  recallQuantityKg?: number;
}

export interface TraceBackResult {
  analysis?: { status: 'complete'; workUnits: number; safetyClearance: false };
  direction: 'trace-back';
  targetLot: MaterialLot;
  queryQuantityKg: number;
  tracedLots: TraceLotResult[];
  sourceLots: TraceLotResult[];
  exactness: 'declared' | 'estimated';
  warnings: string[];
  assumptions: string[];
}

export interface RecallImpactResult {
  analysis?: { status: 'complete'; workUnits: number; safetyClearance: false };
  direction: 'trace-forward';
  impactedLots: TraceLotResult[];
  leafLots: TraceLotResult[];
  impactedDistributions: Array<{
    id: string;
    lotId: string;
    recipientName: string;
    quantityKg: number;
    recallQuantityKg: number;
    distributionReference: string;
  }>;
  recipients: Array<{
    organizationId: string;
    name: string;
    recallQuantityKg: number;
    distributionCount: number;
  }>;
  totals: {
    impactedLotCount: number;
    leafRecallQuantityKg: number;
    distributedRecallQuantityKg: number;
    recipientCount: number;
  };
  exactness: 'declared' | 'estimated';
  warnings: string[];
  assumptions: string[];
}
