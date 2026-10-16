import { describe, expect, it } from 'vitest';
import { cursorOffset, hash, notice, pageInput } from './policy';
import type { TradeAction } from '../../services/tradeNextAction';
const action: TradeAction = {
  id: 'offer:123',
  kind: 'offer_decision',
  priority: 10,
  requiresAction: true,
  title: 'Offer',
  description: 'Buyer submitted terms',
  actionLabel: 'Review',
  actionPath: '/offers?tab=received',
};
describe('current notification identity and paging', () => {
  it('is stable but changed descriptions and responsibility are unread identities', () => {
    expect(notice(action).fingerprint).toBe(notice({ ...action }).fingerprint);
    expect(notice({ ...action, description: 'Changed terms' }).fingerprint).not.toBe(
      notice(action).fingerprint,
    );
    expect(notice({ ...action, requiresAction: false }).fingerprint).not.toBe(
      notice(action).fingerprint,
    );
    expect(notice(action).responsibleParty).toBe('you');
  });
  it('rejects external or protocol relative paths', () => {
    for (const actionPath of [
      'https://evil.test',
      '//evil.test',
      '/offers?tab=received&redirect=evil',
    ])
      expect(() => notice({ ...action, actionPath })).toThrow();
  });
  it('rejects mismatched scope, snapshot or malformed cursors', () => {
    const cursor = Buffer.from(JSON.stringify({ scope: 'a', revision: 'b', offset: 25 })).toString(
      'base64url',
    );
    expect(cursorOffset(cursor, 'a', 'b')).toBe(25);
    expect(() => cursorOffset(cursor, 'different', 'b')).toThrow('refresh');
    expect(() => cursorOffset(cursor, 'a', 'different')).toThrow('refresh');
    expect(() => cursorOffset('!', 'a', 'b')).toThrow();
    expect(hash(['user', 'org', 'all'])).not.toBe(hash(['user', 'org', 'unread']));
  });
  it('strictly bounds pages', () => {
    expect(pageInput({}).limit).toBe(25);
    for (const limit of ['0', '101', '1.2', 'no']) expect(() => pageInput({ limit })).toThrow();
    expect(() => pageInput({ filter: 'foreign' })).toThrow();
  });
});
