import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { farms as farmsApi } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { Search, X } from 'lucide-react';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';
function Err({ msg }: { msg: string }) {
  return <p role="alert">{msg}</p>;
}
export default function FarmsPage() {
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const page = useCatalogPage(farmsApi.page, { search });
  const { items: data, loading, error, refresh: refetch } = page;
  const [showCreate, setShowCreate] = useState(false);
  const [cfName, setCfName] = useState('');
  const [cfRegion, setCfRegion] = useState('');
  const [cfDistrict, setCfDistrict] = useState('');
  const [cfCommunity, setCfCommunity] = useState('');
  const [cfTraceId, setCfTraceId] = useState('');
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [createdFarmId, setCreatedFarmId] = useState<string | null>(null);
  const filtered = data;

  // Plot creation
  const [showPlot, setShowPlot] = useState(false);
  const [plotCode, setPlotCode] = useState('');
  const [plotArea, setPlotArea] = useState(0);
  const [plotCrops, setPlotCrops] = useState('cocoa');
  const [plotGpsLat, setPlotGpsLat] = useState('');
  const [plotGpsLng, setPlotGpsLng] = useState('');
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState('');
  const [completedFarmId, setCompletedFarmId] = useState<string | null>(null);

  const handleCreateFarm = async () => {
    if (!cfName || !cfRegion || !cfDistrict) {
      setCfError('Name, region, and district required');
      return;
    }
    setCfLoading(true);
    setCfError('');
    try {
      const farm = await farmsApi.create({
        name: cfName,
        region: cfRegion,
        district: cfDistrict,
        community: cfCommunity || undefined,
        officialTraceabilityId: cfTraceId || undefined,
      });
      setShowCreate(false);
      setCfName('');
      setCfRegion('');
      setCfDistrict('');
      setCfCommunity('');
      setCfTraceId('');
      setCreatedFarmId(farm.id);
      refetch();
      toast('success', 'Farm created successfully');
    } catch (e: any) {
      setCfError(e.message);
    } finally {
      setCfLoading(false);
    }
  };

  const handleCreatePlot = async () => {
    if (!createdFarmId || !plotCode || !plotArea) {
      setPlotError('Plot code and area required');
      return;
    }
    setPlotLoading(true);
    setPlotError('');
    try {
      await farmsApi.createPlot(createdFarmId, {
        plotCode,
        areaHectares: Number(plotArea),
        crops: plotCrops.split(',').map((s) => s.trim()),
        gpsLat: plotGpsLat ? Number(plotGpsLat) : undefined,
        gpsLng: plotGpsLng ? Number(plotGpsLng) : undefined,
      });
      setShowPlot(false);
      setPlotCode('');
      setPlotArea(0);
      setPlotCrops('cocoa');
      setPlotGpsLat('');
      setPlotGpsLng('');
      setCompletedFarmId(createdFarmId);
      setCreatedFarmId(null);
      toast('success', 'Plot added to farm');
    } catch (e: any) {
      setPlotError(e.message);
    } finally {
      setPlotLoading(false);
    }
  };

  return (
    <Layout currentPage="farms">
      <PageNavigation label="farms" page={page} />
      <button className="btn btn-sm" disabled={loading} onClick={refetch}>
        Retry farms
      </button>
      <div className="table-wrap">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              aria-label="Search farms"
              maxLength={80}
              placeholder="Search farms…"
              className="form-input pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-text-muted">
            {filtered.length} on this page · farm{filtered.length !== 1 ? 's' : ''}
          </div>
          {canDo('farm.create') && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
              + Create Farm
            </button>
          )}
        </div>
        {loading ? (
          <SkeletonTable rows={5} cols={7} />
        ) : error ? (
          <Err msg={error} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Region</th>
                <th>Country</th>
                <th>District</th>
                <th>COCOBOD ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="cursor-pointer hover:bg-brand-500/5"
                    onClick={() => navigate(`/farms/${f.id}`)}
                  >
                    <td className="text-text-primary font-medium">{f.name}</td>
                    <td>{f.region}</td>
                    <td>{f.country}</td>
                    <td>{f.district}</td>
                    <td className="font-mono text-[11px]">{f.official_traceability_id || '—'}</td>
                    <td>
                      <span className="badge badge-amber">
                        {f.verification_status === 'verified'
                          ? 'Legacy status · review details unavailable'
                          : f.verification_status === 'self_declared'
                            ? 'Supplier declared'
                            : 'Review pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : !search && page.pageNumber === 1 ? (
                <tr>
                  <td colSpan={99}>
                    <EmptyState
                      icon="🏡"
                      title="No farms registered"
                      description="Register a source farm to record field-level provenance."
                      action={
                        canDo('farm.create') ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setShowCreate(true)}
                          >
                            + Create Farm
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={99}>
                    <EmptyState
                      icon="🔍"
                      title="No farms match"
                      description="Try adjusting your search."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => !cfLoading && setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="modal-title">Create Farm</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="form-input"
                placeholder="Farm name *"
                value={cfName}
                onChange={(e) => setCfName(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="Region *"
                value={cfRegion}
                onChange={(e) => setCfRegion(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="District *"
                value={cfDistrict}
                onChange={(e) => setCfDistrict(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="Community"
                value={cfCommunity}
                onChange={(e) => setCfCommunity(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="COCOBOD ID"
                value={cfTraceId}
                onChange={(e) => setCfTraceId(e.target.value)}
              />
              {cfError && (
                <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                  {cfError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn flex-1 justify-center"
                  onClick={() => setShowCreate(false)}
                  disabled={cfLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary flex-1 justify-center"
                  onClick={handleCreateFarm}
                  disabled={cfLoading}
                >
                  {cfLoading ? 'Creating…' : 'Create Farm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createdFarmId && !showPlot && (
        <div className="modal-overlay" onClick={() => setCreatedFarmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🌱</div>
              <div className="text-lg font-semibold text-brand-400 mb-1">Farm Created!</div>
              <p className="text-xs text-text-muted mb-5">
                Add plots to register the growing areas for this farm.
              </p>
              <div className="flex gap-2 justify-center">
                <button className="btn" onClick={() => setCreatedFarmId(null)}>
                  Skip
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowPlot(true);
                  }}
                >
                  + Add Plot
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    navigate(`/farms/${createdFarmId}`);
                  }}
                >
                  View Farm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlot && createdFarmId && (
        <div className="modal-overlay" onClick={() => !plotLoading && setShowPlot(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="modal-title">Add Plot</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowPlot(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="form-input"
                placeholder="Plot code * (e.g. PLOT-A-01)"
                value={plotCode}
                onChange={(e) => setPlotCode(e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="Area (hectares) *"
                value={plotArea || ''}
                onChange={(e) => setPlotArea(Number(e.target.value))}
              />
              <input
                className="form-input"
                placeholder="Crops (comma-separated, default: cocoa)"
                value={plotCrops}
                onChange={(e) => setPlotCrops(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="GPS Lat"
                  value={plotGpsLat}
                  onChange={(e) => setPlotGpsLat(e.target.value)}
                />
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="GPS Lng"
                  value={plotGpsLng}
                  onChange={(e) => setPlotGpsLng(e.target.value)}
                />
              </div>
              {plotError && (
                <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                  {plotError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn flex-1 justify-center"
                  onClick={() => {
                    setShowPlot(false);
                    setCreatedFarmId(null);
                  }}
                  disabled={plotLoading}
                >
                  Skip
                </button>
                <button
                  className="btn btn-primary flex-1 justify-center"
                  onClick={handleCreatePlot}
                  disabled={plotLoading || !plotCode || !plotArea}
                >
                  {plotLoading ? 'Creating…' : 'Add Plot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {completedFarmId && (
        <div className="modal-overlay" onClick={() => setCompletedFarmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="text-center py-6">
              <div className="text-3xl mb-3">✓</div>
              <div className="text-lg font-semibold text-brand-400 mb-1">Source ready</div>
              <p className="text-xs text-text-muted mb-5">
                Record the harvested quantity next. CocoaTrace will create the inventory holding
                automatically.
              </p>
              <div className="flex gap-2 justify-center">
                <button className="btn" onClick={() => setCompletedFarmId(null)}>
                  Stay here
                </button>
                <button className="btn btn-primary" onClick={() => navigate('/batches')}>
                  Record harvest →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
