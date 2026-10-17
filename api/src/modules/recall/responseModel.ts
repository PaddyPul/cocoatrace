import type { TradeActor } from '../trading/transaction';

export type RecallActor = TradeActor & { permissions: string[] };
export interface RecallNotice extends Record<string, unknown> {
  id: string;
  status: string;
  initiated_by_organization_id: string;
}
export interface RecallParticipant extends Record<string, unknown> {
  recall_id: string;
  organization_id: string;
}
export interface AffectedHolding extends Record<string, unknown> {
  id: string;
  holder_organization_id: string;
  quantity_kg: string | number;
}
export interface RecoveryRecord extends Record<string, unknown> {
  recall_id: string;
  holding_id: string;
}
export interface ResolutionInventory extends Record<string, unknown> {
  quantity_kg: string | number;
  holding_id: string | null;
  quarantined_kg: string | number | null;
  returned_kg: string | number | null;
  destroyed_kg: string | number | null;
  corrected_kg: string | number | null;
  released_kg: string | number | null;
}
