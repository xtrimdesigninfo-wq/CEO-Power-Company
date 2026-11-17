import {
  AdminActivityLog,
  AdminNotification,
  AdminProduct,
  Brand,
  Category,
  CompanySettings,
  OrderItem,
  OrderRequest,
  OrderStatus,
  PermissionKey,
  Product,
  Profile,
  ResellerScope,
  StaffMember,
  StaffPermissionsRecord,
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeStorage } from '../lib/storage';
import { compressProductImage } from '../lib/imageCompression';
import {
  canAccessCategoryScope,
  canAccessResellerScope,
  canPerform,
  redactProductPrice,
  validateProductColumnChanges,
} from '../lib/permissions';
import {
  buildAlertFingerprint,
  DEFAULT_LOW_STOCK_THRESHOLD,
  deriveStockStatusFromQuantity,
  evaluateLowStockAlerts,
  inferSeedStockQuantity,
  isProductOutOfStock,
  normalizeLowStockThreshold,
} from '../lib/inventory';
import { normalizeWhatsAppNumber } from '../lib/whatsapp';
import { slugify } from '../lib/utils';

const STORAGE_KEY_PREFIX = 'ceo_power_portal_';
let brandsTableMissing = false;
let stockQuantityColumnMissing = false;
let notificationsTableMissing = false;

// Initial Seeds
const SEED_SETTINGS: CompanySettings = {
  whatsapp_number: '2347066449882',
  company_name: 'CEO Power Company',
  company_address: '20 Oguta Road, Onitsha, Anambra State',
  support_email: 'info@ceopowercompany.org',
  tagline: 'Power Without Limits',
  est_year: '2014',
  low_stock_threshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
};

const SEED_CATEGORIES: Category[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Solar Panels',
    slug: 'solar-panels',
    description: 'High-efficiency monocrystalline Tier-1 solar PV modules from global manufacturers.',
    image_url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    sort_order: 1,
    is_active: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Inverters',
    slug: 'inverters',
    description: 'Pure sine wave hybrid, off-grid and on-grid inverters engineered for Nigerian grid conditions.',
    image_url: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
    sort_order: 2,
    is_active: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Lithium Batteries (ESS)',
    slug: 'lithium-batteries-ess',
    description: 'LiFePO4 high-cycle energy storage systems with smart BMS and multi-unit paralleling.',
    image_url: 'https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80',
    sort_order: 3,
    is_active: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Charge Controllers',
    slug: 'charge-controllers',
    description: 'Ultra-fast Maximum Power Point Tracking (MPPT) regulators maximizing solar harvest.',
    image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    sort_order: 4,
    is_active: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Solar Accessories',
    slug: 'solar-accessories',
    description: 'Certified DC cables, IP68 MC4 connectors, DC isolators, breakers and mounting rails.',
    image_url: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80',
    sort_order: 5,
    is_active: true,
  },
];

