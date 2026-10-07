import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { holdings as holdingsApi } from '../api';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import { StatusBadge } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { useCatalogPage } from '../components/catalog/useCatalogPage';
import PageNavigation from '../components/catalog/PageNavigation';

export default function InventoryPage() {
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const page = useCatalogPage(holdingsApi.page, { search: appliedSearch });
  const { items: holdings, loading, error, refresh: refetch } = page;

  // Incoming transfers
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [acceptingTransferId, setAcceptingTransferId] = useState<string | null>(null);

  useEffect(() => {
    if (canDo('custody.transfer.request')) {
      setTransfersLoading(true);
      holdingsApi
        .listTransfers()
        .then((t) => setTransfers(t.filter((x: any) => x.status === 'requested')))
        .catch(() => {})
        .finally(() => setTransfersLoading(false));
    }
  }, [canDo]);

  const handleAcceptTransfer = async (transferId: string) => {
    setAcceptingTransferId(transferId);
    try {
      await holdingsApi.acceptTransfer(transferId);
      setTransfers((prev) => prev.filter((t) => t.id !== transferId));
      refetch();
      toast('success', 'Transfer accepted — holding added to your inventory');
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setAcceptingTransferId(null);
    }
  };

  // Create holding
  const [showCreate, setShowCreate] = useState(false);
  const [chBatchId, setChBatchId] = useState('');
  const [chQty, setChQty] = useState(0);
  const [chWarehouse, setChWarehouse] = useState('');
  const [chLoading, setChLoading] = useState(false);
  const [chError, setChError] = useState('');

  const handleCreateHolding = async () => {
    if (!chBatchId || !chQty) {
      setChError('Batch ID and quantity required');
      return;
    }
    setChLoading(true);
    setChError('');
    try {
      await holdingsApi.create({
        batchId: chBatchId,
        quantityKg: Number(chQty),
        warehouseLocation: chWarehouse || undefined,
      });
      setShowCreate(false);
      setChBatchId('');
      setChQty(0);
      setChWarehouse('');
      refetch();
      toast('success', 'Holding created');
    } catch (e: any) {
      setChError(e.message);
    } finally {
      setChLoading(false);
    }
  };

  const filtered = holdings;
  return (
    <Layout currentPage="holdings">
      <div className="table-wrap">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              aria-label="Search inventory"
              maxLength={80}
              placeholder="Search holdings…"
              className="form-input pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn"
            onClick={() => {
              setAppliedSearch(search.trim());
              refetch();
            }}
          >
            Search inventory
          </button>
          <PageNavigation page={page} label="inventory" />
          <div className="text-xs text-text-muted">
            On this page: {filtered.length} holding{filtered.length !== 1 ? 's' : ''}
          </div>
          {canDo('holding.create') && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
              + Create Holding
            </button>
          )}
        </div>
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : error ? (
          <p role="alert">{error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Farm</th>
                <th>Crop</th>
                <th>Qty (kg)</th>
                <th>Warehouse</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((h) => (
                  <tr
                    key={h.id}
                    className="cursor-pointer hover:bg-brand-500/5"
                    onClick={() => navigate(`/holdings/${h.id}`)}
                  >
                    <td className="font-mono text-[11px]">{h.id.slice(0, 13)}…</td>
                    <td className="text-text-primary font-medium">{h.farm_name || '—'}</td>
                    <td>{h.crop || 'cocoa'}</td>
                    <td>{(h.quantity_kg || 0).toLocaleString()}</td>
                    <td className="text-[11px]">{h.warehouse_location || '—'}</td>
                    <td>
                      <StatusBadge status={h.status} />
                    </td>
                  </tr>
                ))
              ) : !appliedSearch && page.pageNumber === 1 ? (
                <tr>
                  <td colSpan={99}>
                    <EmptyState
                      icon="🏪"
                      title="No holdings yet"
                      description="Holdings represent batch inventory in your custody. They appear when batches are created or transferred to your organization."
                      action={
                        canDo('holding.create') ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setShowCreate(true)}
                          >
                            + Create Holding
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
                      title="No holdings match"
                      description="Try adjusting your search."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {transfers.length > 0 && (
        <div className="bg-surface border border-border rounded mt-4">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Incoming Transfers ({transfers.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {transfers.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium">{t.from_org_name}</div>
                  <div className="text-text-muted">
                    {t.quantity_kg} kg{t.warehouse_location ? ` · ${t.warehouse_location}` : ''}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleAcceptTransfer(t.id)}
                  disabled={acceptingTransferId === t.id}
                >
                  {acceptingTransferId === t.id ? 'Accepting…' : 'Accept'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => !chLoading && setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="modal-title">Create Holding</div>
              </div>
              <button className="btn btn-sm" onClick={() => setShowCreate(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                className="form-input"
                placeholder="Batch ID *"
                value={chBatchId}
                onChange={(e) => setChBatchId(e.target.value)}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Quantity (kg) *"
                value={chQty || ''}
                onChange={(e) => setChQty(Number(e.target.value))}
              />
              <input
                className="form-input"
                placeholder="Warehouse location"
                value={chWarehouse}
                onChange={(e) => setChWarehouse(e.target.value)}
              />
              {chError && (
                <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">
                  {chError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn flex-1 justify-center"
                  onClick={() => setShowCreate(false)}
                  disabled={chLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary flex-1 justify-center"
                  onClick={handleCreateHolding}
                  disabled={chLoading || !chBatchId || !chQty}
                >
                  {chLoading ? 'Creating…' : 'Create Holding'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
