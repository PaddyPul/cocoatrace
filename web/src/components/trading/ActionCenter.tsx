import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TradeAction } from './TradeAction';
import { tradeActionPresentation } from '../shared/statusPresentation';

type Filter = 'all' | 'required' | 'overdue';

export function ActionCenter({
  actions,
  navigate,
  failed,
}: {
  failed?: boolean;
  actions: TradeAction[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  if (failed) return null;
  const required = actions.filter((item) => item.requiresAction).length;
  const overdue = actions.filter((item) => item.paymentDueState === 'overdue').length;
  const visible = actions.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'required' ? item.requiresAction : item.paymentDueState === 'overdue'),
  );
  return (
    <section
      aria-label="Trade action centre"
      className="mt-5 rounded-3xl border border-brand-400/25 p-5 sm:p-6"
    >
      <h3 className="text-xl font-bold">
        {required
          ? `${required} action${required === 1 ? '' : 's'} need your attention`
          : 'Your trades are moving'}
      </h3>
      <p className="mt-2 text-xs text-text-muted">
        Updates automatically. Overdue means a recorded payment deadline has passed according to the
        server. Other trade steps have no assumed deadline.
      </p>
      <div role="group" aria-label="Filter trade actions" className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['all', `All (${actions.length})`],
            ['required', `Action required (${required})`],
            ['overdue', `Overdue payments (${overdue})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            className="btn text-xs"
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!visible.length ? (
        <p role="status" className="mt-4">
          {actions.length
            ? 'No trade actions match this filter.'
            : 'No active trade actions to show. Use the sourcing or supply setup below to start a new trade.'}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {visible.map((item) => (
            <button
              data-testid="dashboard-trade-action"
              data-contract-id={item.contractId}
              data-action-id={item.id}
              key={item.id}
              onClick={() => navigate(item.actionPath)}
              className="flex w-full flex-col gap-2 rounded-2xl border border-border p-4 text-left"
            >
              <span className="text-sm font-semibold">{item.title}</span>
              <span className={`badge badge-${tradeActionPresentation(item).tone}`}>
                {tradeActionPresentation(item).label}
              </span>
              {item.paymentDueState === 'overdue' && (
                <span className="badge badge-red">Payment overdue</span>
              )}
              <span className="text-xs text-text-muted">{item.description}</span>
              <span className="text-xs text-brand-300">{item.actionLabel}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
