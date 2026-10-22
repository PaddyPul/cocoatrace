import { expect, it, vi } from 'vitest';
import { loadExpiryActions, loadRecallDeadlineActions } from './timeBoundActions';
import { notice } from './policy';
const id = '11111111-1111-4111-8111-111111111111';
it('skips expiry producers without permissions and scopes renewal reads to owning organizations', async () => {
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  expect(await loadExpiryActions({ organizationId: 'org', permissions: [] }, execute)).toEqual([]);
  expect(execute).not.toHaveBeenCalled();
  await loadExpiryActions({ organizationId: 'org', permissions: ['*'] }, execute);
  expect(execute).toHaveBeenCalledTimes(2);
  for (const [sql, parameters] of execute.mock.calls) {
    expect(sql).toContain('LIMIT 1001');
    expect(parameters).toEqual(['org']);
  }
  expect(execute.mock.calls[0][0]).toContain(
    'certifier_organization_id=$1 OR farmer_organization_id=$1',
  );
  expect(execute.mock.calls[1][0]).toContain('uploader_organization_id=$1');
});
it('expiry transitions change read fingerprints and links stay inside supported record pages', async () => {
  const execute = vi
    .fn()
    .mockResolvedValue({ rows: [{ id, expires_at: '2026-10-23T00:00:00Z', expired: false }] });
  const actor = { organizationId: 'org', permissions: ['certificate.read'] };
  const [soon] = await loadExpiryActions(actor, execute);
  execute.mockResolvedValue({ rows: [{ id, expires_at: '2026-10-23T00:00:00Z', expired: true }] });
  const [expired] = await loadExpiryActions(actor, execute);
  expect(soon.actionPath).toBe(`/certs?search=${id}`);
  expect(notice(soon).fingerprint).not.toBe(notice(expired).fingerprint);
  expect(expired.description).toContain('does not extend validity');
});
it('recall deadline scope is participant-or-manager, with no implicit network rights', async () => {
  const execute = vi.fn().mockResolvedValue({
    rows: [
      { id, organization_id: 'org', due_at: '2026-10-23T00:00:00Z', own: true, overdue: true },
    ],
  });
  const [action] = await loadRecallDeadlineActions(
    { organizationId: 'org', permissions: [] },
    execute,
  );
  expect(execute.mock.calls[0][1]).toEqual(['org', false, false]);
  expect(action.title).toContain('overdue');
  expect(action.description).toContain('not acknowledgement');
  expect(notice(action).actionPath).toBe(`/recalls?recallId=${id}`);
  expect(execute.mock.calls[0][0]).toContain('p.acknowledged_at IS NULL');
  expect(execute.mock.calls[0][0]).toContain("n.status='active'");
});
it('all safety producers reject overflow and database failures without inventing an empty feed', async () => {
  const execute = vi.fn().mockResolvedValue({ rows: Array.from({ length: 1001 }, () => ({})) });
  const actor = { organizationId: 'org', permissions: ['*'] };
  await expect(loadExpiryActions(actor, execute)).rejects.toMatchObject({
    code: 'TIMED_NOTICE_LIMIT',
  });
  await expect(loadRecallDeadlineActions(actor, execute)).rejects.toMatchObject({
    code: 'TIMED_NOTICE_LIMIT',
  });
  execute.mockRejectedValue(new Error('unavailable'));
  await expect(loadRecallDeadlineActions(actor, execute)).rejects.toThrow('unavailable');
});
