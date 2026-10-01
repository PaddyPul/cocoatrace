export function localOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Browser tests require a local disposable HTTP origin');
  }
  return url.origin;
}

export const baseURL = localOrigin(process.env.COCOATRACE_BROWSER_BASE_URL || 'http://127.0.0.1:13000');
export const inboxURL = localOrigin(process.env.COCOATRACE_BROWSER_INBOX_URL || 'http://127.0.0.1:18025');
