import { loadExpiryActions, loadRecallDeadlineActions } from './timeBoundActions';
import { beforeEach, expect, it, vi } from 'vitest';
import { loadTradeActions } from '../../services/tradeActionRepository';
import { loadTransportTimingNotices } from '../transportTiming/notices';
import { loadDispatchAcknowledgementActions } from '../dispatchAcknowledgement/actions';
import { currentNotificationActions } from './currentActions';
import type { AuthenticatedActor } from '../../services/authSessionService';
import type { TradeAction } from '../../services/tradeNextAction';
vi.mock('./timeBoundActions', () => ({
  loadExpiryActions: vi.fn(),
  loadRecallDeadlineActions: vi.fn(),
}));
vi.mock('../../services/tradeActionRepository', () => ({ loadTradeActions: vi.fn() }));
vi.mock('../transportTiming/notices', () => ({ loadTransportTimingNotices: vi.fn() }));
vi.mock('../dispatchAcknowledgement/actions', () => ({
  loadDispatchAcknowledgementActions: vi.fn(),
}));
const actor = {
  id: 'user',
  organizationId: 'org',
  permissions: ['shipment.read'],
} as AuthenticatedActor;
const execute = vi.fn();
const action = (id: string): TradeAction => ({
  id,
  kind: 'transport',
  priority: 1,
  requiresAction: true,
  title: 'Transport',
  description: id,
  actionLabel: 'Review shipment',
  actionPath: '/shipments/11111111-1111-4111-8111-111111111111',
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadExpiryActions).mockResolvedValue([]);
  vi.mocked(loadRecallDeadlineActions).mockResolvedValue([]);
  vi.mocked(loadTradeActions).mockResolvedValue([]);
  vi.mocked(loadTransportTimingNotices).mockResolvedValue([]);
  vi.mocked(loadDispatchAcknowledgementActions).mockResolvedValue([]);
});
it('combines notices using the same actor and read-snapshot executor', async () => {
  vi.mocked(loadTradeActions).mockResolvedValue([action('trade')]);
  vi.mocked(loadTransportTimingNotices).mockResolvedValue([action('eta')]);
  vi.mocked(loadDispatchAcknowledgementActions).mockResolvedValue([action('exception')]);
  expect((await currentNotificationActions(actor, execute)).map((row) => row.id)).toEqual([
    'trade',
    'eta',
    'exception',
  ]);
  expect(loadTradeActions).toHaveBeenCalledWith(actor, undefined, execute, 1000);
  expect(loadTransportTimingNotices).toHaveBeenCalledWith(actor, execute);
  expect(loadDispatchAcknowledgementActions).toHaveBeenCalledWith(actor, execute);
});
it('refuses combined overflow rather than silently dropping safety or transport notices', async () => {
  vi.mocked(loadTradeActions).mockResolvedValue(
    Array.from({ length: 1000 }, (_, i) => action(String(i))),
  );
  vi.mocked(loadTransportTimingNotices).mockResolvedValue([action('overdue')]);
  await expect(currentNotificationActions(actor, execute)).rejects.toMatchObject({
    code: 'NOTICE_SCOPE_EXCEEDED',
  });
});
it('propagates producer failure without treating unavailable transport as no issues', async () => {
  vi.mocked(loadTransportTimingNotices).mockRejectedValue(new Error('Timed out'));
  await expect(currentNotificationActions(actor, execute)).rejects.toThrow('Timed out');
});
