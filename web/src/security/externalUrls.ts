/** Browser navigation only: never fetch or proxy a user-supplied destination. */
export function safeExternalHttpsUrl(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    /[\s\\]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    )
      return null;
    const host = url.hostname.toLowerCase();
    // External links allow public DNS names, never IP literals or local-only names.
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
    if (/(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan)$/.test(host))
      return null;
    return url.href;
  } catch {
    return null;
  }
}
