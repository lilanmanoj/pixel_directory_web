/**
 * Built-in permission keys the API checks. They are seeded into the
 * `permissions` collection as system permissions; admins can add more keys
 * and attach any of them to roles. A role holding `*` has every permission.
 */
export const P = {
  BRANDS_READ: 'brands.read',
  BRANDS_CREATE: 'brands.create',
  BRANDS_UPDATE: 'brands.update',
  BRANDS_STATUS: 'brands.status',
  BRANDS_RESIZE: 'brands.resize',
  BRANDS_ASSIGN: 'brands.assign',
  BRANDS_DELETE: 'brands.delete',
  OWN_BRANDS_READ: 'own-brands.read',
  OWN_BRANDS_UPDATE: 'own-brands.update',
  OWN_BRANDS_METRICS: 'own-brands.metrics',
  METRICS_VIEW: 'metrics.view',
  CARD_SIZES_MANAGE: 'card-sizes.manage',
  METADATA_FIELDS_MANAGE: 'metadata-fields.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_VIEW: 'payments.view',
  UPLOADS_CREATE: 'uploads.create',
} as const;

export const WILDCARD = '*';

export const SYSTEM_PERMISSIONS: { key: string; group: string; description: string }[] = [
  { key: P.BRANDS_READ, group: 'Brands', description: 'List and view every brand in admin' },
  { key: P.BRANDS_CREATE, group: 'Brands', description: 'Create brands / ads' },
  { key: P.BRANDS_UPDATE, group: 'Brands', description: 'Edit any brand' },
  { key: P.BRANDS_STATUS, group: 'Brands', description: 'Activate or deactivate brands' },
  { key: P.BRANDS_RESIZE, group: 'Brands', description: 'Change a brand card size without payment' },
  { key: P.BRANDS_ASSIGN, group: 'Brands', description: 'Allocate brands to users' },
  { key: P.BRANDS_DELETE, group: 'Brands', description: 'Delete brands' },
  { key: P.OWN_BRANDS_READ, group: 'My brands', description: 'View brands allocated to me' },
  { key: P.OWN_BRANDS_UPDATE, group: 'My brands', description: 'Edit content of brands allocated to me' },
  { key: P.OWN_BRANDS_METRICS, group: 'My brands', description: 'View click metrics of my brands' },
  { key: P.METRICS_VIEW, group: 'Metrics', description: 'View click metrics of all brands' },
  { key: P.CARD_SIZES_MANAGE, group: 'Settings', description: 'Manage card sizes and price tiers' },
  { key: P.METADATA_FIELDS_MANAGE, group: 'Settings', description: 'Manage shared metadata fields' },
  { key: P.USERS_MANAGE, group: 'Access', description: 'Manage users and their roles' },
  { key: P.ROLES_MANAGE, group: 'Access', description: 'Manage roles and permissions' },
  { key: P.PAYMENTS_CREATE, group: 'Payments', description: 'Pay to upgrade card sizes' },
  { key: P.PAYMENTS_VIEW, group: 'Payments', description: 'View all payments' },
  { key: P.UPLOADS_CREATE, group: 'Uploads', description: 'Upload images' },
];

export function hasPermission(granted: string[], required: string): boolean {
  return granted.includes(WILDCARD) || granted.includes(required);
}
