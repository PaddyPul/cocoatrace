import { useNavigate } from 'react-router-dom';
import { useAuthCtx } from '../auth/AuthProvider';

export default function SupplyPathChoice() {
  const navigate = useNavigate();
  const { canDo } = useAuthCtx();
  return (
    <section data-testid="supply-path-choice" className="grid gap-4 sm:grid-cols-2">
      {canDo('batch.create') && (
        <article className="rounded-2xl border border-border p-5">
          <h3 className="font-semibold">Conventional supply</h3>
          <p className="mt-2 text-sm text-text-muted">
            Record material you hold, its declared origin and quantity. No farm, plot or organic
            certification is invented.
          </p>
          <button
            className="btn btn-primary mt-4"
            onClick={() => {
              localStorage.removeItem('ct_guided_fresh_start');
              navigate('/inventory/new');
            }}
          >
            Create inventory
          </button>
        </article>
      )}
      {canDo('farm.create') && (
        <article className="rounded-2xl border border-border p-5">
          <h3 className="font-semibold">Source-traceable supply</h3>
          <p className="mt-2 text-sm text-text-muted">
            Register a farm and its plots, then record harvested quantity. Organic claims
            additionally need supporting evidence and review.
          </p>
          <button
            className="btn mt-4"
            onClick={() => {
              localStorage.removeItem('ct_guided_fresh_start');
              navigate('/farms');
            }}
          >
            Register source
          </button>
        </article>
      )}
      {!canDo('batch.create') && !canDo('farm.create') && (
        <p role="status">
          Ask an authorized inventory or source-record colleague to create supply first.
        </p>
      )}
    </section>
  );
}