const SEED_BRANDS: Brand[] = [
  { id: 'bbbbbbbb-0000-0000-0000-000000000101', category_id: '11111111-1111-1111-1111-111111111101', name: 'ZN Shine', slug: 'zn-shine', sort_order: 1 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000102', category_id: '11111111-1111-1111-1111-111111111101', name: 'Tongwei', slug: 'tongwei', sort_order: 2 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000103', category_id: '11111111-1111-1111-1111-111111111101', name: 'LONGi', slug: 'longi', sort_order: 3 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000104', category_id: '11111111-1111-1111-1111-111111111101', name: 'Jinko', slug: 'jinko', sort_order: 4 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000201', category_id: '11111111-1111-1111-1111-111111111102', name: 'Felicity', slug: 'felicity', sort_order: 1 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000202', category_id: '11111111-1111-1111-1111-111111111102', name: 'Deye', slug: 'deye', sort_order: 2 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000203', category_id: '11111111-1111-1111-1111-111111111102', name: 'Sunsynk', slug: 'sunsynk', sort_order: 3 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000204', category_id: '11111111-1111-1111-1111-111111111102', name: 'Growatt', slug: 'growatt', sort_order: 4 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000301', category_id: '11111111-1111-1111-1111-111111111103', name: 'Felicity', slug: 'felicity', sort_order: 1 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000302', category_id: '11111111-1111-1111-1111-111111111103', name: 'Pylontech', slug: 'pylontech', sort_order: 2 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000303', category_id: '11111111-1111-1111-1111-111111111103', name: 'CEO Power', slug: 'ceo-power', sort_order: 3 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000401', category_id: '11111111-1111-1111-1111-111111111104', name: 'SRNE', slug: 'srne', sort_order: 1 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000402', category_id: '11111111-1111-1111-1111-111111111104', name: 'Fangpusun', slug: 'fangpusun', sort_order: 2 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000501', category_id: '11111111-1111-1111-1111-111111111105', name: 'KBE Germany', slug: 'kbe-germany', sort_order: 1 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000502', category_id: '11111111-1111-1111-1111-111111111105', name: 'Staubli', slug: 'staubli', sort_order: 2 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000503', category_id: '11111111-1111-1111-1111-111111111105', name: 'Tomzn', slug: 'tomzn', sort_order: 3 },
  { id: 'bbbbbbbb-0000-0000-0000-000000000504', category_id: '11111111-1111-1111-1111-111111111105', name: 'CEO Power', slug: 'ceo-power', sort_order: 4 },
];

const SEED_PRODUCTS: Product[] = [
  {
    id: '22222222-2222-2222-2222-222222222101',
    category_id: '11111111-1111-1111-1111-111111111101',
    name: 'ZN Shine 600W Solar Panel',
    slug: 'zn-shine-600w-solar-panel',
    brand: 'ZN Shine',
    sku: 'ZNS-600W-MONO',
    short_description: 'High-output 600W Graphene-coated Tier-1 monocrystalline solar PV module with exceptional low-light yield.',
    specs: {
      'Wattage': '600W',
      'Cell Type': 'Monocrystalline Perc',
      'Efficiency': '21.6%',
      'Voc': '49.8V',
      'Isc': '15.3A',
      'Dimensions': '2465 x 1134 x 35 mm',
      'Weight': '31.2 kg',
      'Warranty': '12-Year Product / 25-Year Linear Power',
    },
    price: 155000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80',
    ],
    is_active: true,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222102',
    category_id: '11111111-1111-1111-1111-111111111101',
    name: 'Tongwei 620W Solar Panel',
    slug: 'tongwei-620w-solar-panel',
    brand: 'Tongwei',
    sku: 'TW-620W-SHINGLED',
    short_description: 'High-density shingled monocrystalline solar panel engineered for heavy industrial and commercial rooftops.',
    specs: {
      'Wattage': '620W',
      'Cell Type': 'N-Type Shingled Mono',
      'Efficiency': '22.1%',
      'Voc': '52.4V',
      'Isc': '15.1A',
      'Dimensions': '2384 x 1303 x 35 mm',
      'Warranty': '15-Year Product / 30-Year Performance',
    },
    price: 165000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222103',
    category_id: '11111111-1111-1111-1111-111111111101',
    name: 'LONGi 635W Solar Panel',
    slug: 'longi-635w-solar-panel',
    brand: 'LONGi',
    sku: 'LR5-72HGD-635M',
    short_description: 'Hi-MO 5 Bifacial dual-glass module with ultra-low degradation and superior temperature coefficient.',
    specs: {
      'Wattage': '635W',
      'Cell Type': 'Bifacial Half-Cut Mono',
      'Efficiency': '22.5%',
      'Bifaciality': '70±5%',
      'Voc': '53.2V',
      'Isc': '15.4A',
      'Warranty': '12-Year Product / 30-Year Power',
    },
    price: 175000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222104',
    category_id: '11111111-1111-1111-1111-111111111101',
    name: 'LONGi 645W Solar Panel',
    slug: 'longi-645w-solar-panel',
    brand: 'LONGi',
    sku: 'LR5-72HGD-645M',
    short_description: 'High-power 645W Hi-MO 7 with HPDC technology delivering maximum energy yield per square meter.',
    specs: {
      'Wattage': '645W',
      'Cell Type': 'HPDC N-Type Mono',
      'Efficiency': '22.8%',
      'Voc': '54.1V',
      'Isc': '15.5A',
      'Warranty': '15-Year Product / 30-Year Power',
    },
    price: 185000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222105',
    category_id: '11111111-1111-1111-1111-111111111101',
    name: 'Jinko 580W Solar Panel',
    slug: 'jinko-580w-solar-panel',
    brand: 'Jinko',
    sku: 'JKM-580N-72HL4',
    short_description: 'Tiger Neo N-type TopCon solar module providing higher bifacial gain and lower BOS cost.',
    specs: {
      'Wattage': '580W',
      'Cell Type': 'TopCon N-Type Mono',
      'Efficiency': '22.3%',
      'Voc': '51.2V',
      'Isc': '14.3A',
      'Warranty': '12-Year Product / 30-Year Power',
    },
    price: 145000,
    min_order_qty: 1,
    stock_status: 'low_stock',
    stock_quantity: 6,
    images: ['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222201',
    category_id: '11111111-1111-1111-1111-111111111102',
    name: 'Felicity 3kVA Hybrid Inverter 24V',
    slug: 'felicity-3kva-hybrid-inverter-24v',
    brand: 'Felicity',
    sku: 'FL-IVPS-3024',
    short_description: 'Compact 3kVA / 2.4kW pure sine wave hybrid inverter with built-in 80A MPPT controller.',
    specs: {
      'Rated Power': '3000VA / 2400W',
      'Battery Voltage': '24V DC',
      'MPPT Max PV Input': '145V DC',
      'Max PV Array': '2000W',
      'Output': '230V AC Pure Sine Wave',
      'Warranty': '2 Years',
    },
    price: 580000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    category_id: '11111111-1111-1111-1111-111111111102',
    name: 'Deye 5kVA Hybrid Inverter 48V',
    slug: 'deye-5kva-hybrid-inverter-48v',
    brand: 'Deye',
    sku: 'SUN-5K-SG03LP1-EU',
    short_description: 'Industry-leading 5kW low-voltage single phase hybrid inverter with dual MPPT and generator auto-start.',
    specs: {
      'Rated Power': '5000W',
      'Max DC Input': '6500W',
      'Battery Voltage': '48V DC (40-60V)',
      'Max Charge/Discharge': '120A',
      'MPPT Trackers': '2 Trackers',
      'Bypass Current': '35A',
      'Warranty': '5 Years',
    },
    price: 1250000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    category_id: '11111111-1111-1111-1111-111111111102',
    name: 'Sunsynk 8kVA Hybrid Inverter 48V',
    slug: 'sunsynk-8kva-hybrid-inverter-48v',
    brand: 'Sunsynk',
    sku: 'SUN-8K-SG01LP1',
    short_description: 'Heavy-duty 8kW hybrid inverter with Wi-Fi monitoring dongle, parallel support up to 16 units.',
    specs: {
      'Rated Power': '8000W',
      'Max DC Input': '10400W',
      'Battery Voltage': '48V DC',
      'Max Charge/Discharge': '190A',
      'Surge Power': '16000VA (10s)',
      'Efficiency': '97.6%',
      'Warranty': '5 Years',
    },
    price: 2100000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222204',
    category_id: '11111111-1111-1111-1111-111111111102',
    name: 'Growatt 10kVA Hybrid Inverter 48V',
    slug: 'growatt-10kva-hybrid-inverter-48v',
    brand: 'Growatt',
    sku: 'SPH-10000TL3-BH-UP',
    short_description: 'Robust 10kVA three-phase/split-phase hybrid inverter for luxury residential estates and commercial buildings.',
    specs: {
      'Rated Power': '10000W',
      'Max PV Input': '15000W',
      'Battery Voltage': '48V DC',
      'Output': '400/230V AC',
      'Protection': 'IP65 Weatherproof',
      'Warranty': '5 Years',
    },
    price: 2650000,
    min_order_qty: 1,
    stock_status: 'low_stock',
    stock_quantity: 4,
    images: ['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222301',
    category_id: '11111111-1111-1111-1111-111111111103',
    name: 'Felicity 5kWh 48V LiFePO4 Lithium Battery',
    slug: 'felicity-5kwh-48v-lifepo4-battery',
    brand: 'Felicity',
    sku: 'FL-LPBF48100-H',
    short_description: '51.2V 100Ah 5.12kWh wall-mounted lithium iron phosphate battery with CAN/RS485 smart inverter communication.',
    specs: {
      'Capacity': '5.12 kWh / 100Ah',
      'Nominal Voltage': '51.2V',
      'Max Discharge Current': '100A',
      'Cycle Life': '6000+ Cycles @ 80% DOD',
      'BMS Protection': 'Overcharge, Overdischarge, Temp',
      'Warranty': '5 Years',
    },
    price: 1450000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222302',
    category_id: '11111111-1111-1111-1111-111111111103',
    name: 'Pylontech 10kWh 48V LiFePO4 Battery Bank',
    slug: 'pylontech-10kwh-48v-lifepo4-battery-bank',
    brand: 'Pylontech',
    sku: 'US5000-2X-COMBO',
    short_description: 'Dual 4.8kWh US5000 rack-mounted module system delivering 9.6kWh usable energy with proven longevity.',
    specs: {
      'Capacity': '9.6 kWh / 200Ah',
      'Nominal Voltage': '48V',
      'Recommended Discharge': '100A',
      'Depth of Discharge': '95%',
      'Communication': 'CAN, RS485',
      'Warranty': '10 Years',
    },
    price: 2850000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222303',
    category_id: '11111111-1111-1111-1111-111111111103',
    name: 'CEO Power 16kWh High-Capacity Stacked ESS',
    slug: 'ceo-power-16kwh-stacked-ess',
    brand: 'CEO Power',
    sku: 'CEO-ESS-16K-STK',
    short_description: 'Commercial-grade modular stacked energy storage system with integrated master control unit and active balancing.',
    specs: {
      'Capacity': '16.38 kWh',
      'Nominal Voltage': '51.2V / 320Ah',
      'Continuous Discharge': '150A',
      'Peak Discharge': '200A (15s)',
      'Enclosure': 'Heavy-duty Industrial Steel',
      'Warranty': '7 Years',
    },
    price: 4400000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222401',
    category_id: '11111111-1111-1111-1111-111111111104',
    name: 'SRNE 60A MPPT Solar Charge Controller 12V/24V/48V',
    slug: 'srne-60a-mppt-solar-charge-controller',
    brand: 'SRNE',
    sku: 'MC-4860N15',
    short_description: 'High-speed MPPT algorithm controller with auto-detect 12V/24V/36V/48V voltage and backlit LCD display.',
    specs: {
      'Rated Current': '60A',
      'System Voltage': '12V / 24V / 36V / 48V Auto',
      'Max PV Open Voltage': '150V',
      'Max PV Input Power': '3200W (48V)',
      'Tracking Efficiency': '≥ 99.5%',
      'Warranty': '2 Years',
    },
    price: 140000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222402',
    category_id: '11111111-1111-1111-1111-111111111104',
    name: 'Fangpusun 100A MPPT High-Efficiency Controller',
    slug: 'fangpusun-100a-mppt-controller',
    brand: 'Fangpusun',
    sku: 'FP-MPPT-150-100',
    short_description: 'Heavy-duty 100A MPPT regulator engineered for high-voltage PV strings with Bluetooth dongle support.',
    specs: {
      'Rated Current': '100A',
      'System Voltage': '12V / 24V / 48V',
      'Max PV Voltage': '150V',
      'Max PV Power': '5800W (48V)',
      'Cooling': 'Cast Aluminum Heat Sink',
      'Warranty': '2 Years',
    },
    price: 260000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222501',
    category_id: '11111111-1111-1111-1111-111111111105',
    name: 'KBE 6mm² PV Solar Cable (100m Roll, Black/Red)',
    slug: 'kbe-6mm-pv-solar-cable-100m',
    brand: 'KBE Germany',
    sku: 'KBE-6MM-100M',
    short_description: 'TÜV certified double insulated solar photovoltaic cable resistant to UV, ozone and extreme African temperatures.',
    specs: {
      'Conductor': 'Tinned Copper 6mm²',
      'Length': '100 Meters Roll',
      'Voltage Rating': '1500V DC',
      'Standard': 'EN 50618 TÜV',
      'Temp Range': '-40°C to +90°C',
    },
    price: 68000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222502',
    category_id: '11111111-1111-1111-1111-111111111105',
    name: 'Staubli MC4 Solar Connectors (Pair M/F IP68)',
    slug: 'staubli-mc4-solar-connectors-pair',
    brand: 'Staubli',
    sku: 'MC4-PV-KBT4-SET',
    short_description: 'Original Swiss-engineered MC4 male/female connectors rated for 1500V DC with snap-in lock mechanism.',
    specs: {
      'Type': 'Male & Female Pair',
      'Rated Current': '39A',
      'Protection': 'IP68 Waterproof',
      'Cable Size': '4mm² - 6mm²',
      'Material': 'UV Resistant Polyamide',
    },
    price: 2500,
    min_order_qty: 10,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222503',
    category_id: '11111111-1111-1111-1111-111111111105',
    name: 'Tomzn 63A 2P DC Miniature Circuit Breaker (550V)',
    slug: 'tomzn-63a-2p-dc-breaker-550v',
    brand: 'Tomzn',
    sku: 'TOB1Z-63-2P',
    short_description: 'Non-polarity DC MCB designed for solar PV string overcurrent and short-circuit protection.',
    specs: {
      'Rated Current': '63A',
      'Poles': '2P',
      'Rated Voltage': '550V DC',
      'Breaking Capacity': '6kA',
      'Mounting': 'Standard 35mm DIN Rail',
    },
    price: 12500,
    min_order_qty: 2,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222504',
    category_id: '11111111-1111-1111-1111-111111111105',
    name: 'CEO Heavy-Duty Anodized Aluminum Panel Mounting Rail Kit',
    slug: 'ceo-aluminum-panel-mounting-rail-kit',
    brand: 'CEO Power',
    sku: 'CEO-MNT-ALUM-KIT',
    short_description: 'Complete roof mounting kit including 2x 2.4m anodized AL6005-T5 rails, mid-clamps, end-clamps and L-feet.',
    specs: {
      'Rail Length': '2 x 2.4 Meters (4.8m total)',
      'Material': 'Anodized Aluminum AL6005-T5',
      'Hardware': 'SUS304 Stainless Steel',
      'Wind Load': 'Up to 60 m/s',
      'Snow Load': '1.4 kN/m²',
    },
    price: 35000,
    min_order_qty: 1,
    stock_status: 'in_stock',
    images: ['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    is_active: true,
    is_featured: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
];

const SEED_PROFILES: Profile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
    username: 'xtrimdesign',
    full_name: 'CEO Power Administrator',
    business_name: 'CEO Power Company HQ',
    phone: '2347066449882',
    state: 'Anambra State',
    city: 'Onitsha',
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    role: 'reseller',
    username: 'solarplus_onitsha',
    email: 'solarplus@solarplusnig.com',
    full_name: 'Emeka Okafor',
    business_name: 'SolarPlus Systems Nig. Ltd',
    phone: '08031234567',
    state: 'Anambra State',
    city: 'Onitsha',
    status: 'active',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const SEED_ORDERS: OrderRequest[] = [
  {
    id: '33333333-3333-3333-3333-333333333001',
    ref: 'CEO-2611-0001',
    reseller_id: '00000000-0000-0000-0000-000000000002',
    items: [
      {
        product_id: '22222222-2222-2222-2222-222222222101',
        name: 'ZN Shine 600W Solar Panel',
        qty: 10,
        unit_price: 155000,
        line_total: 1550000,
        image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      },
      {
        product_id: '22222222-2222-2222-2222-222222222202',
        name: 'Deye 5kVA Hybrid Inverter 48V',
        qty: 2,
        unit_price: 1250000,
        line_total: 2500000,
        image: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
      },
    ],
    total: 4050000,
    note: 'Urgent installation project at GRA Onitsha.',
    status: 'confirmed',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

// Helper to load/save in localStorage (with safe in-memory fallback)
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const data = safeStorage.getItem(STORAGE_KEY_PREFIX + key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Failed to load ${key} from storage:`, e);
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    safeStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key} to storage:`, e);
  }
}

// Initialise storage if empty
export function initLocalDatabase() {
  if (typeof window === 'undefined') return;
  try {
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'categories')) {
      setLocalItem('categories', SEED_CATEGORIES);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'brands')) {
      setLocalItem('brands', SEED_BRANDS);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'products')) {
      setLocalItem('products', SEED_PRODUCTS);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'settings')) {
      setLocalItem('settings', SEED_SETTINGS);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'profiles')) {
      setLocalItem('profiles', SEED_PROFILES);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'orders')) {
      setLocalItem('orders', SEED_ORDERS);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'staff_permissions')) {
      setLocalItem('staff_permissions', []);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'activity_log')) {
      setLocalItem('activity_log', []);
    }
    if (!safeStorage.getItem(STORAGE_KEY_PREFIX + 'passwords')) {
      // Map of username -> password for local testing
      setLocalItem('passwords', {
        'xtrimdesign': 'Le123456789',
        'solarplus_onitsha': 'Partner2024!',
      });
    }
  } catch (e) {
    console.error('Failed to initialize local database:', e);
  }
}

