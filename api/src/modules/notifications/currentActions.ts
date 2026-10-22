import { loadExpiryActions, loadRecallDeadlineActions } from './timeBoundActions';
import type { AuthenticatedActor } from '../../services/authSessionService';
import type { Execute } from '../catalog/paging';
import { AppError } from '../../errors';
import { loadTradeActions } from '../../services/tradeActionRepository';
import { loadTransportTimingNotices } from '../transportTiming/notices';
import { loadDispatchAcknowledgementActions } from '../dispatchAcknowledgement/actions';

// All producers enforce their own SQL sentinel before hydration. Never truncate a
// combined current feed: callers must receive an explicit incomplete-scope error.
export async function currentNotificationActions(actor: AuthenticatedActor, execute: Execute) {
  const [trade, timing, dispatch, expiry, recall] = await Promise.all([
    loadTradeActions(actor, undefined, execute, 1000),
    loadTransportTimingNotices(actor, execute),
    loadDispatchAcknowledgementActions(actor, execute),
    loadExpiryActions(actor, execute),
    loadRecallDeadlineActions(actor, execute),
  ]);
  const actions = [...trade, ...timing, ...dispatch, ...expiry, ...recall];
  if (actions.length > 1000)
    throw new AppError(
      'Current notifications exceed the supported scope',
      503,
      'NOTICE_SCOPE_EXCEEDED',
    );
  return actions;
}
