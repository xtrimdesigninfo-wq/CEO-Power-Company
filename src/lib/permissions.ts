import {
  AdminProduct,
  PermissionKey,
  Product,
  Profile,
  ResellerScope,
  StaffPermissionsRecord,
  UserRole,
} from '../types';

export const ALL_PERMISSIONS: readonly PermissionKey[] = [
  'dashboard.view',
  'products.view',
  'products.view_prices',
  'products.create',
  'products.edit',
  'products.edit_images',
  'products.edit_price',
  'products.edit_stock',
  'products.toggle_visibility',
  'products.bulk_edit',
  'products.delete',
  'categories.view',
  'categories.create_edit',
  'categories.reorder',
  'categories.toggle_visibility',
  'categories.delete',
  'resellers.view',
  'resellers.create',
  'resellers.edit',
  'resellers.reset_password',
  'resellers.suspend',
  'resellers.delete',
  'orders.view',
  'orders.update_status',
  'orders.export',
  'settings.view',
  'settings.edit',
] as const;

export interface PermissionGroup {
  group: string;
  description: string;
  items: { key: PermissionKey; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'Dashboard',
    description: 'Executive metrics and overview screen',
    items: [
      { key: 'dashboard.view', label: 'View dashboard overview' },
    ],
  },
  {
    group: 'Products',
    description: 'Catalogue visibility, prices, stock, photos & bulk edits',
    items: [
      { key: 'products.view', label: 'View products list' },
      { key: 'products.view_prices', label: 'View wholesale trade prices' },
      { key: 'products.create', label: 'Create new products' },
      { key: 'products.edit', label: 'Edit product details & specs' },
      { key: 'products.edit_images', label: 'Upload & change images' },
      { key: 'products.edit_price', label: 'Edit trade prices' },
      { key: 'products.edit_stock', label: 'Change stock status' },
      { key: 'products.toggle_visibility', label: 'Show / hide products' },
      { key: 'products.bulk_edit', label: 'Use bulk actions bar' },
      { key: 'products.delete', label: 'Delete products' },
    ],
  },
  {
    group: 'Categories',
    description: 'Equipment category taxonomy and display order',
    items: [
      { key: 'categories.view', label: 'View categories' },
      { key: 'categories.create_edit', label: 'Create & edit categories' },
      { key: 'categories.reorder', label: 'Reorder categories' },
      { key: 'categories.toggle_visibility', label: 'Show / hide categories' },
      { key: 'categories.delete', label: 'Delete categories' },
    ],
  },
  {
    group: 'Resellers',
    description: 'Partner accounts, passwords & suspension',
    items: [
      { key: 'resellers.view', label: 'View resellers directory' },
      { key: 'resellers.create', label: 'Create reseller accounts' },
      { key: 'resellers.edit', label: 'Edit reseller profiles' },
      { key: 'resellers.reset_password', label: 'Reset reseller passwords' },
      { key: 'resellers.suspend', label: 'Suspend / reactivate resellers' },
      { key: 'resellers.delete', label: 'Delete reseller accounts' },
    ],
  },
  {
    group: 'Orders',
    description: 'WhatsApp order requests & fulfillment tracking',
    items: [
      { key: 'orders.view', label: 'View order requests' },
      { key: 'orders.update_status', label: 'Update order status' },
      { key: 'orders.export', label: 'Export orders to CSV' },
    ],
  },
  {
    group: 'Settings',
    description: 'WhatsApp dispatch & portal settings',
    items: [
      { key: 'settings.view', label: 'View company settings' },
      { key: 'settings.edit', label: 'Edit company settings' },
    ],
  },
];

export interface StaffPreset {
  name: string;
  description: string;
  permissions: PermissionKey[];
  reseller_scope: ResellerScope;
}

export const STAFF_PRESETS: StaffPreset[] = [
  {
    name: 'Product Manager',
    description: 'Full catalogue & category management without reseller/order admin rights',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.view_prices',
      'products.create',
      'products.edit',
      'products.edit_images',
      'products.edit_price',
      'products.edit_stock',
      'products.toggle_visibility',
      'products.bulk_edit',
      'products.delete',
      'categories.view',
      'categories.create_edit',
      'categories.reorder',
      'categories.toggle_visibility',
    ],
    reseller_scope: 'all',
  },
  {
    name: 'Price Manager',
    description: 'View products & adjust wholesale trade prices only',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.view_prices',
      'products.edit_price',
      'products.bulk_edit',
    ],
    reseller_scope: 'all',
  },
  {
    name: 'Stock Officer',
    description: 'View catalogue (prices hidden) and update stock availability',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.edit_stock',
    ],
    reseller_scope: 'all',
  },
  {
    name: 'Sales / Account Manager',
    description: 'Create & manage assigned resellers and their orders',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.view_prices',
      'resellers.view',
      'resellers.create',
      'resellers.edit',
      'resellers.reset_password',
      'orders.view',
      'orders.update_status',
    ],
    reseller_scope: 'assigned',
  },
  {
    name: 'Order Officer',
    description: 'View, update fulfillment status, and export order requests',
    permissions: [
      'dashboard.view',
      'orders.view',
      'orders.update_status',
      'orders.export',
    ],
    reseller_scope: 'all',
  },
  {
    name: 'Viewer',
    description: 'Read-only access to dashboard, catalogue, categories, resellers, and orders',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.view_prices',
      'categories.view',
      'resellers.view',
      'orders.view',
    ],
    reseller_scope: 'all',
  },
];

export function isValidPermissionKey(key: string): key is PermissionKey {
  return (ALL_PERMISSIONS as readonly string[]).includes(key);
}

