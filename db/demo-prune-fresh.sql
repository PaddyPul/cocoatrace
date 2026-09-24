-- Leave identities, roles and organizations in place, but remove every
-- operational object. The new buyer and supplier workspaces are genuinely
-- empty and ready for first-run testing.
TRUNCATE TABLE audit_events, pilot_feedback, user_invitations, product_profile_scans,
  recall_affected_lots, recall_affected_batches, recall_notices, product_profiles,
  evidence_items, payment_requests, shipment_milestones, lot_distributions,
  lot_genealogy_edges, transformation_events, material_lots, shipments,
  sales_contracts, trade_offers, listings, sourcing_requests, custody_transfers,
  batch_holdings, batch_attestations, harvest_batches, organic_certificates,
  farm_plots, farms RESTART IDENTITY CASCADE;

