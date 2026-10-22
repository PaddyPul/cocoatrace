import { api } from './http';
export interface Notice {
  fingerprint: string;
  kind: string;
  title: string;
  description: string;
  requiresAction: boolean;
  responsibleParty: 'you' | 'other' | 'none';
  actionLabel: string;
  actionPath: string;
  read: boolean;
}
export interface NoticePage {
  currentCount: number;
  unreadCount: number;
  items: Notice[];
  hasMore: boolean;
  nextCursor: string | null;
  revision: string;
}
function validNotice(value: any): value is Notice {
  return (
    value &&
    /^[a-f0-9]{64}$/.test(value.fingerprint) &&
    ['kind', 'title', 'description', 'actionLabel'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    typeof value.requiresAction === 'boolean' &&
    typeof value.read === 'boolean' &&
    ['you', 'other', 'none'].includes(value.responsibleParty) &&
    typeof value.actionPath === 'string' &&
    /^\/(offers\?tab=(received|sent)|deal-room\/[a-f0-9-]+|payments\/[a-f0-9-]+|shipments\/[a-f0-9-]+|certs\?search=[a-f0-9-]+|evidence\?search=[a-f0-9-]+|recalls\?recallId=[a-f0-9-]+)$/.test(
      value.actionPath,
    )
  );
}
export const notifications = {
  async page(filter: 'all' | 'unread', cursor?: string): Promise<NoticePage> {
    const value = await api<any>(
      'GET',
      `/notifications/page?${new URLSearchParams({ limit: '25', filter, ...(cursor ? { cursor } : {}) })}`,
    );
    if (
      !value ||
      !Number.isInteger(value.currentCount) ||
      !Number.isInteger(value.unreadCount) ||
      value.unreadCount < 0 ||
      value.currentCount < value.unreadCount ||
      !Array.isArray(value.items) ||
      !value.items.every(validNotice) ||
      typeof value.hasMore !== 'boolean' ||
      !(value.nextCursor === null || typeof value.nextCursor === 'string') ||
      typeof value.revision !== 'string' ||
      value.hasMore !== Boolean(value.nextCursor)
    )
      throw new Error('Invalid notifications response');
    return value;
  },
  async summary(): Promise<{ currentCount: number; unreadCount: number; revision: string }> {
    const value = await api<any>('GET', '/notifications/summary');
    if (
      !value ||
      !Number.isInteger(value.currentCount) ||
      !Number.isInteger(value.unreadCount) ||
      value.unreadCount < 0 ||
      value.currentCount < value.unreadCount ||
      typeof value.revision !== 'string'
    )
      throw new Error('Invalid notifications summary');
    return value;
  },
  async read(fingerprint: string, read: boolean) {
    const value = await api<any>('POST', `/notifications/${fingerprint}/read`, { read });
    if (!value || value.fingerprint !== fingerprint || value.read !== read)
      throw new Error('Invalid read receipt response');
    return value as { fingerprint: string; read: boolean };
  },
};
