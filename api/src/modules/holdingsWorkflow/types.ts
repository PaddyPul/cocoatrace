export type HoldingRow = {
  id: string;
  batch_id: string;
  holder_organization_id: string;
  quantity_kg: string;
  warehouse_location: string | null;
  status: string;
  created_at: Date;
};

export interface TransferRow {
  id: string;
  holding_id: string;
  from_organization_id: string;
  to_organization_id: string;
  quantity_kg: string;
  status: string;
  requested_at: Date;
  responded_at: Date | null;
}
export interface CreateHoldingInput {
  batchId: string;
  quantityKg: number;
  warehouseLocation?: string | null;
}
export interface TransferHoldingInput {
  toOrganizationId: string;
  quantityKg: number;
  reason?: string;
}
export interface SplitHoldingInput {
  quantities: number[];
}
