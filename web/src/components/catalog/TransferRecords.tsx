import { useState } from 'react';
import { holdings } from '../../api';
import { useAuthCtx } from '../auth/AuthProvider';
import { useToast } from '../shared/ToastProvider';
import { useCatalogPage } from './useCatalogPage';
import PageNavigation from './PageNavigation';

export default function TransferRecords({ onAccepted }: { onAccepted: () => void }) {
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [direction, setDirection] = useState('incoming');
  const [status, setStatus] = useState('requested');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const page = useCatalogPage(holdings.transferPage, { direction, status, search: appliedSearch });
  const accept = async (id: string) => {
    setBusy(id);
    try {
      await holdings.acceptTransfer(id);
      page.refresh();
      onAccepted();
      toast('success', 'Transfer accepted — holding added to your inventory');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Transfer could not be accepted');
      page.refresh();
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      aria-label="Custody transfer records"
      className="mt-4 rounded border border-border bg-surface p-4"
    >
      <h3 className="text-sm font-semibold">Custody transfer records</h3>
      <p className="mt-1 text-xs text-text-muted">
        Review incoming requests or search your transfer history. Only the receiving organization
        can accept a request.
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        <select
          aria-label="Transfer direction"
          className="form-select"
          value={direction}
          disabled={Boolean(busy)}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="incoming">Incoming</option>
          <option value="outgoing">Outgoing</option>
          <option value="all">Both directions</option>
        </select>
        <select
          aria-label="Transfer status"
          className="form-select"
          value={status}
          disabled={Boolean(busy)}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="requested">Awaiting acceptance</option>
          <option value="accepted">Accepted</option>
          <option value="all">All statuses</option>
        </select>
        <input
          aria-label="Search transfers"
          maxLength={80}
          className="form-input"
          value={search}
          disabled={Boolean(busy)}
          placeholder="Material, organization, holding or transfer ID"
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn"
          disabled={Boolean(busy)}
          onClick={() => {
            setAppliedSearch(search.trim());
            page.refresh();
          }}
        >
          Search transfers
        </button>
        <button className="btn" disabled={Boolean(busy) || page.loading} onClick={page.refresh}>
          Refresh transfers
        </button>
      </div>
      {page.loading ? (
        <p role="status">Loading transfers…</p>
      ) : page.error ? (
        <p role="alert">
          Transfer records could not be loaded. {page.error} Use Refresh transfers to retry.
        </p>
      ) : (
        <>
          <p className="text-xs text-text-muted">On this page: {page.items.length} transfers</p>
          {!page.items.length && (
            <p role="status">No transfers match this view. Adjust direction, status or search.</p>
          )}
          <div className="divide-y divide-border">
            {page.items.map((transfer) => (
              <article
                key={transfer.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
              >
                <div>
                  <h4 className="font-medium">
                    {transfer.from_org_name} → {transfer.to_org_name}
                  </h4>
                  <p>
                    {transfer.crop || 'Material'} · {transfer.quantity_kg} kg · {transfer.status}
                  </p>
                  <p className="text-text-muted">
                    {transfer.id}
                    {transfer.warehouse_location ? ` · ${transfer.warehouse_location}` : ''}
                  </p>
                  {transfer.activeRecall && (
                    <p role="status">Supply has a recall hold. Acceptance is blocked.</p>
                  )}
                </div>
                {transfer.status === 'requested' &&
                  transfer.to_organization_id === user?.organizationId &&
                  canDo('custody.transfer.accept') && (
                    <button
                      className="btn btn-primary"
                      aria-label={`Accept transfer ${transfer.id}`}
                      disabled={Boolean(busy) || transfer.activeRecall}
                      onClick={() => accept(transfer.id)}
                    >
                      {busy === transfer.id ? 'Accepting…' : 'Accept transfer'}
                    </button>
                  )}
              </article>
            ))}
          </div>
        </>
      )}
      <PageNavigation
        label="transfers"
        page={{ ...page, loading: page.loading || Boolean(busy) }}
      />
    </section>
  );
}
