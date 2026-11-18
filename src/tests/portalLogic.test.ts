import test from 'node:test';
import assert from 'node:assert/strict';
import { usernameToEmail, emailToUsername, matchesProfileIdentifier, PORTAL_EMAIL_DOMAIN } from '../lib/supabase';
import { safeStorage } from '../lib/storage';
import {
  buildWhatsAppOrderMessage,
  buildProductInquiryMessage,
  buildStaffWelcomeMessage,
  WHATSAPP_SUPPORT_OPTIONS,
  WHATSAPP_QUICK_REPLY_TEMPLATES,
  SUPPORT_STATUS_QUICK_REPLY_TEMPLATE,
  hasPendingCartOrder,
  getQuickReplyTemplates,
  buildSupportInquiryMessage,
  buildWhatsAppDeepLink,
  buildSupportDeepLink,
  toggleQuickReplySelection,
  resolveQuickReplyPhrases,
  filterWhatsAppSupportOptions,
  getNextSupportOptionIndex,
  isWhatsAppShortcutEvent,
  getSupportOptionStaggerClass,
  getFabSpringState,
  normalizeWhatsAppNumber,
  formatWhatsAppDisplay,
  DEFAULT_WHATSAPP_NUMBER,
  DEFAULT_WHATSAPP_THEME,
  normalizeWhatsAppTheme,
  toggleWhatsAppTheme,
} from '../lib/whatsapp';
import {
  getSimilarProducts,
  buildDuplicateProductDraft,
  getProductCardImages,
  getWrappedCarouselIndex,
  getCarouselIndexFromScroll,
  DEFAULT_PRODUCT_IMAGE,
} from '../lib/productUtils';
import { parseCsvRows, parseSpecsCsv, parseProductCsv } from '../lib/csvParser';
import {
  BULK_IMPORT_HEADERS,
  cleanBulkPrice,
  deriveBulkStockStatus,
  executeBulkProductImport,
  findExistingProductMatch,
  generateBulkErrorReportCsv,
  generateBulkProductTemplateCsv,
  generateUniqueSlug,
  parseBulkCsvText,
  parseBulkSpecs,
  parseBulkSpreadsheetBuffer,
  parseYesNoBoolean,
  validateBulkImportRows,
} from '../lib/bulkImport';
import * as XLSX from 'xlsx';
import { formatNaira, slugify } from '../lib/utils';
import {
  ALL_PERMISSIONS,
  STAFF_PRESETS,
  isValidPermissionKey,
  canPerform,
  canAccessCategoryScope,
  canAccessResellerScope,
  redactProductPrice,
  validateProductColumnChanges,
  getFirstAllowedAdminRoute,
  getRoleBadgeLabel,
} from '../lib/permissions';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  normalizeLowStockThreshold,
  deriveStockStatusFromQuantity,
  isProductBelowThreshold,
  isProductOutOfStock,
  buildAlertFingerprint,
  evaluateLowStockAlerts,
} from '../lib/inventory';
import { isCompletedOrder, buildReorderCartPlan } from '../lib/orderUtils';
import { useCartStore } from '../store/cartStore';
import {
  initLocalDatabase,
  shouldSeedLocalDemoData,
  STALE_DEMO_STORAGE_KEYS,
} from '../services/dataService';
import { Profile, OrderItem, Product, AdminProduct, StaffPermissionsRecord, Category, Brand } from '../types';

test('usernameToEmail formats username with portal internal domain', () => {
  assert.equal(usernameToEmail('xtrimdesign'), `xtrimdesign@${PORTAL_EMAIL_DOMAIN}`);
  assert.equal(usernameToEmail('solarplus_onitsha'), `solarplus_onitsha@${PORTAL_EMAIL_DOMAIN}`);
  assert.equal(usernameToEmail('admin@ceopowercompany.org'), 'admin@ceopowercompany.org');
});

test('emailToUsername extracts username from portal email', () => {
  assert.equal(emailToUsername(`xtrimdesign@${PORTAL_EMAIL_DOMAIN}`), 'xtrimdesign');
  assert.equal(emailToUsername('external@gmail.com'), 'external@gmail.com');
});

test('matchesProfileIdentifier matches username, real email, and internal portal email', () => {
  const reseller = { username: 'emeka_solar', email: 'emeka@solarplus.ng' };
  assert.equal(matchesProfileIdentifier(reseller, 'emeka_solar'), true);
  assert.equal(matchesProfileIdentifier(reseller, ' EMEKA_SOLAR '), true);
  assert.equal(matchesProfileIdentifier(reseller, 'emeka@solarplus.ng'), true);
  assert.equal(matchesProfileIdentifier(reseller, 'Emeka@SolarPlus.NG '), true);
  assert.equal(matchesProfileIdentifier(reseller, `emeka_solar@${PORTAL_EMAIL_DOMAIN}`), true);
  assert.equal(matchesProfileIdentifier(reseller, 'other_user'), false);
  assert.equal(matchesProfileIdentifier(reseller, 'other@solarplus.ng'), false);
});

test('formatNaira correctly formats currency with NGN symbol and no decimals', () => {
  const result = formatNaira(155000);
  assert.ok(result.includes('155,000'));
  assert.ok(result.includes('₦') || result.includes('NGN'));
});

test('slugify transforms product names into clean URL slugs', () => {
  assert.equal(slugify('ZN Shine 600W Solar Panel'), 'zn-shine-600w-solar-panel');
  assert.equal(slugify('Felicity 3kVA Hybrid Inverter 24V!'), 'felicity-3kva-hybrid-inverter-24v');
});

