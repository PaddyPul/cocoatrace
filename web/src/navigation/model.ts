import type { User } from '../domains/identity/types';

export type WorkspaceMode = 'buy' | 'sell' | 'admin' | 'records';
export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: string;
  permissions: string[];
  all?: boolean;
};
export type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
  collapsible?: boolean;
};
type Actor = Pick<User, 'permissions' | 'orgType'>;
export const hasPermission = (user: Actor | null, permission: string) =>
  Boolean(user?.permissions.includes('*') || user?.permissions.includes(permission));
export function workspaces(user: Actor | null): WorkspaceMode[] {
  const result: WorkspaceMode[] = [];
  if (user?.permissions.includes('*')) result.push('admin');
  if (hasPermission(user, 'offer.create')) result.push('buy');
  if (hasPermission(user, 'listing.create')) result.push('sell');
  return result.length ? result : ['records'];
}
export function resolveWorkspace(
  user: Actor | null,
  preference: string | null,
  goal?: string | null,
): WorkspaceMode {
  const allowed = workspaces(user);
  if (allowed.includes(preference as WorkspaceMode)) return preference as WorkspaceMode;
  if (goal?.startsWith('buy') && allowed.includes('buy')) return 'buy';
  if (goal?.startsWith('sell') && allowed.includes('sell')) return 'sell';
  if (allowed.includes('admin')) return 'admin';
  if (
    allowed.includes('buy') &&
    (goal?.startsWith('buy') || ['buyer', 'importer'].includes(user?.orgType || ''))
  )
    return 'buy';
  return allowed.includes('sell') ? 'sell' : allowed[0];
}
const item = (
  id: string,
  label: string,
  path: string,
  icon: string,
  permissions: string[] = [],
  all = false,
): NavigationItem => ({ id, label, path, icon, permissions, all });
const home = item('home', 'nav.home', '/home', 'Home');
const offers = (mode: WorkspaceMode) =>
  item('offers', 'nav.offers', `/offers?tab=${mode === 'buy' ? 'sent' : 'received'}`, 'Handshake', [
    'offer.respond',
    'offer.create',
  ]);
const trades = item('contracts', 'nav.my-trades', '/contracts', 'ScrollText', ['contract.read']);
const records = [
  item('holdings', 'nav.holdings', '/holdings', 'PackageCheck', ['holding.read']),
  item('farms', 'nav.sources', '/farms', 'Trees', ['farm.read']),
  item('batches', 'nav.batches', '/batches', 'Boxes', ['batch.read']),
  item('evidence', 'nav.documents', '/evidence', 'FileCheck2', ['evidence.read']),
  item('certs', 'nav.certs', '/certs', 'BadgeCheck', ['certificate.read']),
  item('products', 'nav.traceability', '/products', 'QrCode', ['batch.read']),
];
export function navigation(
  user: Actor | null,
  mode: WorkspaceMode,
): { groups: NavigationGroup[]; utility: NavigationItem[]; create: NavigationItem | null } {
  mode = resolveWorkspace(user, mode);
  const primary =
    mode === 'admin'
      ? [
          home,
          item(
            'access-applications',
            'nav.access-applications',
            '/access-applications',
            'UserCheck',
            ['*'],
          ),
          item(
            'platform-fees',
            'nav.fee-verification',
            '/platform-fees?review=pending',
            'WalletCards',
            ['finance.manage'],
          ),
          item('organizations', 'nav.organizations', '/organizations', 'Building2', [
            'organization.admin',
          ]),
          item('access-controls', 'nav.access-controls', '/access-controls', 'ShieldAlert', ['*']),
          item('access-review', 'nav.access-review', '/access-review', 'ShieldAlert', ['*']),
          item('audit', 'nav.audit', '/audit', 'FileClock', ['audit.read']),
          item('operations', 'nav.operations', '/operations', 'ShieldAlert', ['*']),
          item('dashboard', 'nav.network-overview', '/dashboard', 'LayoutDashboard', ['*']),
        ]
      : [
          home,
          ...(mode === 'buy'
            ? [
                item('marketplace', 'nav.find-supply', '/marketplace', 'Store', ['listing.read']),
                item(
                  'sourcing-requests',
                  'nav.sourcing-requests',
                  '/sourcing-requests',
                  'Search',
                  ['listing.read', 'offer.create'],
                  true,
                ),
              ]
            : []),
          ...(mode === 'sell'
            ? [
                item('my-listings', 'nav.my-supply', '/my-listings', 'ShoppingBag', [
                  'listing.create',
                ]),
              ]
            : []),
          offers(mode),
          trades,
        ];
  const groups: NavigationGroup[] = [
    {
      id: 'workspace',
      label: mode === 'admin' ? 'nav.administration' : `workspace.${mode}`,
      items: primary,
    },
  ];
  if (mode !== 'admin') {
    groups.push({
      id: 'records',
      label: 'nav.records',
      collapsible: true,
      items: records.filter(
        (row) => mode !== 'buy' || ['evidence', 'certs', 'products'].includes(row.id),
      ),
    });
    groups.push({
      id: 'registers',
      label: 'nav.trade-registers',
      collapsible: true,
      items: [
        item('payments', 'nav.goods-payments', '/payments', 'WalletCards', ['payment.read']),
        item('shipments', 'nav.shipments', '/shipments', 'Ship', ['shipment.read']),
        item('platform-fees', 'nav.platform-fees', '/platform-fees', 'WalletCards', [
          'offer.respond',
          'finance.manage',
        ]),
        item('pilot', 'nav.team', '/pilot', 'Building2', ['member.invite', 'member.manage']),
        item('organizations', 'nav.organizations', '/organizations', 'Building2', [
          'organization.admin',
        ]),
        item('audit', 'nav.audit', '/audit', 'FileClock', ['audit.read']),
      ],
    });
  }
  const visible = (row: NavigationItem) =>
    !row.permissions.length ||
    (row.all
      ? row.permissions.every((p) => hasPermission(user, p))
      : row.permissions.some((p) => hasPermission(user, p)));
  const create =
    mode === 'buy'
      ? item('source-new', 'nav.create-request', '/source/new', 'Search', ['offer.create'])
      : mode === 'sell'
        ? item('supply-new', 'nav.supply-new', '/supply/new', 'ShoppingBag', ['listing.create'])
        : null;
  return {
    groups: groups
      .map((group) => ({ ...group, items: group.items.filter(visible) }))
      .filter((group) => group.items.length),
    create: create && visible(create) ? create : null,
    utility: [
      item('notifications', 'nav.notifications', '/notifications', 'Bell'),
      item('recalls', 'nav.recalls', '/recalls', 'ShieldAlert'),
      item('support', 'nav.help', '/support', 'LifeBuoy'),
    ],
  };
}
export function activeNavigation(id: string, currentPage: string): boolean {
  return (
    id === currentPage ||
    id === currentPage + 's' ||
    (id === 'contracts' && ['deal-room', 'contract'].includes(currentPage)) ||
    (id === 'batches' && currentPage === 'batch') ||
    (id === 'marketplace' && currentPage === 'listing') ||
    (id === 'my-listings' && currentPage === 'supply-new') ||
    (id === 'sourcing-requests' && ['source-new', 'source-compare'].includes(currentPage))
  );
}
