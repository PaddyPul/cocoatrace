export interface PublicNotice {
  id: string;
  reference_code: string;
  title: string;
  reason: string;
  instructions: string;
  severity: 'advisory' | 'warning' | 'critical';
  status: 'active' | 'resolved';
  initiated_at: string;
  acknowledgement_due_at?: string | null;
  resolved_at: string | null;
  issued_by: string;
}

export interface PublicNoticeSafety {
  status: 'clear' | 'advisory' | 'warning' | 'critical';
  inventoryHeld: boolean;
  activeCount: number;
  resolvedCount: number;
  criticalCount: number;
  warningCount: number;
  advisoryCount: number;
  checkedAt: string;
}

export type RecallRegisterRow = Omit<RecallNotice, 'batch_ids' | 'affected_lots'> & {
  batch_count: number;
  affected_lot_count: number;
};

export interface RecallNotice {
  id: string;
  reference_code: string;
  title: string;
  reason: string;
  instructions: string;
  severity: 'advisory' | 'warning' | 'critical';
  status: 'draft' | 'active' | 'resolved';
  initiated_at: string;
  acknowledgement_due_at?: string | null;
  resolved_at?: string;
  issued_by: string;
  batch_ids: string[];
  affected_lots?: Array<{
    lotId: string;
    lotCode: string;
    sourceEquivalentKg: number;
    recallQuantityKg: number;
    relationshipDepth: number;
  }>;
}

export interface RecallRecovery {
  holding_id: string;
  quarantined_kg: number | string;
  returned_kg: number | string;
  destroyed_kg: number | string;
  corrected_kg: number | string;
  released_kg: number | string;
  note: string;
}

export type RecallResponseCollection = 'participants' | 'holdings' | 'recoveries' | 'evidence';

export interface RecallResponsePaging {
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
}

export interface RecallResponse {
  paging?: Record<RecallResponseCollection, RecallResponsePaging>;
  selectedHolding?: RecallResponse['holdings'][number] | null;
  notice: RecallNotice;
  canManage: boolean;
  myOrganizationId: string;
  participants: Array<{
    organization_id: string;
    organization_name: string;
    acknowledged_at: string | null;
    acknowledgement_note: string | null;
    contact_status: string;
    email_statuses: string[];
    eligible_contact_count?: number;
  }>;
  holdings: Array<{
    id: string;
    batch_id: string;
    quantity_kg: number | string;
    holder_organization_id: string;
    recovery?: RecallRecovery | null;
  }>;
  recoveries: RecallRecovery[];
  evidence: Array<{ id: string; file_name: string }>;
}
