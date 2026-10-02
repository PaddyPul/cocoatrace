import { describe, expect, it } from 'vitest';
import { installmentDueState } from './dueState';

describe('installment due-state boundaries', () => {
  const due = '2026-10-02T12:00:00.000Z';
  it('becomes overdue strictly after its UTC due instant', () => {
    expect(installmentDueState({ status: 'due', due_at: due }, new Date('2026-10-02T11:59:59.999Z'))).toBe('due');
    expect(installmentDueState({ status: 'due', due_at: due }, new Date(due))).toBe('due');
    expect(installmentDueState({ status: 'due', due_at: due }, new Date('2026-10-02T12:00:00.001Z'))).toBe('overdue');
  });
  it('compares timezone offsets as instants rather than local calendar dates', () => {
    expect(installmentDueState({ status: 'due', due_at: '2026-10-02T14:00:00+02:00' }, new Date(due))).toBe('due');
  });
  it('does not call submitted, paid, or untriggered obligations overdue', () => {
    const later = new Date('2027-01-01T00:00:00Z');
    expect(installmentDueState({ status: 'payment_submitted', due_at: due }, later)).toBe('awaiting_verification');
    expect(installmentDueState({ status: 'paid', due_at: due }, later)).toBe('paid');
    expect(installmentDueState({ status: 'awaiting_trigger', due_at: due }, later)).toBe('awaiting_trigger');
  });
  it('does not invent a due date for legacy or invalid timestamps', () => {
    expect(installmentDueState({ status: 'due', due_at: null })).toBe('due');
    expect(installmentDueState({ status: 'due', due_at: 'invalid' })).toBe('due');
  });
});
