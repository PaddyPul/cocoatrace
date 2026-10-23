import type { Page } from '@playwright/test';
import { baseURL } from './environment';

/** One recovery for a failed local document GET, never a replay of test actions. */
export async function gotoWithNetworkRecovery(
  page: Pick<Page, 'goto'>,
  path: string,
  options?: Parameters<Page['goto']>[1],
) {
  const target = new URL(path, baseURL);
  if (
    target.origin !== baseURL ||
    target.pathname.startsWith('/api/') ||
    target.username ||
    target.password
  )
    throw new Error('Navigation recovery is restricted to local application pages');
  try {
    return await page.goto(path, options);
  } catch (error) {
    if (!(error instanceof Error) || !/\bnet::ERR_NETWORK_CHANGED\b/.test(error.message))
      throw error;
    console.warn('Retrying read-only page navigation after ERR_NETWORK_CHANGED (1/1)');
    return page.goto(path, options);
  }
}