test('buildWhatsAppOrderMessage produces the exact required specification format', () => {
  const mockReseller: Profile = {
    id: 'user-1',
    role: 'reseller',
    username: 'solarplus_onitsha',
    full_name: 'Emeka Okafor',
    business_name: 'SolarPlus Systems Nig. Ltd',
    phone: '08031234567',
    state: 'Anambra',
    city: 'Onitsha',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const mockItems: OrderItem[] = [
    {
      product_id: 'prod-1',
      name: 'ZN Shine 600W Solar Panel',
      qty: 10,
      unit_price: 155000,
      line_total: 1550000,
    },
    {
      product_id: 'prod-2',
      name: 'Deye 5kVA Hybrid Inverter 48V',
      qty: 2,
      unit_price: 1250000,
      line_total: 2500000,
    },
  ];

  const message = buildWhatsAppOrderMessage({
    ref: 'CEO-2611-0001',
    reseller: mockReseller,
    items: mockItems,
    total: 4050000,
    note: 'Urgent installation site delivery',
  });

  assert.ok(message.includes('NEW RESELLER ORDER - CEO-2611-0001'));
  assert.ok(message.includes('Reseller: Emeka Okafor (SolarPlus Systems Nig. Ltd)'));
  assert.ok(message.includes('Phone: 08031234567 | Onitsha, Anambra'));
  assert.ok(message.includes('1. ZN Shine 600W Solar Panel'));
  assert.ok(message.includes('Qty: 10 x'));
  assert.ok(message.includes('2. Deye 5kVA Hybrid Inverter 48V'));
  assert.ok(message.includes('Qty: 2 x'));
  assert.ok(message.includes('TOTAL:'));
  assert.ok(message.includes('Note: Urgent installation site delivery'));
  assert.ok(message.includes('Sent from CEO Power Reseller Portal'));
});

test('buildProductInquiryMessage generates proper inquiry text', () => {
  const inquiry = buildProductInquiryMessage('LONGi 635W Solar Panel', 'LR5-72HGD-635M');
  assert.ok(inquiry.includes('LONGi 635W Solar Panel'));
  assert.ok(inquiry.includes('LR5-72HGD-635M'));
});

test('buildStaffWelcomeMessage generates staff onboarding instructions', () => {
  const msg = buildStaffWelcomeMessage('Chinedu Eze', 'chinedu_stock', 'CEOpwd99!', 'Stock Officer');
  assert.ok(msg.includes('Chinedu Eze'));
  assert.ok(msg.includes('Stock Officer'));
  assert.ok(msg.includes('chinedu_stock'));
  assert.ok(msg.includes('CEOpwd99!'));
  assert.ok(msg.includes('/admin/login'));
});

test('ALL_PERMISSIONS contains exact 27 keys and all presets reference valid keys', () => {
  assert.equal(ALL_PERMISSIONS.length, 27);
  assert.equal(STAFF_PRESETS.length, 6);
  for (const preset of STAFF_PRESETS) {
    for (const perm of preset.permissions) {
      assert.equal(isValidPermissionKey(perm), true, `Invalid key ${perm} in ${preset.name}`);
    }
  }
  const salesPreset = STAFF_PRESETS.find(p => p.name === 'Sales / Account Manager');
  assert.equal(salesPreset?.reseller_scope, 'assigned');
});

test('canPerform enforces role, active status, and staff permission checklist', () => {
  const superAdmin = { role: 'admin' as const, status: 'active' as const };
  const activeStaff = { role: 'staff' as const, status: 'active' as const };
  const suspendedStaff = { role: 'staff' as const, status: 'suspended' as const };
  const reseller = { role: 'reseller' as const, status: 'active' as const };
  const stockPerms = { permissions: ['dashboard.view', 'products.view', 'products.edit_stock'] as any };

  assert.equal(canPerform(superAdmin, null, 'settings.edit'), true);
  assert.equal(canPerform(activeStaff, stockPerms, 'products.edit_stock'), true);
  assert.equal(canPerform(activeStaff, stockPerms, 'products.edit_price'), false);
  assert.equal(canPerform(suspendedStaff, stockPerms, 'products.edit_stock'), false);
  assert.equal(canPerform(reseller, stockPerms, 'dashboard.view'), false);
});

test('canAccessCategoryScope and canAccessResellerScope isolate tenant subsets', () => {
  const staffProfile = { id: 'staff-1', role: 'staff' as const, status: 'active' as const };
  const scopedPerms = {
    category_scope: ['cat-solar', 'cat-inv'],
    reseller_scope: 'assigned' as const,
  };

  assert.equal(canAccessCategoryScope(staffProfile, scopedPerms, 'cat-solar'), true);
  assert.equal(canAccessCategoryScope(staffProfile, scopedPerms, 'cat-other'), false);
  assert.equal(canAccessCategoryScope(staffProfile, { category_scope: null }, 'cat-other'), true);

  assert.equal(
    canAccessResellerScope(staffProfile, scopedPerms, {
      id: 'res-1',
      role: 'reseller',
      assigned_staff_id: 'staff-1',
    }),
    true
  );
  assert.equal(
    canAccessResellerScope(staffProfile, scopedPerms, {
      id: 'res-2',
      role: 'reseller',
      assigned_staff_id: 'staff-2',
    }),
    false
  );
  assert.equal(
    canAccessResellerScope(staffProfile, { reseller_scope: 'all' }, {
      id: 'res-2',
      role: 'reseller',
      assigned_staff_id: null,
    }),
    true
  );
});

test('redactProductPrice hides price as null unless products.view_prices is granted', () => {
  const sampleProduct: Product = {
    id: 'p1',
    category_id: 'c1',
    name: '600W Panel',
    slug: '600w-panel',
    specs: {},
    price: 155000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: [],
    is_active: true,
    is_featured: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert.equal(redactProductPrice(sampleProduct, false).price, null);
  assert.equal(redactProductPrice(sampleProduct, true).price, 155000);
});

test('validateProductColumnChanges rejects unauthorized price/stock/detail edits cleanly', () => {
  const stockOfficer = { role: 'staff' as const, status: 'active' as const };
  const stockPerms: StaffPermissionsRecord = {
    user_id: 'staff-1',
    permissions: ['dashboard.view', 'products.view', 'products.edit_stock'],
    category_scope: ['cat-1'],
    reseller_scope: 'all',
    preset: 'Stock Officer',
  };
  const existing: Product = {
    id: 'p1',
    category_id: 'cat-1',
    name: '600W Panel',
    slug: '600w-panel',
    specs: {},
    price: 155000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: [],
    is_active: true,
    is_featured: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Allowed stock change
  assert.doesNotThrow(() =>
    validateProductColumnChanges(stockOfficer, stockPerms, existing, { stock_status: 'low_stock' })
  );

  // Forbidden price change
  assert.throws(
    () => validateProductColumnChanges(stockOfficer, stockPerms, existing, { price: 140000 }),
    /You do not have permission to change prices/
  );

  // Forbidden visibility toggle
  assert.throws(
    () => validateProductColumnChanges(stockOfficer, stockPerms, existing, { is_active: false }),
    /You do not have permission to change product visibility/
  );

  // Forbidden out-of-scope category product
  assert.throws(
    () =>
      validateProductColumnChanges(
        stockOfficer,
        stockPerms,
        { ...existing, category_id: 'cat-2' },
        { stock_status: 'low_stock' }
      ),
    /do not have access to this product category/
  );
});

test('getFirstAllowedAdminRoute and getRoleBadgeLabel resolve home landing and badges', () => {
  assert.equal(getFirstAllowedAdminRoute('admin', []), '/admin');
  assert.equal(getFirstAllowedAdminRoute('staff', ['orders.view']), '/admin/orders');
  assert.equal(getFirstAllowedAdminRoute('staff', ['products.view', 'orders.view']), '/admin/products');
  assert.equal(getFirstAllowedAdminRoute('staff', []), '/admin/no-access');

  assert.equal(getRoleBadgeLabel('admin', null), 'Super Admin');
  assert.equal(getRoleBadgeLabel('staff', 'Stock Officer'), 'Stock Officer');
  assert.equal(getRoleBadgeLabel('staff', null), 'Staff Admin');
});

test('getSimilarProducts selects top 4 active similar items excluding current and inactive products', () => {
  const baseDate = new Date().toISOString();
  const makeProd = (overrides: Partial<Product>): Product => ({
    id: 'p-default',
    category_id: 'cat-panels',
    name: 'Default Panel',
    slug: 'default-panel',
    brand: 'LONGi',
    sku: 'SKU-1',
    short_description: 'Tier 1 solar module',
    specs: { Wattage: '600W', 'Cell Type': 'Monocrystalline' },
    price: 160000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: [],
    is_active: true,
    is_featured: false,
    created_at: baseDate,
    updated_at: baseDate,
    ...overrides,
  });

  const current = makeProd({ id: 'current', name: 'LONGi 600W Solar Panel', brand: 'LONGi', price: 160000 });
  const sameBrandCat = makeProd({ id: 'p-same-brand', name: 'LONGi 620W Solar Panel', brand: 'LONGi', price: 170000 });
  const sameCatInStock = makeProd({ id: 'p-same-cat', name: 'ZN Shine 600W Solar Panel', brand: 'ZN Shine', price: 155000 });
  const sameCatLowStock = makeProd({ id: 'p-low-stock', name: 'Jinko 580W Solar Panel', brand: 'Jinko', price: 145000, stock_status: 'low_stock' });
  const sameCatOutStock = makeProd({ id: 'p-out-stock', name: 'Tongwei 610W Solar Panel', brand: 'Tongwei', price: 162000, stock_status: 'out_of_stock' });
  const inactiveSameCat = makeProd({ id: 'p-inactive', name: 'Hidden Panel', is_active: false });
  const otherCategory = makeProd({ id: 'p-inverter', category_id: 'cat-inverters', name: 'Deye 5kVA Inverter', brand: 'Deye', price: 1250000, specs: { 'Rated Power': '5000W' } });

  const results = getSimilarProducts(
    current,
    [current, otherCategory, inactiveSameCat, sameCatOutStock, sameCatLowStock, sameCatInStock, sameBrandCat],
    4
  );

  assert.equal(results.length, 4);
  assert.equal(results.some(p => p.id === 'current'), false);
  assert.equal(results.some(p => p.id === 'p-inactive'), false);
  assert.equal(results[0].id, 'p-same-brand');
  assert.equal(results[1].id, 'p-same-cat');
  assert.equal(results[2].id, 'p-low-stock');
});

test('buildDuplicateProductDraft creates collision-safe slug, SKU, copied specs/images, and handles hidden price', () => {
  const source: AdminProduct = {
    id: 'prod-1',
    category_id: 'cat-1',
    name: 'Deye 5kVA Hybrid Inverter 48V',
    slug: 'deye-5kva-hybrid-inverter-48v',
    brand: 'Deye',
    sku: 'SUN-5K',
    short_description: 'Pure sine wave hybrid inverter',
    specs: { 'Rated Power': '5000W', 'Battery Voltage': '48V DC' },
    price: null,
    min_order_qty: 2,
    stock_status: 'in_stock',
    images: ['https://example.com/1.jpg'],
    is_active: true,
    is_featured: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const draft = buildDuplicateProductDraft(source, [
    { slug: 'deye-5kva-hybrid-inverter-48v-copy', sku: 'SUN-5K-COPY' },
  ]);

  assert.equal(draft.name, 'Deye 5kVA Hybrid Inverter 48V (Copy)');
  assert.equal(draft.slug, 'deye-5kva-hybrid-inverter-48v-copy-2');
  assert.equal(draft.sku, 'SUN-5K-COPY-2');
  assert.equal(draft.price, 0);
  assert.equal(draft.is_featured, false);
  assert.deepEqual(draft.images, ['https://example.com/1.jpg']);
  assert.deepEqual(draft.specs, { 'Rated Power': '5000W', 'Battery Voltage': '48V DC' });
});

test('normalizeWhatsAppNumber and formatWhatsAppDisplay handle international, Nigerian 0-prefixed, and spaced numbers', () => {
  assert.equal(normalizeWhatsAppNumber('+234 706 644 9882'), '2347066449882');
  assert.equal(normalizeWhatsAppNumber('0803 123 4567'), '2348031234567');
  assert.equal(normalizeWhatsAppNumber(''), DEFAULT_WHATSAPP_NUMBER);
  assert.equal(formatWhatsAppDisplay('2347066449882'), '+234 706 644 9882');
  assert.equal(formatWhatsAppDisplay('08031234567'), '+234 803 123 4567');
});

test('parseCsvRows and parseSpecsCsv parse quoted commas, headers, and specs cleanly', () => {
  const rows = parseCsvRows('\uFEFF"Specification","Value"\r\n"Dimensions","2465 x 1134, 35 mm"\r\n"Warranty","12 ""Product"" / 25 Power"');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], '2465 x 1134, 35 mm');
  assert.equal(rows[2][1], '12 "Product" / 25 Power');

  const specs = parseSpecsCsv('Specification,Value\nWattage,600W\nCell Type,Mono PERC\nVoc,49.8V');
  assert.deepEqual(specs, {
    Wattage: '600W',
    'Cell Type': 'Mono PERC',
    Voc: '49.8V',
  });
});

test('parseProductCsv handles horizontal table rows, category/brand resolution, Naira prices, image cap, and extra spec columns', () => {
  const mockCats: Category[] = [
    { id: 'cat-panels', name: 'Solar Panels', slug: 'solar-panels', sort_order: 1, is_active: true },
    { id: 'cat-inv', name: 'Inverters', slug: 'inverters', sort_order: 2, is_active: true },
  ];
  const mockBrands: Brand[] = [
    { id: 'b-1', category_id: 'cat-panels', name: 'ZN Shine', slug: 'zn-shine', sort_order: 1 },
    { id: 'b-2', category_id: 'cat-inv', name: 'Deye', slug: 'deye', sort_order: 1 },
  ];

  const horizontalCsv = [
    'name,category,brand,sku,price,min_order_qty,stock_status,featured_image,other_images,Wattage,Efficiency',
    '"ZN Shine 600W Panel","Solar Panels","zn shine","ZNS-600","₦155,000",2,"Low Stock","https://img/main.jpg","https://img/1.jpg|https://img/2.jpg|https://img/3.jpg|https://img/4.jpg","600W","21.6%"',
  ].join('\n');

  const parsed = parseProductCsv(horizontalCsv, mockCats, mockBrands);
  assert.equal(parsed.name, 'ZN Shine 600W Panel');
  assert.equal(parsed.slug, 'zn-shine-600w-panel');
  assert.equal(parsed.category_id, 'cat-panels');
  assert.equal(parsed.brand, 'ZN Shine');
  assert.equal(parsed.sku, 'ZNS-600');
  assert.equal(parsed.price, 155000);
  assert.equal(parsed.min_order_qty, 2);
  assert.equal(parsed.stock_status, 'low_stock');
  assert.equal(parsed.featured_image, 'https://img/main.jpg');
  assert.deepEqual(parsed.other_images, ['https://img/1.jpg', 'https://img/2.jpg', 'https://img/3.jpg']);
  assert.deepEqual(parsed.specs, { Wattage: '600W', Efficiency: '21.6%' });

  const verticalCsv = [
    'Field,Value',
    'name,Deye 8kVA Hybrid Inverter',
    'category,inverters',
    'brand,Deye',
    'price,2100000',
    'Rated Power,8000W',
    'Battery Voltage,48V DC',
  ].join('\n');

  const parsedVertical = parseProductCsv(verticalCsv, mockCats, mockBrands);
  assert.equal(parsedVertical.category_id, 'cat-inv');
  assert.equal(parsedVertical.brand, 'Deye');
  assert.equal(parsedVertical.price, 2100000);
  assert.deepEqual(parsedVertical.specs, { 'Rated Power': '8000W', 'Battery Voltage': '48V DC' });
});

test('low-stock threshold helpers normalize values, derive statuses, and prioritize alerts', () => {
  assert.equal(normalizeLowStockThreshold('15'), 15);
  assert.equal(normalizeLowStockThreshold('0'), DEFAULT_LOW_STOCK_THRESHOLD);
  assert.equal(normalizeLowStockThreshold('-5', 12), 12);
  assert.equal(normalizeLowStockThreshold(undefined, 8), 8);

  assert.equal(deriveStockStatusFromQuantity(0, 10), 'out_of_stock');
  assert.equal(deriveStockStatusFromQuantity(9, 10), 'low_stock');
  assert.equal(deriveStockStatusFromQuantity(10, 10), 'in_stock');
  assert.equal(deriveStockStatusFromQuantity(12, 15), 'low_stock');

  const items = [
    { id: 'p-healthy', name: 'Healthy Inverter', stock_quantity: 20, stock_status: 'in_stock' as const },
    { id: 'p-low-7', name: 'Panel 580W', stock_quantity: 7, stock_status: 'low_stock' as const },
    { id: 'p-low-2', name: 'Lithium Battery', stock_quantity: 2, stock_status: 'low_stock' as const },
    { id: 'p-out', name: 'MPPT Controller', stock_quantity: 0, stock_status: 'out_of_stock' as const },
  ];

  assert.equal(isProductBelowThreshold(items[0], 10), false);
  assert.equal(isProductBelowThreshold(items[0], 25), true);
  assert.equal(isProductOutOfStock(items[3]), true);

  const summary = evaluateLowStockAlerts(items, 10);
  assert.equal(summary.totalAlertCount, 3);
  assert.equal(summary.outOfStockCount, 1);
  assert.equal(summary.lowStockCount, 2);
  assert.deepEqual(
    summary.alerts.map(a => a.id),
    ['p-out', 'p-low-2', 'p-low-7']
  );

  const fpLow = buildAlertFingerprint(items[1], 10);
  const fpDropped = buildAlertFingerprint({ ...items[1], stock_quantity: 5 }, 10);
  const fpRaisedThreshold = buildAlertFingerprint(items[1], 15);
  assert.notEqual(fpLow, fpDropped);
  assert.notEqual(fpLow, fpRaisedThreshold);
});

test('validateProductColumnChanges allows stock_quantity under products.edit_stock and CSV parses stock_quantity', () => {
  const stockOfficer = { role: 'staff' as const, status: 'active' as const };
  const stockPerms: StaffPermissionsRecord = {
    user_id: 'staff-1',
    permissions: ['dashboard.view', 'products.view', 'products.edit_stock'],
    category_scope: ['cat-1'],
    reseller_scope: 'all',
    preset: 'Stock Officer',
  };
  const existing: Product = {
    id: 'p1',
    category_id: 'cat-1',
    name: '600W Panel',
    slug: '600w-panel',
    specs: {},
    price: 155000,
    min_order_qty: 1,
    stock_quantity: 25,
    stock_status: 'in_stock',
    images: [],
    is_active: true,
    is_featured: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert.doesNotThrow(() =>
    validateProductColumnChanges(stockOfficer, stockPerms, existing, {
      stock_quantity: 4,
      stock_status: 'low_stock',
    })
  );

  const noStockOfficerPerms: StaffPermissionsRecord = {
    user_id: 'staff-2',
    permissions: ['dashboard.view', 'products.view', 'products.edit'],
    category_scope: ['cat-1'],
    reseller_scope: 'all',
    preset: 'Catalogue Editor',
  };
  assert.throws(
    () =>
      validateProductColumnChanges(stockOfficer, noStockOfficerPerms, existing, {
        stock_quantity: 4,
      }),
    /You do not have permission to change stock/
  );

  const mockCats: Category[] = [
    { id: 'cat-panels', name: 'Solar Panels', slug: 'solar-panels', sort_order: 1, is_active: true },
  ];
  const parsed = parseProductCsv(
    'name,category,price,stock_quantity\n"Panel 600W","Solar Panels",155000,6',
    mockCats,
    []
  );
  assert.equal(parsed.stock_quantity, 6);
});

test('WHATSAPP_SUPPORT_OPTIONS and buildSupportInquiryMessage cover Technical Support, Sales Inquiry, and Billing Help', () => {
  assert.deepEqual(
    WHATSAPP_SUPPORT_OPTIONS.map(o => o.label),
    ['Technical Support', 'Sales Inquiry', 'Billing Help']
  );

  const techMsg = buildSupportInquiryMessage('technical_support', 'SolarPlus Ltd');
  assert.ok(techMsg.includes('Technical Support'));
  assert.ok(techMsg.includes('from SolarPlus Ltd'));

  const salesMsg = buildSupportInquiryMessage('sales_inquiry', null);
  assert.ok(salesMsg.includes('Sales Inquiry'));
  assert.equal(salesMsg.includes('from '), false);

  const billingMsg = buildSupportInquiryMessage('billing_help', '  SunGrid Partners  ');
  assert.ok(billingMsg.includes('Billing Help'));
  assert.ok(billingMsg.includes('from SunGrid Partners'));
});

test('filterWhatsAppSupportOptions filters by label, description, department, and multi-token queries', () => {
  assert.equal(filterWhatsAppSupportOptions('').length, 3);
  assert.equal(filterWhatsAppSupportOptions('   ').length, 3);

  assert.deepEqual(
    filterWhatsAppSupportOptions('billing').map((o) => o.id),
    ['billing_help']
  );

  assert.deepEqual(
    filterWhatsAppSupportOptions('WARRANTY').map((o) => o.id),
    ['technical_support']
  );

  assert.deepEqual(
    filterWhatsAppSupportOptions('moq stock').map((o) => o.id),
    ['sales_inquiry']
  );

  assert.deepEqual(
    filterWhatsAppSupportOptions('accounts desk').map((o) => o.id),
    ['billing_help']
  );

  assert.equal(filterWhatsAppSupportOptions('unmatched topic xyz').length, 0);
});

test('getNextSupportOptionIndex handles ArrowDown, ArrowUp, wrapping, Home, End, and empty lists', () => {
  assert.equal(getNextSupportOptionIndex(-1, 'ArrowDown', 0), -1);
  assert.equal(getNextSupportOptionIndex(-1, 'ArrowDown', 3), 0);
  assert.equal(getNextSupportOptionIndex(0, 'ArrowDown', 3), 1);
  assert.equal(getNextSupportOptionIndex(2, 'ArrowDown', 3), 0);

  assert.equal(getNextSupportOptionIndex(-1, 'ArrowUp', 3), 2);
  assert.equal(getNextSupportOptionIndex(0, 'ArrowUp', 3), 2);
  assert.equal(getNextSupportOptionIndex(2, 'ArrowUp', 3), 1);

  assert.equal(getNextSupportOptionIndex(1, 'Home', 3), 0);
  assert.equal(getNextSupportOptionIndex(0, 'End', 3), 2);
});

test('isWhatsAppShortcutEvent matches Shift+/ outside editable fields and ignores inputs/modifiers', () => {
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, targetTagName: 'BODY' }), true);
  assert.equal(isWhatsAppShortcutEvent({ key: '/', code: 'Slash', shiftKey: true, targetTagName: 'BUTTON' }), true);
  assert.equal(isWhatsAppShortcutEvent({ key: '/', code: 'Slash', shiftKey: false, targetTagName: 'BODY' }), false);
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, ctrlKey: true, targetTagName: 'BODY' }), false);
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, metaKey: true, targetTagName: 'BODY' }), false);
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, altKey: true, targetTagName: 'BODY' }), false);
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, targetTagName: 'INPUT' }), false);
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, targetTagName: 'TEXTAREA' }), false);
  assert.equal(isWhatsAppShortcutEvent({ key: '?', code: 'Slash', shiftKey: true, targetTagName: 'DIV', isContentEditable: true }), false);
});