initLocalDatabase();

function getLocalActorContext(): {
  actor: Profile | null;
  staffPerms: StaffPermissionsRecord | null;
} {
  if (typeof window === 'undefined') return { actor: null, staffPerms: null };
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_PREFIX + 'current_session');
    if (!raw) return { actor: null, staffPerms: null };
    const parsed = JSON.parse(raw);
    const sessionProfile = parsed?.profile as Profile | undefined;
    if (!sessionProfile) return { actor: null, staffPerms: null };
    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const freshActor = profiles.find(p => p.id === sessionProfile.id) || sessionProfile;
    const allPerms = getLocalItem<StaffPermissionsRecord[]>('staff_permissions', []);
    const staffPerms =
      freshActor.role === 'staff'
        ? allPerms.find(sp => sp.user_id === freshActor.id) || {
            user_id: freshActor.id,
            permissions: [],
            category_scope: null,
            reseller_scope: 'all',
            preset: null,
          }
        : null;
    return { actor: freshActor, staffPerms };
  } catch {
    return { actor: null, staffPerms: null };
  }
}

function appendLocalActivityLog(
  actor: Profile | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, any>
) {
  if (!actor || (actor.role !== 'admin' && actor.role !== 'staff')) return;
  const logs = getLocalItem<AdminActivityLog[]>('activity_log', []);
  logs.unshift({
    id: crypto.randomUUID(),
    actor_id: actor.id,
    actor: {
      id: actor.id,
      username: actor.username,
      full_name: actor.full_name,
      role: actor.role,
    },
    action,
    entity,
    entity_id: entityId,
    details,
    created_at: new Date().toISOString(),
  });
  setLocalItem('activity_log', logs.slice(0, 500));
}

function getStockQuantityOverrides(): Record<string, number> {
  return getLocalItem<Record<string, number>>('stock_quantities', {});
}

function setStockQuantityOverride(productId: string, quantity: number | null | undefined): void {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return;
  const map = getStockQuantityOverrides();
  map[productId] = Math.max(0, Math.floor(quantity));
  setLocalItem('stock_quantities', map);
}

function hydrateProductStockQuantity<T extends { id: string; stock_status: any; stock_quantity?: number | null }>(
  row: T,
  useStatusInferenceFallback = false
): T {
  if (typeof row.stock_quantity === 'number' && Number.isFinite(row.stock_quantity)) {
    return row;
  }
  const overrides = getStockQuantityOverrides();
  if (typeof overrides[row.id] === 'number' && Number.isFinite(overrides[row.id])) {
    return { ...row, stock_quantity: overrides[row.id] };
  }
  if (useStatusInferenceFallback) {
    return { ...row, stock_quantity: inferSeedStockQuantity(row.stock_status) };
  }
  return { ...row, stock_quantity: null };
}

function isMissingStockColumnError(error: any): boolean {
  const msg = error?.message?.toLowerCase() || '';
  const code = error?.code || '';
  return code === '42703' || code === 'PGRST204' || msg.includes('stock_quantity');
}

// In-flight read request deduplication (shares simultaneous network calls across mounted components)
const inFlightRequests = new Map<string, Promise<unknown>>();

function dedupeInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

// ----------------------------------------------------------------------
// DATA SERVICE IMPLEMENTATION
// ----------------------------------------------------------------------

