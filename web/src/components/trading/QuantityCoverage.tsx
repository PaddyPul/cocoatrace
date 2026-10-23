export default function QuantityCoverage({
  requested,
  available,
  offer = false,
}: {
  requested: number;
  available: number;
  offer?: boolean;
}) {
  if (!Number.isFinite(requested) || requested <= 0 || !Number.isFinite(available) || available < 0)
    return null;
  const quantity = Math.min(requested, available),
    shortfall = Math.max(0, requested - quantity);
  const kg = (value: number) => `${value.toLocaleString()} kg`;
  return (
    <div
      className={`mt-3 rounded-xl border p-3 text-xs ${shortfall ? 'border-amber-300/40 text-amber-200' : 'border-border text-text-muted'}`}
    >
      <strong>
        {shortfall
          ? offer
            ? 'Partial order'
            : 'Partial supply match'
          : 'Quantity covers this brief'}
      </strong>
      <p>
        Brief requests {kg(requested)} ({(requested / 1000).toLocaleString()} metric tonnes).{' '}
        {offer ? 'This offer' : 'This lot'}: {kg(available)}. Covers{' '}
        {Math.min(100, (available / requested) * 100).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}
        %.
      </p>
      {shortfall > 0 && (
        <p>
          {kg(shortfall)} of the requested quantity is not covered by{' '}
          {offer ? 'this offer' : 'this lot'}. Source the balance separately; this does not fulfil
          the full brief.
        </p>
      )}
    </div>
  );
}