test('buildWhatsAppDeepLink and buildSupportDeepLink produce encoded department deep-link URLs', () => {
  const genericUrl = buildWhatsAppDeepLink('0803 123 4567', 'Hello CEO Power');
  assert.equal(genericUrl, 'https://wa.me/2348031234567?text=Hello%20CEO%20Power');

  const techUrl = buildSupportDeepLink('+234 706 644 9882', 'technical_support', 'SolarPlus Ltd');
  assert.ok(techUrl.startsWith('https://wa.me/2347066449882?text='));
  const parsedTech = new URL(techUrl);
  assert.ok(parsedTech.searchParams.get('text')?.includes('Technical Support'));
  assert.ok(parsedTech.searchParams.get('text')?.includes('from SolarPlus Ltd'));

  const salesUrl = buildSupportDeepLink('07066449882', 'sales_inquiry', null);
  const parsedSales = new URL(salesUrl);
  assert.ok(parsedSales.searchParams.get('text')?.includes('Wholesale Sales Desk'));
  assert.ok(parsedSales.searchParams.get('text')?.includes('Sales Inquiry'));

  const billingUrl = buildSupportDeepLink('2347066449882', 'billing_help');
  const parsedBilling = new URL(billingUrl);
  assert.ok(parsedBilling.searchParams.get('text')?.includes('Accounts & Billing Desk'));
  assert.ok(parsedBilling.searchParams.get('text')?.includes('Billing Help'));
});

