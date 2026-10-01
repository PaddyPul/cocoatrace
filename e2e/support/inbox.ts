import { expect, type APIRequestContext } from '@playwright/test';
import { baseURL, inboxURL } from './environment';

type Message = { ID: string; Subject: string; To: { Address: string }[] };

export async function emailLink(request: APIRequestContext, address: string, category: 'verification' | 'invitation' | 'reset', excludeId?: string) {
  const subject = { verification: 'Verify', invitation: 'invitation', reset: 'Reset' }[category];
  let selected: Message | undefined;
  await expect.poll(async () => {
    const response = await request.get(`${inboxURL}/api/v1/messages?limit=100`);
    if (!response.ok()) return false;
    const body = await response.json() as { messages: Message[] };
    selected = body.messages.find((message) => message.ID !== excludeId && message.Subject.includes(subject)
      && message.To.some((recipient) => recipient.Address.toLowerCase() === address.toLowerCase()));
    return Boolean(selected);
  }, { timeout: 20_000, message: `Expected ${category} email in the disposable inbox` }).toBe(true);
  const response = await request.get(`${inboxURL}/api/v1/message/${selected!.ID}`);
  expect(response.ok()).toBe(true);
  const message = await response.json() as { Text: string };
  const link = message.Text.match(/https?:\/\/[^\s<>]+/)?.[0];
  if (!link) throw new Error('Captured identity email did not contain a link');
  if (new URL(link).origin !== baseURL) throw new Error('Identity email points outside the disposable test origin');
  return { id: selected!.ID, link };
}
