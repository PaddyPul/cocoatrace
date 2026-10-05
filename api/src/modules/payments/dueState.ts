export type InstallmentDueState =
  | 'awaiting_trigger'
  | 'paid'
  | 'awaiting_verification'
  | 'due'
  | 'overdue';

/** A submitted payment awaits the seller, rather than further buyer action. */
export function installmentDueState(
  item: { status: string; due_at?: Date | string | null },
  now: Date = new Date(),
): InstallmentDueState {
  if (item.status === 'paid') return 'paid';
  if (item.status === 'payment_submitted') return 'awaiting_verification';
  if (item.status !== 'due') return 'awaiting_trigger';
  const due = item.due_at ? new Date(item.due_at).getTime() : NaN;
  return Number.isFinite(due) && now.getTime() > due ? 'overdue' : 'due';
}