test('Quick Reply templates toggle, resolve phrases, and append cleanly to support messages and deep links', () => {
  assert.ok(WHATSAPP_QUICK_REPLY_TEMPLATES.length >= 4);

  let selected: string[] = [];
  selected = toggleQuickReplySelection(selected, 'bulk_quote');
  selected = toggleQuickReplySelection(selected, 'urgent_dispatch');
  assert.deepEqual(selected, ['bulk_quote', 'urgent_dispatch']);

  const phrases = resolveQuickReplyPhrases(selected);
  assert.equal(phrases.length, 2);
  assert.ok(phrases[0].includes('urgent'));
  assert.ok(phrases[1].includes('bulk pricing'));

  selected = toggleQuickReplySelection(selected, 'urgent_dispatch');
  assert.deepEqual(selected, ['bulk_quote']);

  const msg = buildSupportInquiryMessage('sales_inquiry', 'SunGrid Ltd', [
    'Please treat as urgent — we need same-day Onitsha dispatch.',
    '  Kindly share current bulk pricing and MOQ discount tiers.  ',
    'Please treat as urgent — we need same-day Onitsha dispatch.',
  ]);
  assert.ok(msg.includes('Sales Inquiry'));
  assert.ok(msg.includes('from SunGrid Ltd'));
  assert.ok(msg.includes('Please treat as urgent — we need same-day Onitsha dispatch.'));
  assert.ok(msg.includes('Kindly share current bulk pricing and MOQ discount tiers.'));

  const deepLink = buildSupportDeepLink('07066449882', 'technical_support', null, [
    'Please send the product datasheet and warranty terms.',
  ]);
  const parsed = new URL(deepLink);
  assert.ok(parsed.searchParams.get('text')?.includes('Technical Support'));
  assert.ok(parsed.searchParams.get('text')?.includes('product datasheet and warranty terms'));
});