export const dataService = {
  // SETTINGS
  async getSettings(): Promise<CompanySettings> {
    return dedupeInFlight('settings', async () => {
      const localSettings = getLocalItem<CompanySettings>('settings', SEED_SETTINGS);
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('settings').select('key, value');
        if (!error && data && data.length > 0) {
          const settingsMap: any = { ...SEED_SETTINGS };
          data.forEach(item => {
            settingsMap[item.key] = item.value;
          });
          if (!settingsMap.low_stock_threshold && localSettings.low_stock_threshold) {
            settingsMap.low_stock_threshold = localSettings.low_stock_threshold;
          }
          return settingsMap as CompanySettings;
        }
      }
      return localSettings;
    });
  },

  async updateSettings(updates: Partial<CompanySettings>): Promise<CompanySettings> {
    const current = await this.getSettings();
    const normalizedUpdates: Partial<CompanySettings> = {
      ...updates,
      ...(updates.whatsapp_number !== undefined
        ? { whatsapp_number: normalizeWhatsAppNumber(updates.whatsapp_number) }
        : {}),
      ...(updates.low_stock_threshold !== undefined
        ? { low_stock_threshold: String(normalizeLowStockThreshold(updates.low_stock_threshold)) }
        : {}),
    };
    const updated = { ...current, ...normalizedUpdates };

    if (isSupabaseConfigured && supabase) {
      for (const [key, value] of Object.entries(normalizedUpdates)) {
        if (value !== undefined) {
          const { error } = await supabase.from('settings').upsert({ key, value: String(value) });
          if (error) throw new Error(error.message);
        }
      }
      setLocalItem('settings', updated);
      return updated;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'settings.edit')) {
      throw new Error('You do not have permission to edit company settings.');
    }

    if (
      normalizedUpdates.whatsapp_number !== undefined &&
      normalizedUpdates.whatsapp_number !== normalizeWhatsAppNumber(current.whatsapp_number) &&
      actor?.role !== 'admin'
    ) {
      throw new Error('Only the Master Admin can change the WhatsApp order number.');
    }

    setLocalItem('settings', updated);
    appendLocalActivityLog(actor, 'settings.update', 'settings', 'company_settings', {
      before: current,
      after: updated,
    });
    return updated;
  },

  // CATEGORIES
  async getCategories(onlyActive = true): Promise<Category[]> {
    return dedupeInFlight(`categories:${onlyActive}`, async () => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('categories').select('*').order('sort_order', { ascending: true });
        if (onlyActive) {
          query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (!error && data) return data as Category[];
      }
      const { actor, staffPerms } = getLocalActorContext();
      let categories = getLocalItem<Category[]>('categories', SEED_CATEGORIES);
      if (!onlyActive && actor?.role === 'staff') {
        categories = categories.filter(c => canAccessCategoryScope(actor, staffPerms, c.id));
      }
      const filtered = onlyActive ? categories.filter(c => c.is_active) : categories;
      return filtered.sort((a, b) => a.sort_order - b.sort_order);
    });
  },

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').select('*').eq('slug', slug).maybeSingle();
      if (!error && data) return data as Category;
    }
    const categories = getLocalItem<Category[]>('categories', SEED_CATEGORIES);
    return categories.find(c => c.slug === slug) || null;
  },

  async createCategory(cat: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
    const newCategory: Category = {
      ...cat,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').insert(newCategory).select().single();
      if (!error && data) return data as Category;
      if (error) throw new Error(error.message);
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'categories.create_edit')) {
      throw new Error('You do not have permission to create categories.');
    }
    if (actor?.role === 'staff' && staffPerms?.category_scope && staffPerms.category_scope.length > 0) {
      throw new Error('Category-scoped staff cannot create new categories.');
    }

    const categories = getLocalItem<Category[]>('categories', SEED_CATEGORIES);
    categories.push(newCategory);
    setLocalItem('categories', categories);
    appendLocalActivityLog(actor, 'category.insert', 'categories', newCategory.id, {
      name: newCategory.name,
    });
    return newCategory;
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
      if (!error && data) return data as Category;
      if (error) throw new Error(error.message);
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canAccessCategoryScope(actor, staffPerms, id)) {
      throw new Error('You do not have access to this category.');
    }

    const categories = getLocalItem<Category[]>('categories', SEED_CATEGORIES);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Category not found');
    const existing = categories[index];

    if (updates.sort_order !== undefined && updates.sort_order !== existing.sort_order && !canPerform(actor, staffPerms, 'categories.reorder')) {
      throw new Error('You do not have permission to reorder categories.');
    }
    if (updates.is_active !== undefined && updates.is_active !== existing.is_active && !canPerform(actor, staffPerms, 'categories.toggle_visibility')) {
      throw new Error('You do not have permission to change category visibility.');
    }
    if (
      (updates.name !== undefined || updates.slug !== undefined || updates.description !== undefined || updates.image_url !== undefined) &&
      !canPerform(actor, staffPerms, 'categories.create_edit')
    ) {
      throw new Error('You do not have permission to edit category details.');
    }

    categories[index] = { ...existing, ...updates };
    setLocalItem('categories', categories);
    appendLocalActivityLog(actor, 'category.update', 'categories', id, {
      name: categories[index].name,
      before: { is_active: existing.is_active, sort_order: existing.sort_order },
      after: { is_active: categories[index].is_active, sort_order: categories[index].sort_order },
    });
    return categories[index];
  },

  async reorderCategories(orderedIds: string[]): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase.from('categories').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
        if (error) throw new Error(error.message);
      }
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'categories.reorder')) {
      throw new Error('You do not have permission to reorder categories.');
    }

    const categories = getLocalItem<Category[]>('categories', SEED_CATEGORIES);
    const updated = categories.map(cat => {
      const newOrder = orderedIds.indexOf(cat.id);
      return newOrder !== -1 ? { ...cat, sort_order: newOrder + 1 } : cat;
    });
    setLocalItem('categories', updated);
    appendLocalActivityLog(actor, 'category.reorder', 'categories', null, { orderedIds });
  },

  async deleteCategory(id: string): Promise<void> {
    const products = await this.getProducts({ activeOnly: false });
    const productCount = products.filter(p => p.category_id === id).length;
    if (productCount > 0) {
      throw new Error(`Cannot delete category: ${productCount} product(s) are assigned to it. Please reassign or delete them first.`);
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'categories.delete') || !canAccessCategoryScope(actor, staffPerms, id)) {
      throw new Error('You do not have permission to delete this category.');
    }

    const categories = getLocalItem<Category[]>('categories', SEED_CATEGORIES);
    const target = categories.find(c => c.id === id);
    const updated = categories.filter(c => c.id !== id);
    setLocalItem('categories', updated);
    // Clean up brands under deleted category
    const brands = getLocalItem<Brand[]>('brands', SEED_BRANDS).filter(b => b.category_id !== id);
    setLocalItem('brands', brands);
    appendLocalActivityLog(actor, 'category.delete', 'categories', id, { name: target?.name });
  },

  // BRANDS (Product Sub-Categories under a Parent Category)
  async getBrands(categoryId?: string): Promise<Brand[]> {
    let brands: Brand[] | null = null;

    if (isSupabaseConfigured && supabase && !brandsTableMissing) {
      let query = supabase
        .from('brands')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      const { data, error } = await query;
      if (!error && data) {
        brands = data as Brand[];
      } else {
        const msg = error?.message?.toLowerCase() || '';
        const code = (error as any)?.code || '';
        if (code === 'PGRST205' || code === '42P01' || (msg.includes('brands') && (msg.includes('could not find') || msg.includes('does not exist')))) {
          brandsTableMissing = true;
        }
        // Fallback when brands table hasn't been created yet on Supabase: merge local brands + existing products' brands
        const localBrands = getLocalItem<Brand[]>('brands', SEED_BRANDS);
        const merged = [...localBrands];
        const { data: prodRows } = await supabase
          .from('products')
          .select('category_id, brand');
        if (prodRows) {
          for (const row of prodRows as Array<{ category_id: string; brand: string | null }>) {
            const name = row.brand?.trim();
            if (!name || !row.category_id) continue;
            const slug = slugify(name);
            if (!merged.some(b => b.category_id === row.category_id && (b.slug === slug || b.name.toLowerCase() === name.toLowerCase()))) {
              merged.push({
                id: `derived-${row.category_id}-${slug}`,
                category_id: row.category_id,
                name,
                slug,
                sort_order: merged.length + 1,
              });
            }
          }
          setLocalItem('brands', merged);
        }
        brands = merged;
      }
    } else if (isSupabaseConfigured && supabase && brandsTableMissing) {
      brands = getLocalItem<Brand[]>('brands', SEED_BRANDS);
    }

    if (!brands) {
      brands = getLocalItem<Brand[]>('brands', SEED_BRANDS);
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (actor?.role === 'staff') {
      brands = brands.filter(b => canAccessCategoryScope(actor, staffPerms, b.category_id));
    }

    if (categoryId) {
      brands = brands.filter(b => b.category_id === categoryId);
    }

    return [...brands].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
  },

  async createBrand(input: { category_id: string; name: string }): Promise<Brand> {
    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('Brand name is required.');
    }
    const cleanSlug = slugify(cleanName);
    if (!cleanSlug) {
      throw new Error('Enter a valid brand name.');
    }

    const existingBrands = await this.getBrands(input.category_id);
    const duplicate = existingBrands.find(
      b => b.name.toLowerCase() === cleanName.toLowerCase() || b.slug === cleanSlug
    );
    if (duplicate) {
      throw new Error(`Brand "${duplicate.name}" already exists in this category.`);
    }

    const newBrand: Brand = {
      id: crypto.randomUUID(),
      category_id: input.category_id,
      name: cleanName,
      slug: cleanSlug,
      sort_order: existingBrands.length + 1,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && !brandsTableMissing) {
      const { data, error } = await supabase.from('brands').insert(newBrand).select().single();
      if (!error && data) {
        const local = getLocalItem<Brand[]>('brands', SEED_BRANDS);
        setLocalItem('brands', [...local, data as Brand]);
        return data as Brand;
      }
      const msg = error?.message?.toLowerCase() || '';
      const code = (error as any)?.code || '';
      const isMissingTable = code === 'PGRST205' || code === '42P01' || (msg.includes('brands') && (msg.includes('could not find') || msg.includes('does not exist')));
      if (isMissingTable) {
        brandsTableMissing = true;
      } else if (error) {
        throw new Error(error.message);
      }
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (
      (!canPerform(actor, staffPerms, 'categories.create_edit') &&
        !canPerform(actor, staffPerms, 'products.create')) ||
      !canAccessCategoryScope(actor, staffPerms, input.category_id)
    ) {
      throw new Error('You do not have permission to add brands to this category.');
    }

    const brands = getLocalItem<Brand[]>('brands', SEED_BRANDS);
    brands.push(newBrand);
    setLocalItem('brands', brands);
    appendLocalActivityLog(actor, 'brand.create', 'brands', newBrand.id, {
      name: newBrand.name,
      category_id: newBrand.category_id,
    });
    return newBrand;
  },

  async deleteBrand(id: string): Promise<void> {
    const allBrands = await this.getBrands();
    const target = allBrands.find(b => b.id === id);
    if (!target) {
      throw new Error('Brand not found.');
    }

    const products = await this.getProducts({ activeOnly: false });
    const assignedCount = products.filter(
      p =>
        p.category_id === target.category_id &&
        p.brand &&
        p.brand.trim().toLowerCase() === target.name.trim().toLowerCase()
    ).length;

    if (assignedCount > 0) {
      throw new Error(
        `Cannot delete brand "${target.name}": ${assignedCount} product(s) in this category are assigned to it. Reassign those products first.`
      );
    }

    if (isSupabaseConfigured && supabase && !brandsTableMissing && !id.startsWith('derived-')) {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (!error) {
        const local = getLocalItem<Brand[]>('brands', SEED_BRANDS).filter(b => b.id !== id);
        setLocalItem('brands', local);
        return;
      }
      const msg = error?.message?.toLowerCase() || '';
      const code = (error as any)?.code || '';
      const isMissingTable = code === 'PGRST205' || code === '42P01' || (msg.includes('brands') && (msg.includes('could not find') || msg.includes('does not exist')));
      if (isMissingTable) {
        brandsTableMissing = true;
      } else if (error) {
        throw new Error(error.message);
      }
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (
      (!canPerform(actor, staffPerms, 'categories.delete') &&
        !canPerform(actor, staffPerms, 'categories.create_edit')) ||
      !canAccessCategoryScope(actor, staffPerms, target.category_id)
    ) {
      throw new Error('You do not have permission to delete this brand.');
    }

    const brands = getLocalItem<Brand[]>('brands', SEED_BRANDS);
    setLocalItem('brands', brands.filter(b => b.id !== id));
    appendLocalActivityLog(actor, 'brand.delete', 'brands', id, {
      name: target.name,
      category_id: target.category_id,
    });
  },

  // PRODUCTS (RESELLER / PUBLIC STOREFRONT)
  async getProducts(params?: {
    categorySlug?: string;
    categoryId?: string;
    search?: string;
    brand?: string;
    sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest';
    activeOnly?: boolean;
  }): Promise<Product[]> {
    let products: Product[] = [];

    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('products').select('*');
      if (params?.activeOnly ?? true) {
        query = query.eq('is_active', true);
      }
      if (params?.categoryId) {
        query = query.eq('category_id', params.categoryId);
      }
      const { data, error } = await query;
      if (!error && data) {
        products = (data as Product[]).map(r => hydrateProductStockQuantity(r));
      } else {
        products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r => hydrateProductStockQuantity(r, true));
      }
    } else {
      products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r => hydrateProductStockQuantity(r, true));
    }

    if (params?.activeOnly ?? true) {
      products = products.filter(p => p.is_active);
    }

    if (params?.categorySlug) {
      const category = await this.getCategoryBySlug(params.categorySlug);
      if (category) {
        products = products.filter(p => p.category_id === category.id);
      }
    }

    if (params?.categoryId) {
      products = products.filter(p => p.category_id === params.categoryId);
    }

    if (params?.brand && params.brand !== 'all') {
      products = products.filter(p => p.brand?.toLowerCase() === params.brand?.toLowerCase());
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      products = products.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.short_description && p.short_description.toLowerCase().includes(q))
      );
    }

    const sort = params?.sort || 'newest';
    products.sort((a, b) => {
      if (sort === 'featured') {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });

    return products;
  },

  // ADMIN / STAFF PRODUCTS (Price-hiding RPC & category scope enforcement, always newest first)
  async getAdminProducts(): Promise<AdminProduct[]> {
    return dedupeInFlight('admin-products', async () => {
      const sortNewestFirst = (list: AdminProduct[]) =>
        [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('admin_list_products');
        if (!error && data) {
          return sortNewestFirst(
            (data as any[]).map(row =>
              hydrateProductStockQuantity({
                ...row,
                price: row.price === null || row.price === undefined ? null : Number(row.price),
              })
            ) as AdminProduct[]
          );
        }

        // Safe fallback ONLY for Super Admin if the SQL migration has not yet been applied
        const msg = error?.message?.toLowerCase() || '';
        const isMissingRpc = msg.includes('admin_list_products') && (msg.includes('could not find') || msg.includes('does not exist'));
        const { actor } = getLocalActorContext();
        if (isMissingRpc && actor?.role === 'admin') {
          const { data: rows, error: directErr } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
          if (!directErr && rows) {
            return sortNewestFirst((rows as AdminProduct[]).map(r => hydrateProductStockQuantity(r)));
          }
        }
        if (error) throw new Error(error.message);
      }

      const { actor, staffPerms } = getLocalActorContext();
      if (!canPerform(actor, staffPerms, 'products.view')) {
        throw new Error('You do not have permission to view products.');
      }
      const canViewPrices = canPerform(actor, staffPerms, 'products.view_prices');
      const products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r =>
        hydrateProductStockQuantity(r, true)
      );
      return sortNewestFirst(
        products
          .filter(p => canAccessCategoryScope(actor, staffPerms, p.category_id))
          .map(p => redactProductPrice(p, canViewPrices))
      );
    });
  },

  async getAdminProductById(id: string): Promise<AdminProduct | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('admin_get_product', { p_id: id });
      if (!error && Array.isArray(data)) {
        const row = data[0];
        if (!row) return null;
        return hydrateProductStockQuantity({
          ...row,
          price: row.price === null || row.price === undefined ? null : Number(row.price),
        }) as AdminProduct;
      }

      const msg = error?.message?.toLowerCase() || '';
      const isMissingRpc = msg.includes('admin_get_product') && (msg.includes('could not find') || msg.includes('does not exist'));
      const { actor } = getLocalActorContext();
      if (isMissingRpc && actor?.role === 'admin') {
        const { data: row, error: directErr } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
        if (!directErr && row) return hydrateProductStockQuantity(row as AdminProduct);
      }
      if (error) throw new Error(error.message);
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'products.view')) {
      throw new Error('You do not have permission to view products.');
    }
    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r =>
      hydrateProductStockQuantity(r, true)
    );
    const product = products.find(p => p.id === id);
    if (!product || !canAccessCategoryScope(actor, staffPerms, product.category_id)) {
      return null;
    }
    return redactProductPrice(product, canPerform(actor, staffPerms, 'products.view_prices'));
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();
      if (!error && data) return hydrateProductStockQuantity(data as Product);
    }
    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r =>
      hydrateProductStockQuantity(r, true)
    );
    return products.find(p => p.slug === slug) || null;
  },

  async getProductById(id: string): Promise<Product | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (!error && data) return hydrateProductStockQuantity(data as Product);
    }
    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r =>
      hydrateProductStockQuantity(r, true)
    );
    return products.find(p => p.id === id) || null;
  },

  async createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const newProduct: Product = {
      ...data,
      stock_quantity:
        typeof data.stock_quantity === 'number' && Number.isFinite(data.stock_quantity)
          ? Math.max(0, Math.floor(data.stock_quantity))
          : inferSeedStockQuantity(data.stock_status),
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      if (newProduct.stock_quantity !== undefined && newProduct.stock_quantity !== null) {
        setStockQuantityOverride(newProduct.id, newProduct.stock_quantity);
      }

      const activeThreshold = await this.getLowStockThreshold().catch(() => DEFAULT_LOW_STOCK_THRESHOLD);
      const isInitialLowOrOut =
        newProduct.stock_status !== 'in_stock' ||
        (typeof newProduct.stock_quantity === 'number' && newProduct.stock_quantity < activeThreshold);

      if (stockQuantityColumnMissing) {
        const { stock_quantity: _omit, ...withoutStockQty } = newProduct;
        if (isInitialLowOrOut) {
          const { data: baseCreated, error: baseErr } = await supabase
            .from('products')
            .insert({ ...withoutStockQty, stock_status: 'in_stock' })
            .select()
            .single();
          if (baseErr) throw new Error(baseErr.message);
          const { data: syncedRow, error: syncErr } = await supabase
            .from('products')
            .update({ stock_status: newProduct.stock_status })
            .eq('id', (baseCreated as Product).id)
            .select()
            .single();
          if (!syncErr && syncedRow) return hydrateProductStockQuantity(syncedRow as Product);
          return hydrateProductStockQuantity({
            ...(baseCreated as Product),
            stock_status: newProduct.stock_status,
            stock_quantity: newProduct.stock_quantity,
          });
        }
        const { data: created, error } = await supabase.from('products').insert(withoutStockQty).select().single();
        if (!error && created) return hydrateProductStockQuantity(created as Product);
        if (error) throw new Error(error.message);
      } else {
        if (isInitialLowOrOut) {
          const seedSafeQty = Math.max(25, activeThreshold + 10);
          const { data: baseCreated, error: baseErr } = await supabase
            .from('products')
            .insert({
              ...newProduct,
              stock_status: 'in_stock',
              stock_quantity: seedSafeQty,
            })
            .select()
            .single();
          if (!baseErr && baseCreated) {
            const { data: syncedRow, error: syncErr } = await supabase
              .from('products')
              .update({
                stock_quantity: newProduct.stock_quantity,
                stock_status: newProduct.stock_status,
              })
              .eq('id', (baseCreated as Product).id)
              .select()
              .single();
            if (!syncErr && syncedRow) return hydrateProductStockQuantity(syncedRow as Product);
            return hydrateProductStockQuantity({
              ...(baseCreated as Product),
              stock_quantity: newProduct.stock_quantity,
              stock_status: newProduct.stock_status,
            });
          }
          if (baseErr && isMissingStockColumnError(baseErr)) {
            stockQuantityColumnMissing = true;
            const { stock_quantity: _omit, ...withoutStockQty } = newProduct;
            const { data: retryBase, error: retryBaseErr } = await supabase
              .from('products')
              .insert({ ...withoutStockQty, stock_status: 'in_stock' })
              .select()
              .single();
            if (retryBaseErr) throw new Error(retryBaseErr.message);
            const { data: syncedRetry } = await supabase
              .from('products')
              .update({ stock_status: newProduct.stock_status })
              .eq('id', (retryBase as Product).id)
              .select()
              .single();
            return hydrateProductStockQuantity((syncedRetry || {
              ...(retryBase as Product),
              stock_status: newProduct.stock_status,
              stock_quantity: newProduct.stock_quantity,
            }) as Product);
          }
          if (baseErr) throw new Error(baseErr.message);
        }

        const { data: created, error } = await supabase.from('products').insert(newProduct).select().single();
        if (!error && created) return hydrateProductStockQuantity(created as Product);
        if (error && isMissingStockColumnError(error)) {
          stockQuantityColumnMissing = true;
          const { stock_quantity: _omit, ...withoutStockQty } = newProduct;
          const { data: retryCreated, error: retryErr } = await supabase
            .from('products')
            .insert(withoutStockQty)
            .select()
            .single();
          if (!retryErr && retryCreated) return hydrateProductStockQuantity(retryCreated as Product);
          if (retryErr) throw new Error(retryErr.message);
        }
        // Fallback if Supabase's BEFORE INSERT trigger fires admin_notifications FK violation for low-stock creates
        if (
          error &&
          (error.code === '23503' || error.message?.includes('admin_notifications_product_id_fkey'))
        ) {
          const seedSafeQty = Math.max(100, (newProduct.stock_quantity ?? 0) + 100);
          const { data: baseCreated, error: baseErr } = await supabase
            .from('products')
            .insert({
              ...newProduct,
              stock_status: 'in_stock',
              stock_quantity: seedSafeQty,
            })
            .select()
            .single();
          if (baseErr) throw new Error(baseErr.message);
          const { data: syncedRow, error: syncErr } = await supabase
            .from('products')
            .update({
              stock_quantity: newProduct.stock_quantity,
              stock_status: newProduct.stock_status,
            })
            .eq('id', (baseCreated as Product).id)
            .select()
            .single();
          if (!syncErr && syncedRow) return hydrateProductStockQuantity(syncedRow as Product);
          return hydrateProductStockQuantity({
            ...(baseCreated as Product),
            stock_quantity: newProduct.stock_quantity,
            stock_status: newProduct.stock_status,
          });
        }
        if (error) throw new Error(error.message);
      }
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'products.create') || !canAccessCategoryScope(actor, staffPerms, newProduct.category_id)) {
      throw new Error('You do not have permission to create products in this category.');
    }

    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS);
    products.unshift(newProduct);
    setLocalItem('products', products);
    setStockQuantityOverride(newProduct.id, newProduct.stock_quantity);
    appendLocalActivityLog(actor, 'product.create', 'products', newProduct.id, {
      name: newProduct.name,
      after: {
        price: newProduct.price,
        stock_status: newProduct.stock_status,
        stock_quantity: newProduct.stock_quantity,
        is_active: newProduct.is_active,
      },
    });
    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<AdminProduct> {
    const payload: Partial<Product> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (typeof payload.stock_quantity === 'number' && Number.isFinite(payload.stock_quantity)) {
      payload.stock_quantity = Math.max(0, Math.floor(payload.stock_quantity));
      setStockQuantityOverride(id, payload.stock_quantity);
    }

    if (isSupabaseConfigured && supabase) {
      if (stockQuantityColumnMissing) {
        const { stock_quantity: _omit, ...withoutStockQty } = payload;
        const { error } = await supabase.from('products').update(withoutStockQty).eq('id', id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        if (error && isMissingStockColumnError(error)) {
          stockQuantityColumnMissing = true;
          const { stock_quantity: _omit, ...withoutStockQty } = payload;
          const { error: retryErr } = await supabase.from('products').update(withoutStockQty).eq('id', id);
          if (retryErr) throw new Error(retryErr.message);
        } else if (error) {
          throw new Error(error.message);
        }
      }
      // Re-fetch through admin_get_product so staff without view_prices never receive unredacted price
      const refreshed = await this.getAdminProductById(id);
      if (refreshed) return hydrateProductStockQuantity(refreshed);
      return hydrateProductStockQuantity({ ...(payload as any), id } as AdminProduct);
    }

    const { actor, staffPerms } = getLocalActorContext();
    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS).map(r =>
      hydrateProductStockQuantity(r, true)
    );
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Product not found');
    const existing = products[index];

    validateProductColumnChanges(actor, staffPerms, existing, updates);

    products[index] = { ...existing, ...payload };
    setLocalItem('products', products);
    setStockQuantityOverride(id, products[index].stock_quantity);
    appendLocalActivityLog(actor, 'product.update', 'products', id, {
      name: products[index].name,
      before: {
        price: existing.price,
        stock_status: existing.stock_status,
        stock_quantity: existing.stock_quantity,
        is_active: existing.is_active,
      },
      after: {
        price: products[index].price,
        stock_status: products[index].stock_status,
        stock_quantity: products[index].stock_quantity,
        is_active: products[index].is_active,
      },
    });

    return redactProductPrice(products[index], canPerform(actor, staffPerms, 'products.view_prices'));
  },

  async deleteProduct(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS);
    const target = products.find(p => p.id === id);
    if (!target) throw new Error('Product not found');

    if (!canPerform(actor, staffPerms, 'products.delete') || !canAccessCategoryScope(actor, staffPerms, target.category_id)) {
      throw new Error('You do not have permission to delete this product.');
    }

    const updated = products.filter(p => p.id !== id);
    setLocalItem('products', updated);
    appendLocalActivityLog(actor, 'product.delete', 'products', id, {
      name: target.name,
      before: { price: target.price, stock_status: target.stock_status },
    });
  },

  async bulkUpdateProducts(ids: string[], updates: Partial<Product>): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').update(updates).in('id', ids);
      if (error) throw new Error(error.message);
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'products.bulk_edit')) {
      throw new Error('You do not have permission to bulk edit products.');
    }

    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS);
    for (const id of ids) {
      const existing = products.find(p => p.id === id);
      if (existing) {
        validateProductColumnChanges(actor, staffPerms, existing, updates);
      }
    }

    const updated = products.map(p => (ids.includes(p.id) ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
    setLocalItem('products', updated);
    appendLocalActivityLog(actor, 'product.bulk_update', 'products', null, {
      count: ids.length,
      updates,
    });
  },

  async bulkDeleteProducts(ids: string[]): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw new Error(error.message);
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'products.delete')) {
      throw new Error('You do not have permission to delete products.');
    }

    const products = getLocalItem<Product[]>('products', SEED_PRODUCTS);
    for (const id of ids) {
      const existing = products.find(p => p.id === id);
      if (existing && !canAccessCategoryScope(actor, staffPerms, existing.category_id)) {
        throw new Error('You do not have access to delete one or more selected products.');
      }
    }

    const updated = products.filter(p => !ids.includes(p.id));
    setLocalItem('products', updated);
    appendLocalActivityLog(actor, 'product.bulk_delete', 'products', null, { count: ids.length });
  },

  // CART PRICE AND STOCK RE-VALIDATION
  async verifyCartItems(items: Array<{ product_id: string; qty: number; unit_price: number }>): Promise<{
    hasChanges: boolean;
    hasOutOfStock: boolean;
    updatedItems: OrderItem[];
    changesList: string[];
  }> {
    const products = await this.getProducts({ activeOnly: false });
    const productMap = new Map<string, Product>();
    products.forEach(p => productMap.set(p.id, p));

    const updatedItems: OrderItem[] = [];
    const changesList: string[] = [];
    let hasChanges = false;
    let hasOutOfStock = false;

    for (const item of items) {
      const dbProduct = productMap.get(item.product_id);
      if (!dbProduct || !dbProduct.is_active) {
        hasChanges = true;
        hasOutOfStock = true;
        changesList.push(`"${item.product_id}" is no longer available.`);
        continue;
      }

      if (dbProduct.stock_status === 'out_of_stock') {
        hasChanges = true;
        hasOutOfStock = true;
        changesList.push(`"${dbProduct.name}" is currently out of stock.`);
        continue;
      }

      if (dbProduct.price !== item.unit_price) {
        hasChanges = true;
        changesList.push(
          `Price for "${dbProduct.name}" changed from ₦${item.unit_price.toLocaleString()} to ₦${dbProduct.price.toLocaleString()}`
        );
      }

      const verifiedQty = Math.max(item.qty, dbProduct.min_order_qty);
      if (verifiedQty !== item.qty) {
        hasChanges = true;
        changesList.push(`Minimum order quantity for "${dbProduct.name}" is ${dbProduct.min_order_qty}`);
      }

      updatedItems.push({
        product_id: dbProduct.id,
        name: dbProduct.name,
        qty: verifiedQty,
        unit_price: dbProduct.price,
        line_total: verifiedQty * dbProduct.price,
        image: dbProduct.images[0],
      });
    }

    return {
      hasChanges,
      hasOutOfStock,
      updatedItems,
      changesList,
    };
  },

  // ORDER REQUESTS
  async generateOrderRef(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const orders = getLocalItem<OrderRequest[]>('orders', SEED_ORDERS);
    const count = orders.length + 1;
    return `CEO-${yy}${mm}-${String(count).padStart(4, '0')}`;
  },

  async createOrderRequest(payload: {
    reseller_id: string;
    items: OrderItem[];
    total: number;
    note?: string | null;
  }): Promise<OrderRequest> {
    const ref = await this.generateOrderRef();
    const newOrder: OrderRequest = {
      id: crypto.randomUUID(),
      ref,
      reseller_id: payload.reseller_id,
      items: payload.items,
      total: payload.total,
      note: payload.note || null,
      status: 'new',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('order_requests')
        .insert({
          reseller_id: payload.reseller_id,
          items: payload.items,
          total: payload.total,
          note: payload.note,
          status: 'new',
        })
        .select()
        .single();

      if (!error && data) return data as OrderRequest;
      if (error) throw new Error(error.message);
    }

    const orders = getLocalItem<OrderRequest[]>('orders', SEED_ORDERS);
    orders.unshift(newOrder);
    setLocalItem('orders', orders);
    return newOrder;
  },

  async getOrderRequests(resellerId?: string): Promise<OrderRequest[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('order_requests')
        .select('*, profiles:reseller_id(*)')
        .order('created_at', { ascending: false });
      if (resellerId) {
        query = query.eq('reseller_id', resellerId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map(o => ({
          ...o,
          reseller: o.profiles as Profile,
        }));
      }
      if (error) throw new Error(error.message);
    }

    const { actor, staffPerms } = getLocalActorContext();
    let orders = getLocalItem<OrderRequest[]>('orders', SEED_ORDERS);
    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    orders = orders.map(o => ({
      ...o,
      reseller: o.reseller || profileMap.get(o.reseller_id),
    }));

    if (actor?.role === 'staff') {
      if (!canPerform(actor, staffPerms, 'orders.view')) {
        throw new Error('You do not have permission to view order requests.');
      }
      orders = orders.filter(o => canAccessResellerScope(actor, staffPerms, o.reseller));
    }

    if (resellerId) {
      orders = orders.filter(o => o.reseller_id === resellerId);
    }

    return orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getOrderRequestById(id: string): Promise<OrderRequest | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('order_requests')
        .select('*, profiles:reseller_id(*)')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        return {
          ...data,
          reseller: data.profiles as Profile,
        } as OrderRequest;
      }
    }
    const orders = await this.getOrderRequests();
    return orders.find(o => o.id === id) || null;
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<OrderRequest> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('order_requests')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as OrderRequest;
      if (error) throw new Error(error.message);
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'orders.update_status')) {
      throw new Error('You do not have permission to update order status.');
    }

    const orders = getLocalItem<OrderRequest[]>('orders', SEED_ORDERS);
    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) throw new Error('Order not found');

    const reseller = profiles.find(p => p.id === orders[index].reseller_id);
    if (actor?.role === 'staff' && !canAccessResellerScope(actor, staffPerms, reseller)) {
      throw new Error('You do not have access to this reseller order.');
    }

    const prevStatus = orders[index].status;
    orders[index].status = status;
    setLocalItem('orders', orders);
    appendLocalActivityLog(actor, 'order.update_status', 'order_requests', id, {
      ref: orders[index].ref,
      before: { status: prevStatus },
      after: { status },
    });
    return orders[index];
  },

  // PROFILES & RESELLERS
  async getAllProfilesRaw(): Promise<Profile[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!error && data) return data as Profile[];
      if (error) throw new Error(error.message);
    }
    return getLocalItem<Profile[]>('profiles', SEED_PROFILES);
  },

  async getProfiles(): Promise<Profile[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!error && data) return data as Profile[];
      if (error) throw new Error(error.message);
    }
    const { actor, staffPerms } = getLocalActorContext();
    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    if (actor?.role === 'staff') {
      if (!canPerform(actor, staffPerms, 'resellers.view')) {
        return profiles.filter(p => p.id === actor.id);
      }
      return profiles.filter(p => p.id === actor.id || canAccessResellerScope(actor, staffPerms, p));
    }
    return profiles;
  },

  async getProfileById(id: string): Promise<Profile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data as Profile;
    }
    const { actor, staffPerms } = getLocalActorContext();
    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const target = profiles.find(p => p.id === id) || null;
    if (!target) return null;
    if (actor?.role === 'staff' && target.id !== actor.id) {
      if (!canPerform(actor, staffPerms, 'resellers.view') || !canAccessResellerScope(actor, staffPerms, target)) {
        return null;
      }
    }
    return target;
  },

  async getStaffPermissionsByUserId(userId: string): Promise<StaffPermissionsRecord | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('staff_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) return data as StaffPermissionsRecord;
      return null;
    }
    const list = getLocalItem<StaffPermissionsRecord[]>('staff_permissions', []);
    return list.find(sp => sp.user_id === userId) || null;
  },

  async recordLocalSignIn(userId: string): Promise<void> {
    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const idx = profiles.findIndex(p => p.id === userId);
    if (idx !== -1) {
      profiles[idx].last_sign_in_at = new Date().toISOString();
      setLocalItem('profiles', profiles);
    }
  },

  async createResellerProfile(data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    business_name: string;
    phone: string;
    state: string;
    city: string;
    assigned_staff_id?: string | null;
  }): Promise<Profile> {
    const cleanUsername = data.username.toLowerCase().trim();
    const cleanEmail = data.email.toLowerCase().trim();

    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create_reseller',
          ...data,
          username: cleanUsername,
          email: cleanEmail,
        },
      });
      if (edgeError) {
        throw new Error(edgeError.message || 'Failed to create reseller via admin-users Edge Function.');
      }
      if (edgeData?.error) {
        throw new Error(edgeData.error);
      }
      if (edgeData?.profile) {
        return edgeData.profile as Profile;
      }
      throw new Error('Unexpected response from admin-users Edge Function.');
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'resellers.create')) {
      throw new Error('You do not have permission to create reseller accounts.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    if (profiles.some(p => p.username.toLowerCase() === cleanUsername)) {
      throw new Error('Username already taken');
    }
    if (profiles.some(p => p.email && p.email.toLowerCase() === cleanEmail)) {
      throw new Error('Email address is already registered');
    }

    const assignedStaffId =
      actor?.role === 'staff' && staffPerms?.reseller_scope === 'assigned'
        ? actor.id
        : actor?.role === 'admin'
          ? data.assigned_staff_id || null
          : null;

    const newProfile: Profile = {
      id: crypto.randomUUID(),
      role: 'reseller',
      username: cleanUsername,
      email: cleanEmail,
      full_name: data.full_name,
      business_name: data.business_name,
      phone: data.phone,
      state: data.state,
      city: data.city,
      status: 'active',
      assigned_staff_id: assignedStaffId,
      created_at: new Date().toISOString(),
    };

    profiles.unshift(newProfile);
    setLocalItem('profiles', profiles);

    const passwords = getLocalItem<Record<string, string>>('passwords', {});
    passwords[cleanUsername] = data.password;
    setLocalItem('passwords', passwords);

    appendLocalActivityLog(actor, 'reseller.create', 'reseller', newProfile.id, {
      username: cleanUsername,
      full_name: data.full_name,
      assigned_staff_id: assignedStaffId,
    });

    return newProfile;
  },

  async updateResellerProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'update_profile',
          user_id: id,
          ...(updates.email ? { email: updates.email.toLowerCase().trim() } : {}),
          full_name: updates.full_name,
          business_name: updates.business_name,
          phone: updates.phone,
          state: updates.state,
          city: updates.city,
          ...(updates.assigned_staff_id !== undefined ? { assigned_staff_id: updates.assigned_staff_id } : {}),
        },
      });
      if (!edgeError && edgeData?.profile) {
        return edgeData.profile as Profile;
      }
      if (edgeData?.error) {
        throw new Error(edgeData.error);
      }
      throw new Error(edgeError?.message || 'Failed to update reseller via admin-users Edge Function.');
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'resellers.edit')) {
      throw new Error('You do not have permission to edit resellers.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const index = profiles.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Reseller not found');
    const target = profiles[index];

    if (actor?.role === 'staff' && !canAccessResellerScope(actor, staffPerms, target)) {
      throw new Error('You do not have access to this reseller.');
    }

    const sanitizedUpdates = { ...updates };
    if (actor?.role !== 'admin') {
      delete sanitizedUpdates.assigned_staff_id;
    }

    profiles[index] = { ...target, ...sanitizedUpdates };
    setLocalItem('profiles', profiles);
    appendLocalActivityLog(actor, 'reseller.update', 'reseller', id, {
      username: target.username,
    });
    return profiles[index];
  },

  async setResellerStatus(id: string, status: 'active' | 'suspended'): Promise<Profile> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'set_status', user_id: id, status },
      });
      if (!edgeError && edgeData?.profile) {
        return edgeData.profile as Profile;
      }
      if (edgeData?.error) {
        throw new Error(edgeData.error);
      }
      throw new Error(edgeError?.message || 'Failed to update reseller status via admin-users Edge Function.');
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'resellers.suspend')) {
      throw new Error('You do not have permission to suspend or reactivate resellers.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const index = profiles.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Reseller not found');
    if (actor?.role === 'staff' && !canAccessResellerScope(actor, staffPerms, profiles[index])) {
      throw new Error('You do not have access to this reseller.');
    }

    const prevStatus = profiles[index].status;
    profiles[index].status = status;
    setLocalItem('profiles', profiles);
    appendLocalActivityLog(actor, 'reseller.set_status', 'reseller', id, {
      username: profiles[index].username,
      before: { status: prevStatus },
      after: { status },
    });
    return profiles[index];
  },

  async resetResellerPassword(id: string, newPassword: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'reset_password', user_id: id, new_password: newPassword },
      });
      if (edgeError) {
        throw new Error(edgeError.message || 'Failed to reset password via admin-users Edge Function.');
      }
      if (edgeData?.error) {
        throw new Error(edgeData.error);
      }
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'resellers.reset_password')) {
      throw new Error('You do not have permission to reset reseller passwords.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const reseller = profiles.find(p => p.id === id);
    if (!reseller) throw new Error('Reseller not found');
    if (actor?.role === 'staff' && !canAccessResellerScope(actor, staffPerms, reseller)) {
      throw new Error('You do not have access to this reseller.');
    }

    const passwords = getLocalItem<Record<string, string>>('passwords', {});
    passwords[reseller.username.toLowerCase()] = newPassword;
    setLocalItem('passwords', passwords);
    appendLocalActivityLog(actor, 'reseller.reset_password', 'reseller', id, {
      username: reseller.username,
    });
  },

  async deleteReseller(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete_user', user_id: id },
      });
      if (edgeError) {
        throw new Error(edgeError.message || 'Failed to delete reseller via admin-users Edge Function.');
      }
      if (edgeData?.error) {
        throw new Error(edgeData.error);
      }
      return;
    }

    const { actor, staffPerms } = getLocalActorContext();
    if (!canPerform(actor, staffPerms, 'resellers.delete')) {
      throw new Error('You do not have permission to delete resellers.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const reseller = profiles.find(p => p.id === id);
    if (reseller && actor?.role === 'staff' && !canAccessResellerScope(actor, staffPerms, reseller)) {
      throw new Error('You do not have access to this reseller.');
    }

    const updated = profiles.filter(p => p.id !== id);
    setLocalItem('profiles', updated);

    if (reseller) {
      const passwords = getLocalItem<Record<string, string>>('passwords', {});
      delete passwords[reseller.username.toLowerCase()];
      setLocalItem('passwords', passwords);
      appendLocalActivityLog(actor, 'reseller.delete', 'reseller', id, {
        username: reseller.username,
      });
    }
  },

  // STAFF ADMINS (Super Admin Only)
  async getStaffMembers(): Promise<StaffMember[]> {
    if (isSupabaseConfigured && supabase) {
      const [{ data: profiles, error: pErr }, { data: perms, error: spErr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'staff').order('created_at', { ascending: false }),
        supabase.from('staff_permissions').select('*'),
      ]);
      if (pErr) throw new Error(pErr.message);
      if (spErr) throw new Error(spErr.message);

      const permMap = new Map<string, StaffPermissionsRecord>();
      (perms || []).forEach((sp: any) => permMap.set(sp.user_id, sp as StaffPermissionsRecord));

      return (profiles || []).map((p: any) => ({
        profile: p as Profile,
        staff_permissions: permMap.get(p.id) || {
          user_id: p.id,
          permissions: [],
          category_scope: null,
          reseller_scope: 'all',
          preset: null,
        },
      }));
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES).filter(p => p.role === 'staff');
    const perms = getLocalItem<StaffPermissionsRecord[]>('staff_permissions', []);
    const permMap = new Map(perms.map(sp => [sp.user_id, sp]));
    return profiles.map(p => ({
      profile: p,
      staff_permissions: permMap.get(p.id) || {
        user_id: p.id,
        permissions: [],
        category_scope: null,
        reseller_scope: 'all',
        preset: null,
      },
    }));
  },

  async createStaffAdmin(payload: {
    full_name: string;
    username: string;
    phone: string;
    password: string;
    permissions: PermissionKey[];
    category_scope: string[] | null;
    reseller_scope: ResellerScope;
    preset: string | null;
  }): Promise<StaffMember> {
    const cleanUsername = payload.username.toLowerCase().trim();

    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create_staff',
          ...payload,
          username: cleanUsername,
        },
      });
      if (edgeError) throw new Error(edgeError.message || 'Failed to create staff admin.');
      if (edgeData?.error) throw new Error(edgeData.error);
      return {
        profile: edgeData.profile as Profile,
        staff_permissions: edgeData.permissions as StaffPermissionsRecord,
      };
    }

    const { actor } = getLocalActorContext();
    if (!actor || actor.role !== 'admin') {
      throw new Error('Only Super Admin can create staff admin accounts.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    if (profiles.some(p => p.username.toLowerCase() === cleanUsername)) {
      throw new Error('Username already taken');
    }

    const newProfile: Profile = {
      id: crypto.randomUUID(),
      role: 'staff',
      username: cleanUsername,
      email: `${cleanUsername}@portal.ceopower.local`,
      full_name: payload.full_name.trim(),
      business_name: 'CEO Power Staff',
      phone: payload.phone.trim(),
      state: 'Anambra',
      city: 'Onitsha',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const newPerms: StaffPermissionsRecord = {
      user_id: newProfile.id,
      permissions: payload.permissions,
      category_scope: payload.category_scope && payload.category_scope.length > 0 ? payload.category_scope : null,
      reseller_scope: payload.reseller_scope,
      preset: payload.preset,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    };

    profiles.unshift(newProfile);
    setLocalItem('profiles', profiles);

    const allPerms = getLocalItem<StaffPermissionsRecord[]>('staff_permissions', []);
    allPerms.push(newPerms);
    setLocalItem('staff_permissions', allPerms);

    const passwords = getLocalItem<Record<string, string>>('passwords', {});
    passwords[cleanUsername] = payload.password;
    setLocalItem('passwords', passwords);

    appendLocalActivityLog(actor, 'staff.create', 'staff', newProfile.id, {
      username: cleanUsername,
      full_name: newProfile.full_name,
      preset: payload.preset,
      permissions_count: payload.permissions.length,
    });

    return { profile: newProfile, staff_permissions: newPerms };
  },

  async updateStaffPermissions(payload: {
    user_id: string;
    full_name?: string;
    phone?: string;
    permissions: PermissionKey[];
    category_scope: string[] | null;
    reseller_scope: ResellerScope;
    preset: string | null;
  }): Promise<StaffPermissionsRecord> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'update_staff_permissions',
          ...payload,
        },
      });
      if (edgeError) throw new Error(edgeError.message || 'Failed to update staff permissions.');
      if (edgeData?.error) throw new Error(edgeData.error);
      return edgeData.permissions as StaffPermissionsRecord;
    }

    const { actor } = getLocalActorContext();
    if (!actor || actor.role !== 'admin') {
      throw new Error('Only Super Admin can update staff permissions.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const pIdx = profiles.findIndex(p => p.id === payload.user_id && p.role === 'staff');
    if (pIdx === -1) throw new Error('Staff admin not found');

    if (payload.full_name) profiles[pIdx].full_name = payload.full_name.trim();
    if (payload.phone) profiles[pIdx].phone = payload.phone.trim();
    setLocalItem('profiles', profiles);

    const allPerms = getLocalItem<StaffPermissionsRecord[]>('staff_permissions', []);
    const spIdx = allPerms.findIndex(sp => sp.user_id === payload.user_id);
    const updatedRecord: StaffPermissionsRecord = {
      user_id: payload.user_id,
      permissions: payload.permissions,
      category_scope: payload.category_scope && payload.category_scope.length > 0 ? payload.category_scope : null,
      reseller_scope: payload.reseller_scope,
      preset: payload.preset,
      updated_at: new Date().toISOString(),
      updated_by: actor.id,
    };
    if (spIdx !== -1) {
      allPerms[spIdx] = updatedRecord;
    } else {
      allPerms.push(updatedRecord);
    }
    setLocalItem('staff_permissions', allPerms);

    appendLocalActivityLog(actor, 'staff.update_permissions', 'staff', payload.user_id, {
      username: profiles[pIdx].username,
      preset: payload.preset,
      permissions_count: payload.permissions.length,
    });

    return updatedRecord;
  },

  async resetStaffPassword(userId: string, newPassword: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'reset_staff_password', user_id: userId, new_password: newPassword },
      });
      if (edgeError) throw new Error(edgeError.message || 'Failed to reset staff password.');
      if (edgeData?.error) throw new Error(edgeData.error);
      return;
    }

    const { actor } = getLocalActorContext();
    if (!actor || actor.role !== 'admin') {
      throw new Error('Only Super Admin can reset staff passwords.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const staff = profiles.find(p => p.id === userId && p.role === 'staff');
    if (!staff) throw new Error('Staff admin not found');

    const passwords = getLocalItem<Record<string, string>>('passwords', {});
    passwords[staff.username.toLowerCase()] = newPassword;
    setLocalItem('passwords', passwords);

    appendLocalActivityLog(actor, 'staff.reset_password', 'staff', userId, { username: staff.username });
  },

  async setStaffStatus(userId: string, status: 'active' | 'suspended'): Promise<Profile> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'set_staff_status', user_id: userId, status },
      });
      if (edgeError) throw new Error(edgeError.message || 'Failed to update staff status.');
      if (edgeData?.error) throw new Error(edgeData.error);
      return edgeData.profile as Profile;
    }

    const { actor } = getLocalActorContext();
    if (!actor || actor.role !== 'admin') {
      throw new Error('Only Super Admin can suspend or reactivate staff.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const idx = profiles.findIndex(p => p.id === userId && p.role === 'staff');
    if (idx === -1) throw new Error('Staff admin not found');

    const prevStatus = profiles[idx].status;
    profiles[idx].status = status;
    setLocalItem('profiles', profiles);

    appendLocalActivityLog(actor, 'staff.set_status', 'staff', userId, {
      username: profiles[idx].username,
      before: { status: prevStatus },
      after: { status },
    });

    return profiles[idx];
  },

  async deleteStaffAdmin(userId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete_staff', user_id: userId },
      });
      if (edgeError) throw new Error(edgeError.message || 'Failed to delete staff admin.');
      if (edgeData?.error) throw new Error(edgeData.error);
      return;
    }

    const { actor } = getLocalActorContext();
    if (!actor || actor.role !== 'admin') {
      throw new Error('Only Super Admin can delete staff accounts.');
    }

    const profiles = getLocalItem<Profile[]>('profiles', SEED_PROFILES);
    const staff = profiles.find(p => p.id === userId && p.role === 'staff');
    if (!staff) throw new Error('Staff admin not found');

    setLocalItem('profiles', profiles.filter(p => p.id !== userId));
    const perms = getLocalItem<StaffPermissionsRecord[]>('staff_permissions', []);
    setLocalItem('staff_permissions', perms.filter(sp => sp.user_id !== userId));

    const passwords = getLocalItem<Record<string, string>>('passwords', {});
    delete passwords[staff.username.toLowerCase()];
    setLocalItem('passwords', passwords);

    appendLocalActivityLog(actor, 'staff.delete', 'staff', userId, { username: staff.username });
  },

  // ACTIVITY LOGS (Super Admin Only)
  async getActivityLogs(): Promise<AdminActivityLog[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('*, actor:actor_id(id, username, full_name, role)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && data) return data as AdminActivityLog[];
      if (error) throw new Error(error.message);
    }
    return getLocalItem<AdminActivityLog[]>('activity_log', []);
  },

  // IMAGE UPLOADS
  async uploadProductImage(file: File): Promise<string> {
    const { file: compressedFile, dataUrl } = await compressProductImage(file);

    if (isSupabaseConfigured && supabase) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
      const { data, error } = await supabase.storage.from('product-images').upload(fileName, compressedFile, {
        contentType: 'image/webp',
        upsert: false,
      });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
        return publicUrlData.publicUrl;
      }
      if (error) {
        throw new Error(error.message);
      }
    }

    return dataUrl;
  },

  // AUTOMATED LOW-STOCK THRESHOLD & ADMIN NOTIFICATIONS
  async getLowStockThreshold(): Promise<number> {
    const settings = await this.getSettings();
    return normalizeLowStockThreshold(settings.low_stock_threshold);
  },

  async updateLowStockThreshold(newThreshold: number): Promise<number> {
    const normalized = normalizeLowStockThreshold(newThreshold);
    const currentSettings = getLocalItem<CompanySettings>('settings', SEED_SETTINGS);
    setLocalItem('settings', { ...currentSettings, low_stock_threshold: String(normalized) });

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'low_stock_threshold', value: String(normalized) });
      // Do not fail UI if staff has products.edit_stock without settings.edit before SQL policy runs
      if (error) {
        const msg = error.message?.toLowerCase() || '';
        const isPolicyBlock = msg.includes('row-level security') || msg.includes('permission');
        if (!isPolicyBlock) {
          throw new Error(error.message);
        }
      }
    }

    const { actor } = getLocalActorContext();
    appendLocalActivityLog(actor, 'settings.low_stock_threshold', 'settings', 'low_stock_threshold', {
      after: { low_stock_threshold: normalized },
    });

    return normalized;
  },

  async getInventoryAlerts(existingProducts?: AdminProduct[]): Promise<{
    threshold: number;
    notifications: AdminNotification[];
    unreadCount: number;
    totalAlertCount: number;
    outOfStockCount: number;
    lowStockCount: number;
  }> {
    const [threshold, products] = await Promise.all([
      this.getLowStockThreshold(),
      existingProducts ? Promise.resolve(existingProducts) : this.getAdminProducts().catch(() => [] as AdminProduct[]),
    ]);

    const evalResult = evaluateLowStockAlerts(products, threshold);
    const dismissed = new Set(getLocalItem<string[]>('dismissed_low_stock_alerts', []));

    // Optionally check server admin_notifications table if present for timestamps/read states
    let serverRows: any[] = [];
    if (isSupabaseConfigured && supabase && !notificationsTableMissing) {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        serverRows = data;
      } else {
        const msg = error?.message?.toLowerCase() || '';
        const code = (error as any)?.code || '';
        if (code === 'PGRST205' || code === '42P01' || msg.includes('admin_notifications')) {
          notificationsTableMissing = true;
        }
      }
    }

    const serverByProduct = new Map<string, any>();
    for (const row of serverRows) {
      if (row.product_id && !serverByProduct.has(row.product_id)) {
        serverByProduct.set(row.product_id, row);
      }
    }

    const notifications: AdminNotification[] = evalResult.alerts.map(product => {
      const outOfStock = isProductOutOfStock(product);
      const fingerprint = buildAlertFingerprint(product, threshold);
      const serverMatch = serverByProduct.get(product.id);
      const qtyLabel =
        typeof product.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)
          ? `${product.stock_quantity} unit${product.stock_quantity === 1 ? '' : 's'} remaining`
          : outOfStock
            ? 'Marked Out of Stock'
            : 'Marked Low Stock';

      return {
        id: serverMatch?.id || `alert-${product.id}`,
        type: outOfStock ? 'out_of_stock' : 'low_stock',
        title: outOfStock ? 'Out of Stock Alert' : 'Low Stock Alert',
        message: `${qtyLabel} (threshold: ${threshold} units)`,
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        stock_quantity: typeof product.stock_quantity === 'number' ? product.stock_quantity : null,
        stock_status: product.stock_status,
        threshold,
        fingerprint,
        is_read: dismissed.has(fingerprint),
        created_at: serverMatch?.created_at || product.updated_at || new Date().toISOString(),
      };
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return {
      threshold,
      notifications,
      unreadCount,
      totalAlertCount: evalResult.totalAlertCount,
      outOfStockCount: evalResult.outOfStockCount,
      lowStockCount: evalResult.lowStockCount,
    };
  },

  async dismissInventoryAlert(fingerprint: string, notificationId?: string): Promise<void> {
    const dismissed = getLocalItem<string[]>('dismissed_low_stock_alerts', []);
    if (!dismissed.includes(fingerprint)) {
      setLocalItem('dismissed_low_stock_alerts', [fingerprint, ...dismissed].slice(0, 300));
    }
    if (isSupabaseConfigured && supabase && !notificationsTableMissing && notificationId && !notificationId.startsWith('alert-')) {
      await supabase.from('admin_notifications').update({ is_read: true }).eq('id', notificationId);
    }
  },

  async acknowledgeAllLowStockAlerts(notifications: AdminNotification[]): Promise<void> {
    const existing = new Set(getLocalItem<string[]>('dismissed_low_stock_alerts', []));
    notifications.forEach(n => existing.add(n.fingerprint));
    setLocalItem('dismissed_low_stock_alerts', Array.from(existing).slice(0, 300));

    if (isSupabaseConfigured && supabase && !notificationsTableMissing) {
      await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
    }
  },

  async clearDismissedLowStockAlerts(): Promise<void> {
    setLocalItem('dismissed_low_stock_alerts', []);
  },
};

