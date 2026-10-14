export interface AuditEvent {
  id: string;
  occurred_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string | null;
  new_state_hash?: string;
}