test('getSupportOptionStaggerClass and getFabSpringState compute deterministic CSS animation helpers', () => {
  assert.equal(getSupportOptionStaggerClass(-1), 'wa-option-delay-0');
  assert.equal(getSupportOptionStaggerClass(0), 'wa-option-delay-0');
  assert.equal(getSupportOptionStaggerClass(1), 'wa-option-delay-1');
  assert.equal(getSupportOptionStaggerClass(2), 'wa-option-delay-2');
  assert.equal(getSupportOptionStaggerClass(5), 'wa-option-delay-3');

  assert.equal(getFabSpringState(false, false), 'idle');
  assert.equal(getFabSpringState(true, false), 'idle');
  assert.equal(getFabSpringState(true, true), 'opening');
  assert.equal(getFabSpringState(false, true), 'closing');
});

test('ProductCard carousel helpers normalize images, wrap slide indices, and map scroll offsets', () => {
  assert.deepEqual(getProductCardImages([]), [DEFAULT_PRODUCT_IMAGE]);
  assert.deepEqual(getProductCardImages(undefined), [DEFAULT_PRODUCT_IMAGE]);

  const normalized = getProductCardImages([
    ' https://img/featured.jpg ',
    '',
    'https://img/other-1.jpg',
    'https://img/featured.jpg',
    'https://img/other-2.jpg',
    'https://img/other-3.jpg',
    'https://img/other-4.jpg',
  ]);
  assert.deepEqual(normalized, [
    'https://img/featured.jpg',
    'https://img/other-1.jpg',
    'https://img/other-2.jpg',
    'https://img/other-3.jpg',
  ]);

  assert.equal(getWrappedCarouselIndex(0, -1, 4), 3);
  assert.equal(getWrappedCarouselIndex(3, 1, 4), 0);
  assert.equal(getWrappedCarouselIndex(1, 1, 4), 2);
  assert.equal(getWrappedCarouselIndex(0, 1, 0), 0);

  assert.equal(getCarouselIndexFromScroll(0, 300, 4), 0);
  assert.equal(getCarouselIndexFromScroll(295, 300, 4), 1);
  assert.equal(getCarouselIndexFromScroll(910, 300, 4), 3);
  assert.equal(getCarouselIndexFromScroll(1500, 300, 4), 3);
});

