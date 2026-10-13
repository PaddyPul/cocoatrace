// Caller supplies a distinct, authorized batch_keys CTE. Evaluate safety as sets
// over those keys instead of repeating correlated graph probes for every row.
export const batchSafetyCtes = `active_edges AS MATERIALIZED (
 SELECT ab.batch_id,r.severity FROM recall_affected_batches ab JOIN batch_keys k ON k.batch_id=ab.batch_id JOIN recall_notices r ON r.id=ab.recall_id WHERE r.status='active'
 UNION ALL SELECT lot.batch_id,r.severity FROM recall_affected_lots al JOIN material_lots lot ON lot.id=al.lot_id JOIN batch_keys k ON k.batch_id=lot.batch_id JOIN recall_notices r ON r.id=al.recall_id WHERE r.status='active'
), active_safety AS MATERIALIZED (
 SELECT batch_id,CASE MAX(CASE severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) WHEN 3 THEN 'critical' WHEN 2 THEN 'warning' ELSE 'advisory' END AS active_severity FROM active_edges GROUP BY batch_id
), retained_batches AS MATERIALIZED (
 SELECT h.batch_id FROM recall_safety_holds held JOIN batch_holdings h ON held.entity_type='holding' AND h.id=held.entity_id JOIN batch_keys k ON k.batch_id=h.batch_id WHERE held.released_at IS NULL
 UNION SELECT h.batch_id FROM recall_recovery_records recovery JOIN batch_holdings h ON h.id=recovery.holding_id JOIN batch_keys k ON k.batch_id=h.batch_id WHERE recovery.returned_kg>0 OR recovery.destroyed_kg>0
), batch_safety AS MATERIALIZED (
 SELECT k.batch_id,(active.batch_id IS NOT NULL OR retained.batch_id IS NOT NULL) AS inventory_held,active.active_severity
 FROM batch_keys k LEFT JOIN active_safety active ON active.batch_id=k.batch_id LEFT JOIN retained_batches retained ON retained.batch_id=k.batch_id
)`;