export function canPerform(
  profile: Pick<Profile, 'role' | 'status'> | null | undefined,
  staffPerms: Pick<StaffPermissionsRecord, 'permissions'> | null | undefined,
  perm: PermissionKey
): boolean {
  if (!profile || profile.status !== 'active') return false;
  if (profile.role === 'admin') return true;
  if (profile.role !== 'staff') return false;
  return Boolean(staffPerms?.permissions?.includes(perm));
}

export function canAccessCategoryScope(
  profile: Pick<Profile, 'role' | 'status'> | null | undefined,
  staffPerms: Pick<StaffPermissionsRecord, 'category_scope'> | null | undefined,
  categoryId: string | null | undefined
): boolean {
  if (!profile || profile.status !== 'active') return false;
  if (profile.role === 'admin') return true;
  if (profile.role !== 'staff') return false;
  if (!staffPerms?.category_scope || staffPerms.category_scope.length === 0) {
    return true;
  }
  if (!categoryId) return false;
  return staffPerms.category_scope.includes(categoryId);
}

export function canAccessResellerScope(
  actor: Pick<Profile, 'id' | 'role' | 'status'> | null | undefined,
  staffPerms: Pick<StaffPermissionsRecord, 'reseller_scope'> | null | undefined,
  reseller: Pick<Profile, 'id' | 'role' | 'assigned_staff_id'> | null | undefined
): boolean {
  if (!actor || actor.status !== 'active') return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'staff') return false;
  if (!reseller || reseller.role !== 'reseller') return false;
  if (!staffPerms || staffPerms.reseller_scope === 'all') return true;
  return reseller.assigned_staff_id === actor.id;
}

export function redactProductPrice(
  product: Product | AdminProduct,
  canViewPrices: boolean
): AdminProduct {
  return {
    ...product,
    price: canViewPrices ? product.price : null,
  };
}

export function validateProductColumnChanges(
  actor: Pick<Profile, 'role' | 'status'> | null | undefined,
  staffPerms: StaffPermissionsRecord | null | undefined,
  existing: Product,
  updates: Partial<Product>
): void {
  if (!actor || actor.status !== 'active') {
    throw new Error('Unauthorized administrator session.');
  }
  if (actor.role === 'admin') return;
  if (actor.role !== 'staff') {
    throw new Error('Administrator privileges required.');
  }

  if (!canAccessCategoryScope(actor, staffPerms, existing.category_id)) {
    throw new Error('You do not have access to this product category.');
  }
  if (updates.category_id && updates.category_id !== existing.category_id) {
    if (!canAccessCategoryScope(actor, staffPerms, updates.category_id)) {
      throw new Error('You do not have access to the target category.');
    }
  }

  if (
    updates.price !== undefined &&
    updates.price !== existing.price &&
    !canPerform(actor, staffPerms, 'products.edit_price')
  ) {
    throw new Error('You do not have permission to change prices.');
  }

  if (
    ((updates.stock_status !== undefined && updates.stock_status !== existing.stock_status) ||
      (updates.stock_quantity !== undefined && updates.stock_quantity !== existing.stock_quantity)) &&
    !canPerform(actor, staffPerms, 'products.edit_stock')
  ) {
    throw new Error('You do not have permission to change stock levels.');
  }

  if (
    updates.is_active !== undefined &&
    updates.is_active !== existing.is_active &&
    !canPerform(actor, staffPerms, 'products.toggle_visibility')
  ) {
    throw new Error('You do not have permission to change product visibility.');
  }

  if (
    updates.images !== undefined &&
    JSON.stringify(updates.images) !== JSON.stringify(existing.images) &&
    !canPerform(actor, staffPerms, 'products.edit_images')
  ) {
    throw new Error('You do not have permission to change product images.');
  }

  const otherDetailKeys: Array<keyof Product> = [
    'category_id',
    'name',
    'slug',
    'brand',
    'sku',
    'short_description',
    'specs',
    'min_order_qty',
    'is_featured',
  ];

  const modifiedDetails = otherDetailKeys.some((key) => {
    if (updates[key] === undefined) return false;
    return JSON.stringify(updates[key]) !== JSON.stringify(existing[key]);
  });

  if (modifiedDetails && !canPerform(actor, staffPerms, 'products.edit')) {
    throw new Error('You do not have permission to edit product details.');
  }
}

export const ADMIN_NAV_ROUTE_ORDER: Array<{ path: string; perm: PermissionKey; label: string }> = [
  { path: '/admin', perm: 'dashboard.view', label: 'Dashboard' },
  { path: '/admin/products', perm: 'products.view', label: 'Products' },
  { path: '/admin/categories', perm: 'categories.view', label: 'Categories' },
  { path: '/admin/resellers', perm: 'resellers.view', label: 'Resellers' },
  { path: '/admin/orders', perm: 'orders.view', label: 'Order Requests' },
  { path: '/admin/settings', perm: 'settings.view', label: 'Settings' },
];

export function getFirstAllowedAdminRoute(
  role: UserRole | null | undefined,
  permissions: PermissionKey[],
  status: string = 'active'
): string {
  if (status !== 'active') return '/admin/no-access';
  if (role === 'admin') return '/admin';
  if (role !== 'staff') return '/catalog';

  const first = ADMIN_NAV_ROUTE_ORDER.find((r) => permissions.includes(r.perm));
  return first ? first.path : '/admin/no-access';
}

export function getRoleBadgeLabel(
  role: UserRole | null | undefined,
  preset: string | null | undefined
): string {
  if (role === 'admin') return 'Super Admin';
  if (role === 'staff') return preset?.trim() || 'Staff Admin';
  return 'Reseller';
}

export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let body = '';
  for (let i = 0; i < 6; i++) {
    body += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CEO${body}!`;
}