test('hasPendingCartOrder and getQuickReplyTemplates prepend Support Status check first when cart has items', () => {
  assert.equal(hasPendingCartOrder([]), false);
  assert.equal(hasPendingCartOrder(null), false);
  assert.equal(hasPendingCartOrder([{ quantity: 0 }]), false);
  assert.equal(hasPendingCartOrder([{ quantity: 2 }]), true);

  const emptyCartTemplates = getQuickReplyTemplates(false);
  assert.equal(emptyCartTemplates.length, WHATSAPP_QUICK_REPLY_TEMPLATES.length);
  assert.equal(emptyCartTemplates[0].id, 'urgent_dispatch');
  assert.equal(emptyCartTemplates.some((t) => t.id === 'support_status'), false);

  const pendingCartTemplates = getQuickReplyTemplates(true);
  assert.equal(pendingCartTemplates.length, WHATSAPP_QUICK_REPLY_TEMPLATES.length + 1);
  assert.equal(pendingCartTemplates[0].id, SUPPORT_STATUS_QUICK_REPLY_TEMPLATE.id);
  assert.equal(pendingCartTemplates[0].label, 'Check order status');
  assert.equal(pendingCartTemplates[0].isSuggested, true);

  const phrases = resolveQuickReplyPhrases(['support_status', 'urgent_dispatch'], pendingCartTemplates);
  assert.equal(phrases.length, 2);
  assert.ok(phrases[0].includes('pending order status'));
  assert.ok(phrases[1].includes('urgent'));
});

test('Bulk import CSV & XLSX parsing handles BOM, quoted commas, multi-line descriptions, and spaced headers', async () => {
  const bomCsv = [
    '\uFEFFCategory,Brand,Product Name,SKU,Slug,Short Description,"Trade Price",MOQ,"Stock Quantity",Stock Status,Active,Featured,"Featured Image URL",Other Image URLs,Specs',
    '"Solar Panels","ZN Shine","600W Bifacial, Tier-1","ZNS-600-BF","","Line 1 feature,\nLine 2 warranty note","₦ 155,000",2,4,"",yes,no,"https://example.com/a.jpg","https://example.com/b.jpg|https://example.com/c.jpg","Wattage: 600W | Cell Type: Mono | Warranty: 25 Years"',
  ].join('\n');

  const rows = parseBulkCsvText(bomCsv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowNumber, 2);
  assert.equal(rows[0].rawValues.category, 'Solar Panels');
  assert.equal(rows[0].rawValues.name, '600W Bifacial, Tier-1');
  assert.equal(rows[0].rawValues.short_description, 'Line 1 feature,\nLine 2 warranty note');
  assert.equal(rows[0].rawValues.trade_price, '₦ 155,000');
  assert.equal(rows[0].rawValues.stock_quantity, '4');

  // Verify template has exact 15 headers and 2 example rows
  const template = generateBulkProductTemplateCsv();
  const templateTable = parseCsvRows(template);
  assert.deepEqual(templateTable[0], [...BULK_IMPORT_HEADERS]);
  assert.equal(templateTable.length, 3);

  // Verify XLSX workbook parsing
  const ws = XLSX.utils.aoa_to_sheet(templateTable);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const xlsxRows = await parseBulkSpreadsheetBuffer(buf);
  assert.equal(xlsxRows.length, 2);
  assert.equal(xlsxRows[0].rawValues.category, 'Solar Panels');
  assert.equal(xlsxRows[1].rawValues.category, 'Inverters');
});

test('Bulk import price cleaning, yes/no parsing, specs parsing, stock derivation, and unique slug generation', () => {
  assert.deepEqual(cleanBulkPrice('₦155,000'), { value: 155000, valid: true });
  assert.deepEqual(cleanBulkPrice(' NGN 1,250,000 '), { value: 1250000, valid: true });
  assert.deepEqual(cleanBulkPrice('45 500'), { value: 45500, valid: true });
  assert.equal(cleanBulkPrice('not-a-price').valid, false);
  assert.equal(cleanBulkPrice('not-a-price').reason, 'trade_price is not a number');
  assert.equal(cleanBulkPrice('-50').valid, false);
  assert.equal(cleanBulkPrice('').reason, 'missing trade_price');

  assert.deepEqual(parseYesNoBoolean('yes', false), { value: true, valid: true });
  assert.deepEqual(parseYesNoBoolean('TRUE', false), { value: true, valid: true });
  assert.deepEqual(parseYesNoBoolean('1', false), { value: true, valid: true });
  assert.deepEqual(parseYesNoBoolean('no', true), { value: false, valid: true });
  assert.deepEqual(parseYesNoBoolean('False', true), { value: false, valid: true });
  assert.deepEqual(parseYesNoBoolean('0', true), { value: false, valid: true });
  assert.deepEqual(parseYesNoBoolean('', true), { value: true, valid: true });
  assert.deepEqual(parseYesNoBoolean('', false), { value: false, valid: true });
  assert.equal(parseYesNoBoolean('maybe', true).valid, false);

  assert.deepEqual(
    parseBulkSpecs('Wattage: 600W | Cell Type: Mono | Warranty: 25 Years | Ratio: 1:1'),
    {
      Wattage: '600W',
      'Cell Type': 'Mono',
      Warranty: '25 Years',
      Ratio: '1:1',
    }
  );
  assert.deepEqual(parseBulkSpecs(''), {});

  // Low-stock rule: below 5 units
  assert.equal(deriveBulkStockStatus(0), 'out_of_stock');
  assert.equal(deriveBulkStockStatus(4), 'low_stock');
  assert.equal(deriveBulkStockStatus(5), 'in_stock');

  const used = ['deye-5kva-inverter', 'deye-5kva-inverter-2'];
  assert.equal(generateUniqueSlug('Deye 5kVA Inverter', used), 'deye-5kva-inverter-3');
  assert.equal(generateUniqueSlug('Longi 600W Panel!', used), 'longi-600w-panel');
});

