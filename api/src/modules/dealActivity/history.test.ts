import { describe, expect, it, vi } from 'vitest';
import { activityInput, dealActivity } from './history';
const contract = '11111111-1111-4111-8111-111111111111';
const org = '22222222-2222-4222-8222-222222222222';
const event = {
  id: '33333333-3333-4333-8333-333333333333',
  action: 'payment.terms.confirm',
  at: '2026-10-15 12:30:00.123456+00',
  party: 'buyer',
  metadata: { secret: 'hidden' },
  actor_user_id: 'private',
};
describe('customer deal activity projection', () => {
  it('denies unrelated or absent contract before reading audit events', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(dealActivity(execute, org, contract, {})).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toContain('buyer_organization_id,seller_organization_id');
  });
  it('projects fixed safe fields and never returns metadata or individual identities', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: contract }] })
      .mockResolvedValueOnce({ rows: [event] });
    const result = await dealActivity(execute, org, contract, {});
    expect(result).toEqual({
      items: [
        { id: event.id, label: 'Payment terms confirmed', occurredAt: event.at, party: 'buyer' },
      ],
      hasMore: false,
      nextCursor: null,
    });
    const [sql, args] = execute.mock.calls[1];
    expect(sql).toContain('a.action=ANY($3::text[])');
    expect(sql).not.toContain('a.metadata');
    expect(args[2]).not.toContain('maintenance.repair_legacy_commitment');
    expect(sql).toContain('LIMIT $6');
    expect(args[5]).toBe(26);
  });
  it('uses precise timestamp and ID cursor scoped to current party and contract', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: contract }] })
      .mockResolvedValueOnce({ rows: [event, { ...event, id: contract }] });
    const result = await dealActivity(execute, org, contract, { limit: '1' });
    expect(result.items).toHaveLength(1);
    expect(activityInput({ cursor: result.nextCursor }, org, contract).cursor?.at).toBe(event.at);
    expect(() => activityInput({ cursor: result.nextCursor }, contract, contract)).toThrow(
      'Invalid activity cursor',
    );
    expect(() => activityInput({ cursor: result.nextCursor }, org, org)).toThrow(
      'Invalid activity cursor',
    );
  });
  it('rejects cursor IDs that would otherwise reach a PostgreSQL UUID cast', () => {
    const scope = activityInput({}, org, contract).scope;
    const cursor = Buffer.from(
      JSON.stringify({ scope, id: '-'.repeat(36), at: event.at }),
    ).toString('base64url');
    expect(() => activityInput({ cursor }, org, contract)).toThrow('Invalid activity cursor');
  });
  it.each([
    { limit: '0' },
    { limit: '51' },
    { limit: ['2'] },
    { search: 'secret' },
    { cursor: 'garbage' },
  ])('rejects malformed or unbounded input %j', (input) => {
    expect(() => activityInput(input, org, contract)).toThrow();
  });
});
