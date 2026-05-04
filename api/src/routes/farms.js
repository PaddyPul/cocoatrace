const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const audit = require('../services/audit');

// ============================================================
// FARMS
// ============================================================

router.get('/farms', requireAuth, async (req, res) => {
  const canSeeAll = req.user.permissions?.includes('*') || req.user.permissions?.includes('farm.read');
  let sql, params;
  if (canSeeAll) {
    sql = `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id ORDER BY f.name`;
    params = [];
  } else {
    sql = `SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.farmer_organization_id = $1 ORDER BY f.name`;
    params = [req.user.organizationId];
  }
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.get('/farms/:id', requireAuth, async (req, res) => {
  const farmRes = await query('SELECT f.*, o.name as farmer_org_name FROM farms f JOIN organizations o ON o.id = f.farmer_organization_id WHERE f.id = $1', [req.params.id]);
  if (!farmRes.rows[0]) return res.status(404).json({ error: 'Farm not found' });
  const plotRes = await query('SELECT * FROM farm_plots WHERE farm_id = $1 ORDER BY plot_code', [req.params.id]);
  const certRes = await query('SELECT * FROM organic_certificates WHERE farm_id = $1 ORDER BY valid_to DESC', [req.params.id]);
  res.json({ farm: farmRes.rows[0], plots: plotRes.rows, certificates: certRes.rows });
});

router.post('/farms', requireAuth, async (req, res) => {
  const { name, country = 'GH', region, district, community, officialTraceabilityId } = req.body;
  const { rows } = await query(
    'INSERT INTO farms (farmer_organization_id, name, country, region, district, community, official_traceability_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.user.organizationId, name, country, region, district, community || null, officialTraceabilityId || null]
  );
  await audit.record({ actorUserId: req.user.id, actorOrganizationId: req.user.organizationId, action: 'farm.create', entityType: 'farm', entityId: rows[0].id });
  res.status(201).json(rows[0]);
});

router.post('/farms/:id/plots', requireAuth, async (req, res) => {
  const { plotCode, areaHectares, crops = ['cocoa'], gpsLat, gpsLng, geolocationSource = 'farmer_submitted' } = req.body;
  const { rows } = await query(
    'INSERT INTO farm_plots (farm_id, plot_code, area_hectares, crops, gps_lat, gps_lng, geolocation_source) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.params.id, plotCode, areaHectares, crops, gpsLat || null, gpsLng || null, geolocationSource]
  );
  res.status(201).json(rows[0]);
});

router.get('/farms/:id/eudr', requireAuth, async (req, res) => {
  const { rows: plots } = await query('SELECT * FROM farm_plots WHERE farm_id = $1', [req.params.id]);
  const allGeo = plots.every(p => p.gps_lat || p.polygon_geojson);
  const allChecked = plots.every(p => p.eudr_cutoff_checked);
  const allClear = plots.every(p => p.deforestation_risk_status === 'clear');
  res.json({
    farmId: req.params.id,
    plotCount: plots.length,
    geolocationComplete: allGeo,
    eudrCutoffChecked: allChecked,
    allPlotsClear: allClear,
    eudrReady: allGeo && allChecked && allClear,
    plots,
  });
});

module.exports = router;