test('Bulk import duplicate matching (SKU first then slug), validation, auto-create brand option, and image failure warning', async () => {
  const categories: Category[] = [
    { id: 'cat-panels', name: 'Solar Panels', slug: 'solar-panels', sort_order: 1, is_active: true },
    { id: 'cat-inv', name: 'Inverters', slug: 'inverters', sort_order: 2, is_active: true },
  ];
  const brands: Brand[] = [
    { id: 'b-1', category_id: 'cat-panels', name: 'ZN Shine', slug: 'zn-shine', sort_order: 1 },
    { id: 'b-2', category_id: 'cat-inv', name: 'Deye', slug: 'deye', sort_order: 1 },
  ];
  const existingProducts: AdminProduct[] = [
    {
      id: 'prod-1',
      category_id: 'cat-panels',
      name: 'Existing Panel',
      slug: 'existing-panel',
      brand: 'ZN Shine',
      sku: 'SKU-EXIST-1',
      specs: {},
      price: 150000,
      min_order_qty: 1,
      stock_status: 'in_stock',
      stock_quantity: 20,
      images: ['https://example.com/old.jpg'],
      is_active: true,
      is_featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // SKU first, then slug
  assert.equal(
    findExistingProductMatch({ sku: 'sku-exist-1', slug: 'unrelated' }, existingProducts)?.matchedBy,
    'sku'
  );
  assert.equal(
    findExistingProductMatch({ sku: 'BRAND-NEW-SKU', slug: 'existing-panel' }, existingProducts)?.matchedBy,
    'slug'
  );
  assert.equal(
    findExistingProductMatch({ sku: 'BRAND-NEW-SKU', slug: 'brand-new-slug' }, existingProducts),
    null
  );

  const csvText = [
    'category,brand,name,sku,slug,short_description,trade_price,moq,stock_quantity,stock_status,active,featured,featured_image_url,other_image_urls,specs',
    // Row 2: Valid new product with empty slug, empty stock_status & qty=3 => low_stock, new missing brand
    '"solar panels","Canadian Solar","Canadian 600W Panel","CS-600W","","High output","₦160,000","",3,"",yes,no,"https://example.com/cs.jpg","","Wattage: 600W | Warranty: 25 Years"',
    // Row 3: Duplicate matching by SKU
    '"Solar Panels","ZN Shine","Updated Panel","SKU-EXIST-1","","Desc","155000",1,10,"In Stock",yes,yes,"https://example.com/up.jpg","",""',
    // Row 4: Invalid row (unknown category, bad price, missing image)
    '"Inverter","","Bad Row","BAD-1","","","abc",1,5,"",yes,no,"","",""',
  ].join('\n');

  const rawRows = parseBulkCsvText(csvText);

  // When autoCreateMissingBrands = false and duplicateStrategy = 'skip'
  const strictSkip = validateBulkImportRows(rawRows, {
    categories,
    brands,
    existingProducts,
    duplicateStrategy: 'skip',
    autoCreateMissingBrands: false,
  });

  assert.equal(strictSkip.rows[0].severity, 'error');
  assert.ok(strictSkip.rows[0].errors.some(e => e.includes("Brand 'Canadian Solar' not found")));
  assert.equal(strictSkip.rows[1].action, 'skip');
  assert.equal(strictSkip.rows[2].severity, 'error');
  assert.ok(strictSkip.rows[2].errors.includes("Category 'Inverter' not found"));
  assert.ok(strictSkip.rows[2].errors.includes('trade_price is not a number'));
  assert.ok(strictSkip.rows[2].errors.includes('missing featured_image_url'));
  assert.equal(strictSkip.missingBrands.length, 1);

  // When autoCreateMissingBrands = true and duplicateStrategy = 'update'
  const autoBrandUpdate = validateBulkImportRows(rawRows, {
    categories,
    brands,
    existingProducts,
    duplicateStrategy: 'update',
    autoCreateMissingBrands: true,
  });

  assert.equal(autoBrandUpdate.rows[0].severity, 'valid');
  assert.equal(autoBrandUpdate.rows[0].action, 'create');
  assert.equal(autoBrandUpdate.rows[0].slug, 'canadian-600w-panel');
  assert.equal(autoBrandUpdate.rows[0].moq, 1);
  assert.equal(autoBrandUpdate.rows[0].stockStatus, 'low_stock');
  assert.equal(autoBrandUpdate.rows[1].action, 'update');
  assert.equal(autoBrandUpdate.rows[2].severity, 'error');
  assert.equal(autoBrandUpdate.importableCount, 2);

  // Execution test: fail image fetch on Node (no fetch mock / unreachable) => product STILL created with warning
  const createdProducts: Product[] = [];
  const createdBrands: Brand[] = [];
  const result = await executeBulkProductImport(autoBrandUpdate, {
    autoCreateMissingBrands: true,
    createBrand: async input => {
      const b: Brand = {
        id: 'b-new',
        category_id: input.category_id,
        name: input.name,
        slug: slugify(input.name),
        sort_order: 1,
      };
      createdBrands.push(b);
      return b;
    },
    createProduct: async data => {
      const p: Product = {
        ...data,
        id: `created-${createdProducts.length + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      createdProducts.push(p);
      return p;
    },
    updateProduct: async (id, updates) => ({
      ...existingProducts[0],
      ...updates,
      id,
    }),
    uploadProductImage: async () => {
      throw new Error('simulated download failure');
    },
  });

  assert.equal(createdBrands.length, 1);
  assert.equal(createdBrands[0].name, 'Canadian Solar');
  assert.equal(result.created, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.skipped, 1); // Row 4 validation error skipped
  assert.equal(result.failed, 0);
  assert.equal(result.imageWarningCount, 2);
  assert.equal(result.imageWarnings[0].reason, 'Image failed — upload manually');

  const errorCsv = generateBulkErrorReportCsv(result.reportEntries);
  assert.ok(errorCsv.includes('row_number,status,error_reasons,category'));
  assert.ok(errorCsv.includes("Category 'Inverter' not found"));
  assert.ok(errorCsv.includes('Image failed — upload manually'));
});

test('safeStorage falls back cleanly to memory when window.localStorage throws SecurityError', () => {
  const prevWindow = (globalThis as any).window;
  try {
    (globalThis as any).window = {
      get localStorage() {
        throw new Error('Access is denied for this document');
      },
    };
    safeStorage.setItem('iframe_test_key', 'ok-value');
    assert.equal(safeStorage.getItem('iframe_test_key'), 'ok-value');
    safeStorage.removeItem('iframe_test_key');
    assert.equal(safeStorage.getItem('iframe_test_key'), null);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = prevWindow;
    }
  }
});

test('isCompletedOrder and buildReorderCartPlan handle completed status, MOQ, missing/out-of-stock products, and name fallback', () => {
  assert.equal(isCompletedOrder({ status: 'fulfilled' }), true);
  assert.equal(isCompletedOrder({ status: 'new' }), false);
  assert.equal(isCompletedOrder({ status: 'confirmed' }), false);
  assert.equal(isCompletedOrder({ status: 'cancelled' }), false);

  const now = new Date().toISOString();
  const makeProd = (overrides: Partial<Product>): Product => ({
    id: 'p-1',
    category_id: 'c-1',
    name: 'Panel 600W',
    slug: 'panel-600w',
    specs: {},
    price: 165000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: [],
    is_active: true,
    is_featured: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  const liveProducts: Product[] = [
    makeProd({ id: 'p-1', name: 'Panel 600W', price: 170000, min_order_qty: 4, stock_status: 'in_stock' }),
    makeProd({ id: 'p-2-new', name: 'Deye 5kVA Inverter', price: 1300000, min_order_qty: 1, stock_status: 'low_stock' }),
    makeProd({ id: 'p-3', name: 'Hidden Battery', is_active: false, stock_status: 'in_stock' }),
    makeProd({ id: 'p-4', name: 'Sold Out MPPT', is_active: true, stock_status: 'out_of_stock' }),
  ];

  const plan = buildReorderCartPlan(
    {
      items: [
        // Below current MOQ (2 < 4) -> bumped to 4
        { product_id: 'p-1', name: 'Panel 600W', qty: 2, unit_price: 155000, line_total: 310000 },
        // Old product ID changed, matched by name fallback
        { product_id: 'old-deleted-id', name: 'deye 5kva inverter', qty: 2, unit_price: 1200000, line_total: 2400000 },
        // Inactive -> skipped
        { product_id: 'p-3', name: 'Hidden Battery', qty: 1, unit_price: 500000, line_total: 500000 },
        // Out of stock -> skipped
        { product_id: 'p-4', name: 'Sold Out MPPT', qty: 1, unit_price: 90000, line_total: 90000 },
        // Duplicate same product in previous order -> merged
        { product_id: 'p-2-new', name: 'Deye 5kVA Inverter', qty: 1, unit_price: 1200000, line_total: 1200000 },
      ],
    },
    liveProducts
  );

  assert.equal(plan.itemsToCart.length, 2);
  assert.equal(plan.itemsToCart[0].product.id, 'p-1');
  assert.equal(plan.itemsToCart[0].product.price, 170000);
  assert.equal(plan.itemsToCart[0].quantity, 4);
  assert.equal(plan.itemsToCart[1].product.id, 'p-2-new');
  assert.equal(plan.itemsToCart[1].quantity, 3);
  assert.deepEqual(plan.adjustedMoqNames, ['Panel 600W']);
  assert.equal(plan.skippedItems.length, 2);
});

test('useCartStore.replaceItems repopulates the cart cleanly replacing prior cart items', () => {
  const now = new Date().toISOString();
  const prodA: Product = {
    id: 'prod-a',
    category_id: 'cat-1',
    name: 'Existing Cart Panel',
    slug: 'existing-cart-panel',
    specs: {},
    price: 100000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: [],
    is_active: true,
    is_featured: false,
    created_at: now,
    updated_at: now,
  };
  const prodB: Product = {
    ...prodA,
    id: 'prod-b',
    name: 'Reordered Inverter',
    slug: 'reordered-inverter',
    price: 950000,
    min_order_qty: 2,
  };

  useCartStore.getState().clearCart();
  useCartStore.getState().addItem(prodA, 3);
  useCartStore.getState().setNote('Old cart note');
  assert.equal(useCartStore.getState().items.length, 1);

  useCartStore.getState().replaceItems([{ product: prodB, quantity: 1 }]);
  const state = useCartStore.getState();
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].product.id, 'prod-b');
  assert.equal(state.items[0].quantity, 2); // enforced MOQ=2
  assert.equal(state.note, '');
  useCartStore.getState().clearCart();
});

test('shouldSeedLocalDemoData and initLocalDatabase suppress demo seeding and purge stale keys when Supabase is active', () => {
  assert.equal(shouldSeedLocalDemoData(true), false);
  assert.equal(shouldSeedLocalDemoData(false), true);

  const prevWindow = (globalThis as any).window;
  try {
    (globalThis as any).window = {};
    // Simulate legacy stale seed products & categories left behind in localStorage
    safeStorage.setItem('ceo_power_portal_products', JSON.stringify([{ id: 'old-seed-1', name: 'Old Seed' }]));
    safeStorage.setItem('ceo_power_portal_categories', JSON.stringify([{ id: 'old-cat-1', name: 'Old Cat' }]));
    safeStorage.setItem('ceo_power_portal_brands', JSON.stringify([{ id: 'old-brand-1', name: 'Old Brand' }]));
    safeStorage.setItem('ceo_power_portal_settings', JSON.stringify({ company_name: 'CEO Power Company' }));

    initLocalDatabase(true);

    for (const key of STALE_DEMO_STORAGE_KEYS) {
      assert.equal(safeStorage.getItem(`ceo_power_portal_${key}`), null);
    }
    // Non-demo keys like settings must remain untouched
    assert.ok(safeStorage.getItem('ceo_power_portal_settings'));

    // Offline/demo mode still seeds when Supabase is inactive
    initLocalDatabase(false);
    assert.ok(safeStorage.getItem('ceo_power_portal_products'));
    assert.ok(safeStorage.getItem('ceo_power_portal_categories'));
  } finally {
    for (const key of [...STALE_DEMO_STORAGE_KEYS, 'settings', 'staff_permissions', 'activity_log']) {
      safeStorage.removeItem(`ceo_power_portal_${key}`);
    }
    if (prevWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = prevWindow;
    }
  }
});

test('WhatsApp container theme defaults to dark mode and normalizes/toggles safely', () => {
  assert.equal(DEFAULT_WHATSAPP_THEME, 'dark');
  assert.equal(normalizeWhatsAppTheme(undefined), 'dark');
  assert.equal(normalizeWhatsAppTheme(null), 'dark');
  assert.equal(normalizeWhatsAppTheme(''), 'dark');
  assert.equal(normalizeWhatsAppTheme('midnight'), 'dark');
  assert.equal(normalizeWhatsAppTheme('dark'), 'dark');
  assert.equal(normalizeWhatsAppTheme('light'), 'light');

  assert.equal(toggleWhatsAppTheme('dark'), 'light');
  assert.equal(toggleWhatsAppTheme('light'), 'dark');
});
