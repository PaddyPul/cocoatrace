import { expect, request as apiRequest } from '@playwright/test';
import { baseURL, inboxURL } from './environment';

type Message = { ID: string; Subject: string; To: { Address: string }[] };

export async function emailLink(address: string, category: 'verification' | 'invitation' | 'reset', excludeId?: string) {
  // Never reuse page.request: it carries app-origin headers and session cookies.
  const inbox = await apiRequest.newContext({
    baseURL: inboxURL,
    extraHTTPHeaders: { Origin: inboxURL },
    maxRedirects: 0,
    timeout: 10_000,
  });
  try {
    const subject = { verification: 'Verify', invitation: 'invitation', reset: 'Reset' }[category];
    let selected: Message | undefined;
    let inboxFailure: Error | undefined;
    // expect.poll retries thrown errors; return immediately and rethrow outside it
    // so HTTP/configuration failures are not disguised as missing mail.
    await expect.poll(async () => {
      if (inboxFailure) return true;
      try {
        const response = await inbox.get('/api/v1/messages?limit=100');
        if (!response.ok()) throw new Error(`Disposable inbox listing failed (HTTP ${response.status()}); check Mailpit readiness and origin configuration.`);
        const body = await response.json() as { messages: Message[] };
        if (!Array.isArray(body.messages)) throw new Error('Disposable inbox returned an invalid message listing.');
        selected = body.messages.find((message) => message.ID !== excludeId && message.Subject.includes(subject)
          && message.To.some((recipient) => recipient.Address.toLowerCase() === address.toLowerCase()));
        return Boolean(selected);
      } catch (error) {
        inboxFailure = error instanceof Error && error.message.startsWith('Disposable inbox')
          ? error : new Error('Disposable inbox request failed; check Mailpit readiness.');
        return true;
      }
    }, { timeout: 20_000, message: `Expected ${category} email in the disposable inbox` }).toBe(true);
    if (inboxFailure) throw inboxFailure;
    const response = await inbox.get(`/api/v1/message/${encodeURIComponent(selected!.ID)}`);
    if (!response.ok()) throw new Error(`Disposable inbox message read failed (HTTP ${response.status()}).`);
    const message = await response.json() as { Text: string };
    const link = message.Text.match(/https?:\/\/[^\s<>]+/)?.[0];
    if (!link) throw new Error('Captured identity email did not contain a link');
    if (new URL(link).origin !== baseURL) throw new Error('Identity email points outside the disposable test origin');
    return { id: selected!.ID, link };
  } finally {
    await inbox.dispose();
  }
}
