import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { batches as batchesApi } from '../api';
import { Batch } from '../types';
import { StatusBadge, fmtDate } from '../components/shared/helpers';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { Search, X } from 'lucide-react';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';
import FarmPicker from '../components/catalog/FarmPicker';
function Err({ msg }: { msg: string }) {
  return <p role="alert">{msg}</p>;
}
export default function BatchesPage() {
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const page = useCatalogPage(batchesApi.page, { search });
  const { items: data, loading, error, refresh: refetch } = page;
  const batches = data as Batch[];
  const filtered = batches;

  // Create batch modal
  const [showCreate, setShowCreate] = useState(false);
  const [cbFarmId, setCbFarmId] = useState('');
  const [cbCrop, setCbCrop] = useState('cocoa');
  const [cbHarvestDate, setCbHarvestDate] = useState('');
  const [cbQty, setCbQty] = useState(0);
  const [cbMoisture, setCbMoisture] = useState('');
  const [cbGrade, setCbGrade] = useState('');
  const [cbLoading, setCbLoading] = useState(false);
  const [cbError, setCbError] = useState('');
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);

  const handleCreateBatch = async () => {
    if (!cbFarmId || !cbHarvestDate || !cbQty || cbQty <= 0) {
      setCbError('Farm, harvest date, and quantity required');
      return;
    }
    setCbLoading(true);
    setCbError('');
    try {
      const batch = await batchesApi.create({
        farmId: cbFarmId,
        crop: cbCrop,
        harvestDate: cbHarvestDate,
        quantityKg: Number(cbQty),
        moisturePercent: cbMoisture ? Number(cbMoisture) : undefined,
        grade: cbGrade || undefined,
      });
      setShowCreate(false);
      setCbFarmId('');
      setCbHarvestDate('');
      setCbQty(0);
      setCbMoisture('');
      setCbGrade('');
      setCreatedBatchId(batch.id);
      refetch();
      toast('success', 'Batch created successfully');
    } catch (e: any) {
      setCbError(e.message);
    } finally {
      setCbLoading(false);
    }
  };

  return (
    <Layout currentPage="batches">
      <PageNavigation label="batches" page={page} />
      <button className="btn btn-sm" disabled={loading} onClick={refetch}>
        Retry batches
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
              aria-label="Search batches"
              maxLength={80}
              placeholder="Search batches…"
              className="form-input pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-text-muted">
            {filtered.length} on this page · batch{filtered.length !== 1 ? 'es' : ''}
          </div>
          {canDo('batch.create') && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
              + Create Batch
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
                <th>Batch ID</th>
                <th>Farm</th>
                <th>Harvest Date</th>
                <th>Qty (kg)</th>
                <th>Grade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-brand-500/5"
                    onClick={() => navigate(`/batches/${b.id}`)}
                  >
                    <td className="font-mono text-[11px]">{b.id.slice(0, 13)}…</td>
                    <td className="text-text-primary font-medium">{b.farm_name || '—'}</td>
                    <td>{fmtDate(b.harvest_date)}</td>
                    <td>{(b.quantity_kg || 0).toLocaleString()}</td>
                    <td>{b.grade || '—'}</td>
                    <td>
                      <StatusBadge status={b.organic_claim_status} />
                    </td>
                    <td>
                      {b.current_holder_id === user?.organizationId && canDo('batch.create') ? (
                        <span className="badge badge-green font-mono text-[10px]">
                          You hold this
                        </span>
                      ) : (
                        <span className="text-text-muted text-[10px]">Details →</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : !search && page.pageNumber === 1 ? (
                <tr>
                  <td colSpan={99}>
                    <EmptyState
                      icon="📦"
                      title="No batches yet"
                      description="Create a batch after harvesting to begin the traceability chain."
                      action={
                        canDo('batch.create') ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setShowCreate(true)}
                          >
                            + Create Batch
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
                      title="No batches match"
                      description="Try adjusting your search."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Batch Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => !cbLoading && setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="modal-title">Create Batch</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <FarmPicker
                value={cbFarmId}
                owned
                disabled={cbLoading}
                onChange={(farm) => setCbFarmId(farm?.id || '')}
              />
              <input
                type="date"
                className="form-input"
                value={cbHarvestDate}
                onChange={(e) => setCbHarvestDate(e.target.value)}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Quantity (kg) *"
                value={cbQty || ''}
                onChange={(e) => setCbQty(Number(e.target.value))}
              />
              <input
                className="form-input"
                placeholder="Crop (default: cocoa)"
                value={cbCrop}
                onChange={(e) => setCbCrop(e.target.value)}
              />
              <input
                type="number"
                step="0.1"
                className="form-input"
                placeholder="Moisture %"
                value={cbMoisture}
                onChange={(e) => setCbMoisture(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="Grade (e.g. Grade A)"
                value={cbGrade}
                onChange={(e) => setCbGrade(e.target.value)}
              />
              {cbError && (
                <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                  {cbError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn flex-1 justify-center"
                  onClick={() => setShowCreate(false)}
                  disabled={cbLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary flex-1 justify-center"
                  onClick={handleCreateBatch}
                  disabled={cbLoading}
                >
                  {cbLoading ? 'Creating…' : 'Create Batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createdBatchId && (
        <div className="modal-overlay" onClick={() => setCreatedBatchId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="text-center py-6">
              <div className="text-3xl mb-3">📦</div>
              <div className="text-lg font-semibold text-brand-400 mb-1">Batch Created!</div>
              <p className="text-xs text-text-muted mb-5">
                You can now list this batch on the marketplace for buyers.
              </p>
              <div className="flex gap-2 justify-center">
                <button className="btn" onClick={() => setCreatedBatchId(null)}>
                  Done
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCreatedBatchId(null);
                    navigate(`/batches/${createdBatchId}`);
                  }}
                >
                  List on Marketplace →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
