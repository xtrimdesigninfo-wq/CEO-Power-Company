import { AdminProduct, Brand, Category, Product, StockStatus } from '../types';
import { parseCsvRows } from './csvParser';
import { slugify } from './utils';

export const BULK_IMPORT_LOW_STOCK_THRESHOLD = 5;

export const BULK_IMPORT_HEADERS = [
  'category',
  'brand',
  'name',
  'sku',
  'slug',
  'short_description',
  'trade_price',
  'moq',
  'stock_quantity',
  'stock_status',
  'active',
  'featured',
  'featured_image_url',
  'other_image_urls',
  'specs',
] as const;

export type BulkImportField = (typeof BULK_IMPORT_HEADERS)[number];

export type BulkRowSeverity = 'valid' | 'warning' | 'error';
export type DuplicateStrategy = 'skip' | 'update';
export type BulkRowAction = 'create' | 'update' | 'skip' | 'invalid';

export interface RawBulkImportRow {
  rowNumber: number;
  rawValues: Record<BulkImportField, string>;
}

export interface MissingBrandTarget {
  categoryId: string;
  categoryName: string;
  brandName: string;
  key: string;
}

export interface DuplicateMatchResult {
  product: Pick<AdminProduct, 'id' | 'name' | 'sku' | 'slug' | 'images'>;
  matchedBy: 'sku' | 'slug';
}

export interface ValidatedBulkImportRow {
  rowNumber: number;
  rawValues: Record<BulkImportField, string>;
  severity: BulkRowSeverity;
  action: BulkRowAction;
  errors: string[];
  warnings: string[];
  notes: string[];
  categoryId?: string;
  categoryName: string;
  brandName: string;
  isMissingBrand: boolean;
  name: string;
  sku: string;
  slug: string;
  shortDescription: string;
  tradePrice: number | null;
  moq: number;
  stockQuantity: number;
  stockStatus: StockStatus;
  isActive: boolean;
  isFeatured: boolean;
  featuredImageUrl: string;
  otherImageUrls: string[];
  specs: Record<string, string>;
  duplicateMatch: DuplicateMatchResult | null;
}

export interface BulkValidationSummary {
  rows: ValidatedBulkImportRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
  skipCount: number;
  importableCount: number;
  missingBrands: MissingBrandTarget[];
}

export interface BulkValidationContext {
  categories: Category[];
  brands: Brand[];
  existingProducts: Array<
    Pick<AdminProduct, 'id' | 'name' | 'sku' | 'slug' | 'category_id' | 'brand' | 'images'>
  >;
  duplicateStrategy: DuplicateStrategy;
  autoCreateMissingBrands: boolean;
  lowStockThreshold?: number;
  allowedCategoryIds?: Set<string> | null;
}

const IGNORED_REPORT_HEADERS = new Set(['row_number', 'status', 'error_reasons', 'reasons']);

const HEADER_ALIASES: Record<string, BulkImportField> = {
  category: 'category',
  category_name: 'category',
  brand: 'brand',
  brand_name: 'brand',
  sub_category: 'brand',
  subcategory: 'brand',
  name: 'name',
  product_name: 'name',
  title: 'name',
  sku: 'sku',
  sku_code: 'sku',
  slug: 'slug',
  url_slug: 'slug',
  short_description: 'short_description',
  short_desc: 'short_description',
  description: 'short_description',
  summary: 'short_description',
  trade_price: 'trade_price',
  price: 'trade_price',
  wholesale_price: 'trade_price',
  price_ngn: 'trade_price',
  trade_price_ngn: 'trade_price',
  moq: 'moq',
  min_order_qty: 'moq',
  minimum_order_qty: 'moq',
  minimum_order_quantity: 'moq',
  stock_quantity: 'stock_quantity',
  stock_qty: 'stock_quantity',
  quantity: 'stock_quantity',
  qty: 'stock_quantity',
  inventory: 'stock_quantity',
  stock_status: 'stock_status',
  status: 'stock_status',
  stock: 'stock_status',
  availability: 'stock_status',
  active: 'active',
  is_active: 'active',
  featured: 'featured',
  is_featured: 'featured',
  featured_image_url: 'featured_image_url',
  featured_image: 'featured_image_url',
  main_image_url: 'featured_image_url',
  main_image: 'featured_image_url',
  image_url: 'featured_image_url',
  image: 'featured_image_url',
  other_image_urls: 'other_image_urls',
  other_images: 'other_image_urls',
  gallery_image_urls: 'other_image_urls',
  gallery_images: 'other_image_urls',
  additional_images: 'other_image_urls',
  specs: 'specs',
  specifications: 'specs',
  technical_specs: 'specs',
  technical_specifications: 'specs',
};

export function normalizeBulkHeader(header: string): string {
  return (header || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function cleanBulkPrice(
  raw: unknown
): { value: number | null; valid: boolean; reason?: string } {
  const str = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!str) {
    return { value: null, valid: false, reason: 'missing trade_price' };
  }
  const stripped = str
    .replace(/ngn/gi, '')
    .replace(/[₦,\s]/g, '')
    .trim();
  if (!stripped || !/^-?\d+(\.\d+)?$/.test(stripped)) {
    return { value: null, valid: false, reason: 'trade_price is not a number' };
  }
  const num = Number(stripped);
  if (!Number.isFinite(num) || num < 0) {
    return { value: null, valid: false, reason: 'trade_price is not a number' };
  }
  return { value: Math.round(num * 100) / 100, valid: true };
}

export function parseYesNoBoolean(
  raw: unknown,
  defaultValue: boolean
): { value: boolean; valid: boolean } {
  const str = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!str) {
    return { value: defaultValue, valid: true };
  }
  const norm = str.toLowerCase();
  if (norm === 'yes' || norm === 'y' || norm === 'true' || norm === '1') {
    return { value: true, valid: true };
  }
  if (norm === 'no' || norm === 'n' || norm === 'false' || norm === '0') {
    return { value: false, valid: true };
  }
  return { value: defaultValue, valid: false };
}

export function parseWholeNumber(
  raw: unknown
): { value: number | null; empty: boolean; valid: boolean } {
  const str = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!str) {
    return { value: null, empty: true, valid: false };
  }
  const cleaned = str.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) {
    return { value: null, empty: false, valid: false };
  }
  const num = parseInt(cleaned, 10);
  if (!Number.isSafeInteger(num) || num < 0) {
    return { value: null, empty: false, valid: false };
  }
  return { value: num, empty: false, valid: true };
}

export function deriveBulkStockStatus(
  quantity: number,
  lowStockThreshold = BULK_IMPORT_LOW_STOCK_THRESHOLD
): StockStatus {
  const safeThreshold = Math.max(1, Math.floor(lowStockThreshold));
  const safeQty = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (safeQty <= 0) return 'out_of_stock';
  if (safeQty < safeThreshold) return 'low_stock';
  return 'in_stock';
}

export function parseBulkStockStatus(
  raw: unknown
): { value?: StockStatus; empty: boolean; valid: boolean } {
  const str = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!str) {
    return { empty: true, valid: true };
  }
  const norm = str.toLowerCase().replace(/[\s\-]+/g, '_');
  if (norm === 'in_stock' || norm === 'instock') {
    return { value: 'in_stock', empty: false, valid: true };
  }
  if (norm === 'low_stock' || norm === 'lowstock') {
    return { value: 'low_stock', empty: false, valid: true };
  }
  if (norm === 'out_of_stock' || norm === 'outofstock') {
    return { value: 'out_of_stock', empty: false, valid: true };
  }
  return { empty: false, valid: false };
}

export function parseBulkSpecs(raw: unknown): Record<string, string> {
  const str = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!str) return {};

  const out: Record<string, string> = {};
  for (const segment of str.split('|')) {
    const colonIdx = segment.indexOf(':');
    if (colonIdx > 0) {
      const key = segment.slice(0, colonIdx).trim();
      const val = segment.slice(colonIdx + 1).trim();
      if (key) {
        out[key] = val;
      }
    }
  }
  return out;
}

export function generateUniqueSlug(
  baseInput: string,
  existingSlugs: Iterable<string>
): string {
  const base = slugify(baseInput || '') || 'product';
  const used = new Set<string>();
  for (const s of existingSlugs) {
    if (s) used.add(s.trim().toLowerCase());
  }
  if (!used.has(base.toLowerCase())) {
    return base;
  }
  let counter = 2;
  while (used.has(`${base}-${counter}`.toLowerCase())) {
    counter++;
  }
  return `${base}-${counter}`;
}

export function isValidPublicHttpUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function findExistingProductMatch(
  candidate: { sku?: string | null; slug?: string | null },
  existingProducts: Array<
    Pick<AdminProduct, 'id' | 'name' | 'sku' | 'slug' | 'images'>
  >
): DuplicateMatchResult | null {
  const cleanSku = (candidate.sku || '').trim().toLowerCase();
  if (cleanSku) {
    const bySku = existingProducts.find(
      p => p.sku && p.sku.trim().toLowerCase() === cleanSku
    );
    if (bySku) {
      return { product: bySku, matchedBy: 'sku' };
    }
  }

  const cleanSlug = (candidate.slug || '').trim().toLowerCase();
  if (cleanSlug) {
    const bySlug = existingProducts.find(
      p => p.slug && p.slug.trim().toLowerCase() === cleanSlug
    );
    if (bySlug) {
      return { product: bySlug, matchedBy: 'slug' };
    }
  }

  return null;
}

function emptyRawValues(): Record<BulkImportField, string> {
  return {
    category: '',
    brand: '',
    name: '',
    sku: '',
    slug: '',
    short_description: '',
    trade_price: '',
    moq: '',
    stock_quantity: '',
    stock_status: '',
    active: '',
    featured: '',
    featured_image_url: '',
    other_image_urls: '',
    specs: '',
  };
}

export function parseBulkRowsFromTable(tableRows: string[][]): RawBulkImportRow[] {
  if (!tableRows || tableRows.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  const headerCells = tableRows[0] || [];
  const columnFieldMap = new Map<number, BulkImportField>();

  headerCells.forEach((rawHeader, idx) => {
    const normalized = normalizeBulkHeader(rawHeader);
    if (!normalized || IGNORED_REPORT_HEADERS.has(normalized)) return;
    const mapped = HEADER_ALIASES[normalized];
    if (mapped && !Array.from(columnFieldMap.values()).includes(mapped)) {
      columnFieldMap.set(idx, mapped);
    }
  });

  if (columnFieldMap.size === 0) {
    throw new Error(
      'No recognized bulk product columns were found in the header row.'
    );
  }

  if (tableRows.length < 2) {
    throw new Error('The uploaded file must include at least one product row below the header.');
  }

  const parsedRows: RawBulkImportRow[] = [];
  for (let i = 1; i < tableRows.length; i++) {
    const row = tableRows[i];
    if (!row || !row.some(cell => String(cell ?? '').trim().length > 0)) {
      continue;
    }
    const rawValues = emptyRawValues();
    columnFieldMap.forEach((field, colIdx) => {
      rawValues[field] = String(row[colIdx] ?? '').trim();
    });
    parsedRows.push({
      rowNumber: i + 1,
      rawValues,
    });
  }

  if (parsedRows.length === 0) {
    throw new Error('No non-empty product rows were found in the file.');
  }

  return parsedRows;
}

export function parseBulkCsvText(csvText: string): RawBulkImportRow[] {
  const rows = parseCsvRows(csvText);
  return parseBulkRowsFromTable(rows);
}

export async function parseBulkSpreadsheetBuffer(buffer: ArrayBuffer): Promise<RawBulkImportRow[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('No worksheets found inside the uploaded spreadsheet.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  const stringRows = rawMatrix.map(row =>
    (Array.isArray(row) ? row : []).map(cell =>
      cell === null || cell === undefined ? '' : String(cell)
    )
  );
  return parseBulkRowsFromTable(stringRows);
}

export async function parseBulkProductFile(file: File): Promise<RawBulkImportRow[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return await parseBulkSpreadsheetBuffer(buffer);
  }
  const text = await file.text();
  return parseBulkCsvText(text);
}

export function validateBulkImportRows(
  rawRows: RawBulkImportRow[],
  context: BulkValidationContext
): BulkValidationSummary {
  const lowStockThreshold = context.lowStockThreshold ?? BULK_IMPORT_LOW_STOCK_THRESHOLD;
  const usedSlugsForNewCreates = new Set<string>(
    context.existingProducts.map(p => (p.slug || '').trim().toLowerCase()).filter(Boolean)
  );
  const seenBatchSkus = new Map<string, number>();
  const missingBrandsMap = new Map<string, MissingBrandTarget>();

  const rows: ValidatedBulkImportRow[] = rawRows.map(({ rowNumber, rawValues }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const notes: string[] = [];

    // 1. Category (required; exact case-insensitive match against existing category name)
    const rawCat = rawValues.category.trim();
    let matchedCategory: Category | undefined;
    if (!rawCat) {
      errors.push('missing category');
    } else {
      matchedCategory = context.categories.find(
        c => c.name.trim().toLowerCase() === rawCat.toLowerCase()
      );
      if (!matchedCategory) {
        errors.push(`Category '${rawCat}' not found`);
      } else if (
        context.allowedCategoryIds &&
        !context.allowedCategoryIds.has(matchedCategory.id)
      ) {
        errors.push(`No permission for category '${matchedCategory.name}'`);
      }
    }

    // 2. Brand (optional; must match existing brand under that category unless autoCreateMissingBrands is enabled)
    const rawBrand = rawValues.brand.trim();
    let resolvedBrand = '';
    let isMissingBrand = false;
    if (rawBrand) {
      if (matchedCategory) {
        const matchedBrand = context.brands.find(
          b =>
            b.category_id === matchedCategory!.id &&
            b.name.trim().toLowerCase() === rawBrand.toLowerCase()
        );
        if (matchedBrand) {
          resolvedBrand = matchedBrand.name;
        } else {
          isMissingBrand = true;
          resolvedBrand = rawBrand;
          const key = `${matchedCategory.id}::${rawBrand.toLowerCase()}`;
          if (!missingBrandsMap.has(key)) {
            missingBrandsMap.set(key, {
              categoryId: matchedCategory.id,
              categoryName: matchedCategory.name,
              brandName: rawBrand,
              key,
            });
          }
          if (context.autoCreateMissingBrands) {
            notes.push(`Will auto-create brand '${rawBrand}' under '${matchedCategory.name}'`);
          } else {
            errors.push(`Brand '${rawBrand}' not found under '${matchedCategory.name}'`);
          }
        }
      } else {
        resolvedBrand = rawBrand;
      }
    }

    // 3. Name (required)
    const name = rawValues.name.trim();
    if (!name) {
      errors.push('missing name');
    }

    // 4. Trade Price (required)
    const priceRes = cleanBulkPrice(rawValues.trade_price);
    if (!priceRes.valid) {
      errors.push(priceRes.reason || 'trade_price is not a number');
    }

    // 5. MOQ (required whole number, default 1 if empty)
    let moq = 1;
    if (rawValues.moq.trim()) {
      const moqRes = parseWholeNumber(rawValues.moq);
      if (!moqRes.valid || moqRes.value === null || moqRes.value < 1) {
        errors.push('moq must be a whole number of at least 1');
      } else {
        moq = moqRes.value;
      }
    }

    // 6. Stock quantity (required whole number >= 0)
    let stockQuantity = 0;
    const stockQtyRes = parseWholeNumber(rawValues.stock_quantity);
    if (stockQtyRes.empty) {
      errors.push('missing stock_quantity');
    } else if (!stockQtyRes.valid || stockQtyRes.value === null) {
      errors.push('stock_quantity must be a whole number');
    } else {
      stockQuantity = stockQtyRes.value;
    }

    // 7. Stock status (optional; derive using < 5 rule if empty)
    const stockStatusRes = parseBulkStockStatus(rawValues.stock_status);
    let stockStatus: StockStatus = deriveBulkStockStatus(stockQuantity, lowStockThreshold);
    if (!stockStatusRes.empty) {
      if (stockStatusRes.valid && stockStatusRes.value) {
        stockStatus = stockStatusRes.value;
      } else {
        warnings.push(
          `Invalid stock_status '${rawValues.stock_status}' — calculated from stock_quantity`
        );
      }
    }

    // 8. Active (default yes) & Featured (default no)
    const activeRes = parseYesNoBoolean(rawValues.active, true);
    if (!activeRes.valid) {
      warnings.push(`Invalid active value '${rawValues.active}' — defaulted to yes`);
    }
    const featuredRes = parseYesNoBoolean(rawValues.featured, false);
    if (!featuredRes.valid) {
      warnings.push(`Invalid featured value '${rawValues.featured}' — defaulted to no`);
    }

    // 9. Featured image URL (required)
    const featuredImageUrl = rawValues.featured_image_url.trim();
    if (!featuredImageUrl) {
      errors.push('missing featured_image_url');
    } else if (!isValidPublicHttpUrl(featuredImageUrl)) {
      errors.push('featured_image_url is not a valid URL');
    }

    // 10. Other image URLs (optional; up to 3 separated by |)
    const otherImageUrls: string[] = [];
    if (rawValues.other_image_urls.trim()) {
      const splitUrls = rawValues.other_image_urls
        .split('|')
        .map(u => u.trim())
        .filter(Boolean);
      if (splitUrls.length > 3) {
        warnings.push(`More than 3 other_image_urls (${splitUrls.length}) — using first 3`);
      }
      for (const candidateUrl of splitUrls.slice(0, 3)) {
        if (isValidPublicHttpUrl(candidateUrl)) {
          otherImageUrls.push(candidateUrl);
        } else {
          warnings.push(`Ignored invalid gallery URL '${candidateUrl}'`);
        }
      }
    }

    // 11. Specs
    const specs = parseBulkSpecs(rawValues.specs);

    // 12. SKU, Slug & Duplicate Matching (SKU first, then slug)
    const sku = rawValues.sku.trim();
    const rawSlug = rawValues.slug.trim();
    const initialSlug = rawSlug ? slugify(rawSlug) : name ? slugify(name) : '';

    const duplicateMatch = findExistingProductMatch(
      { sku, slug: initialSlug },
      context.existingProducts
    );

    if (sku) {
      const skuKey = sku.toLowerCase();
      const earlierRow = seenBatchSkus.get(skuKey);
      if (earlierRow !== undefined) {
        warnings.push(`Duplicate SKU '${sku}' also appears in row ${earlierRow}`);
      } else {
        seenBatchSkus.set(skuKey, rowNumber);
      }
    }

    let finalSlug = initialSlug;
    let action: BulkRowAction;

    if (errors.length > 0) {
      action = 'invalid';
    } else if (duplicateMatch) {
      if (context.duplicateStrategy === 'skip') {
        action = 'skip';
        notes.push(
          `Existing product matched by ${duplicateMatch.matchedBy.toUpperCase()} — will skip`
        );
      } else {
        action = 'update';
        finalSlug = rawSlug ? slugify(rawSlug) : duplicateMatch.product.slug;
        notes.push(
          `Existing product matched by ${duplicateMatch.matchedBy.toUpperCase()} — will update`
        );
      }
    } else {
      action = 'create';
      finalSlug = generateUniqueSlug(initialSlug || name || `product-${rowNumber}`, usedSlugsForNewCreates);
      usedSlugsForNewCreates.add(finalSlug.toLowerCase());
    }

    const severity: BulkRowSeverity =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

    return {
      rowNumber,
      rawValues,
      severity,
      action,
      errors,
      warnings,
      notes,
      categoryId: matchedCategory?.id,
      categoryName: matchedCategory?.name || rawCat,
      brandName: resolvedBrand,
      isMissingBrand,
      name,
      sku,
      slug: finalSlug,
      shortDescription: rawValues.short_description.trim(),
      tradePrice: priceRes.value,
      moq,
      stockQuantity,
      stockStatus,
      isActive: activeRes.value,
      isFeatured: featuredRes.value,
      featuredImageUrl,
      otherImageUrls,
      specs,
      duplicateMatch,
    };
  });

  const validCount = rows.filter(r => r.severity === 'valid' && r.action !== 'skip').length;
  const warningCount = rows.filter(r => r.severity === 'warning' && r.action !== 'skip').length;
  const errorCount = rows.filter(r => r.severity === 'error').length;
  const skipCount = rows.filter(r => r.action === 'skip').length;
  const importableCount = rows.filter(
    r => r.severity !== 'error' && (r.action === 'create' || r.action === 'update')
  ).length;

  return {
    rows,
    validCount,
    warningCount,
    errorCount,
    skipCount,
    importableCount,
    missingBrands: Array.from(missingBrandsMap.values()),
  };
}

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateBulkProductTemplateCsv(): string {
  const headerLine = BULK_IMPORT_HEADERS.join(',');
  const exampleRows = [
    [
      'Solar Panels',
      'ZN Shine',
      'ZN Shine 600W Bifacial Solar Panel',
      'ZNS-600W-BF-EX',
      '',
      'High-efficiency 600W Tier-1 monocrystalline solar module for commercial and residential rooftops.',
      '155000',
      '1',
      '25',
      'In Stock',
      'yes',
      'yes',
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80',
      'Wattage: 600W | Cell Type: Mono | Warranty: 25 Years',
    ],
    [
      'Inverters',
      'Deye',
      'Deye 5kVA Hybrid Inverter 48V',
      'DEYE-5K-HYB-EX',
      '',
      'Single-phase 5kW low-voltage hybrid inverter with dual MPPT trackers and generator auto-start.',
      '₦1,250,000',
      '1',
      '3',
      '',
      'yes',
      'no',
      'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
      '',
      'Rated Power: 5000W | Battery Voltage: 48V DC | Warranty: 5 Years',
    ],
  ];

  const lines = [headerLine, ...exampleRows.map(row => row.map(escapeCsvCell).join(','))];
  return lines.join('\n');
}

export interface BulkImportFailureReportEntry {
  rowNumber: number;
  status: 'Error' | 'Failed' | 'Warning';
  reasons: string[];
  rawValues: Record<BulkImportField, string>;
}

export function generateBulkErrorReportCsv(
  entries: BulkImportFailureReportEntry[]
): string {
  const headers = ['row_number', 'status', 'error_reasons', ...BULK_IMPORT_HEADERS];
  const lines = [
    headers.join(','),
    ...entries.map(entry =>
      [
        String(entry.rowNumber),
        entry.status,
        entry.reasons.join('; '),
        ...BULK_IMPORT_HEADERS.map(col => entry.rawValues[col] ?? ''),
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];
  return lines.join('\n');
}

function inferImageMimeType(blobType: string, url: string): string | null {
  const lowerType = (blobType || '').toLowerCase().split(';')[0].trim();
  if (lowerType === 'image/jpeg' || lowerType === 'image/jpg') return 'image/jpeg';
  if (lowerType === 'image/png') return 'image/png';
  if (lowerType === 'image/webp') return 'image/webp';
  if (lowerType.startsWith('text/') || lowerType.includes('html') || lowerType.includes('json')) {
    return null;
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  } catch {
    // ignore URL parse error
  }

  if (!lowerType || lowerType === 'application/octet-stream' || lowerType.startsWith('image/')) {
    return 'image/jpeg';
  }
  return null;
}

async function normalizeDownloadToUploadableFile(blob: Blob, url: string, idx: number): Promise<File> {
  const inferredMime = inferImageMimeType(blob.type, url);
  if (!inferredMime) {
    throw new Error('Response is not a supported image.');
  }

  // Verify the downloaded payload actually decodes as a visual image (catches HTML error pages)
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;

    if (
      blob.type &&
      !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
        blob.type.toLowerCase().split(';')[0].trim()
      ) &&
      typeof document !== 'undefined'
    ) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const convertedBlob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/webp', 0.9)
        );
        if (convertedBlob && convertedBlob.size > 0) {
          return new File([convertedBlob], `import-img-${idx}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
        }
      }
    }
    bitmap.close();
    if (width <= 0 || height <= 0) {
      throw new Error('Downloaded image has invalid dimensions.');
    }
  }

  const ext =
    inferredMime === 'image/png' ? 'png' : inferredMime === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `import-img-${idx}.${ext}`, {
    type: inferredMime,
    lastModified: Date.now(),
  });
}

export async function downloadAndCompressImageFromUrl(
  url: string,
  uploadProductImage: (file: File) => Promise<string>,
  idx = 0,
  timeoutMs = 15000
): Promise<string> {
  if (!isValidPublicHttpUrl(url)) {
    throw new Error('Invalid image URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Empty image payload');
    }
    const file = await normalizeDownloadToUploadableFile(blob, url, idx);
    return await uploadProductImage(file);
  } finally {
    clearTimeout(timer);
  }
}

export interface BulkImportExecutionResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  imageWarningCount: number;
  imageWarnings: Array<{ rowNumber: number; name: string; reason: string }>;
  reportEntries: BulkImportFailureReportEntry[];
}

export interface BulkImportProgress {
  completed: number;
  total: number;
  currentProductName: string;
}

export async function executeBulkProductImport(
  validation: BulkValidationSummary,
  options: {
    autoCreateMissingBrands: boolean;
    createBrand: (input: { category_id: string; name: string }) => Promise<Brand>;
    createProduct: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>;
    updateProduct: (id: string, updates: Partial<Product>) => Promise<AdminProduct>;
    uploadProductImage: (file: File) => Promise<string>;
    onProgress?: (progress: BulkImportProgress) => void;
  }
): Promise<BulkImportExecutionResult> {
  const createdBrandsCache = new Map<string, string>();
  const reportEntries: BulkImportFailureReportEntry[] = [];
  const imageWarnings: Array<{ rowNumber: number; name: string; reason: string }> = [];

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let imageWarningCount = 0;

  // Record validation-stage Error rows into report & skipped count
  for (const row of validation.rows) {
    if (row.severity === 'error') {
      skipped++;
      reportEntries.push({
        rowNumber: row.rowNumber,
        status: 'Error',
        reasons: row.errors,
        rawValues: row.rawValues,
      });
    } else if (row.action === 'skip') {
      skipped++;
    }
  }

  const importQueue = validation.rows.filter(
    r => r.severity !== 'error' && (r.action === 'create' || r.action === 'update')
  );

  for (let i = 0; i < importQueue.length; i++) {
    const row = importQueue[i];
    options.onProgress?.({
      completed: i,
      total: importQueue.length,
      currentProductName: row.name,
    });

    try {
      // 1. Auto-create missing brand if enabled and needed
      let brandToSave = row.brandName;
      if (row.isMissingBrand && options.autoCreateMissingBrands && row.categoryId && row.brandName) {
        const cacheKey = `${row.categoryId}::${row.brandName.toLowerCase()}`;
        if (createdBrandsCache.has(cacheKey)) {
          brandToSave = createdBrandsCache.get(cacheKey)!;
        } else {
          try {
            const newBrand = await options.createBrand({
              category_id: row.categoryId,
              name: row.brandName,
            });
            brandToSave = newBrand.name;
            createdBrandsCache.set(cacheKey, newBrand.name);
          } catch {
            // If concurrent or already created, proceed with row.brandName
            createdBrandsCache.set(cacheKey, row.brandName);
          }
        }
      }

      // 2. Download & compress featured image + up to 3 other images
      let imageFailed = false;
      let featuredSavedUrl: string | null = null;
      const otherSavedUrls: string[] = [];

      if (row.featuredImageUrl) {
        try {
          featuredSavedUrl = await downloadAndCompressImageFromUrl(
            row.featuredImageUrl,
            options.uploadProductImage,
            0
          );
        } catch {
          imageFailed = true;
        }
      }

      for (let imgIdx = 0; imgIdx < row.otherImageUrls.length; imgIdx++) {
        try {
          const uploadedUrl = await downloadAndCompressImageFromUrl(
            row.otherImageUrls[imgIdx],
            options.uploadProductImage,
            imgIdx + 1
          );
          otherSavedUrls.push(uploadedUrl);
        } catch {
          imageFailed = true;
        }
      }

      const combinedImages = [
        ...(featuredSavedUrl ? [featuredSavedUrl] : []),
        ...otherSavedUrls,
      ].slice(0, 4);

      if (imageFailed) {
        imageWarningCount++;
        imageWarnings.push({
          rowNumber: row.rowNumber,
          name: row.name,
          reason: 'Image failed — upload manually',
        });
        reportEntries.push({
          rowNumber: row.rowNumber,
          status: 'Warning',
          reasons: ['Image failed — upload manually'],
          rawValues: row.rawValues,
        });
      }

      if (!row.categoryId || row.tradePrice === null) {
        throw new Error('Missing validated category or trade price.');
      }

      if (row.action === 'update' && row.duplicateMatch) {
        const updatePayload: Partial<Product> = {
          category_id: row.categoryId,
          name: row.name,
          slug: row.slug,
          brand: brandToSave,
          sku: row.sku,
          short_description: row.shortDescription,
          specs: row.specs,
          price: row.tradePrice,
          min_order_qty: row.moq,
          stock_quantity: row.stockQuantity,
          stock_status: row.stockStatus,
          is_active: row.isActive,
          is_featured: row.isFeatured,
        };
        if (combinedImages.length > 0) {
          updatePayload.images = combinedImages;
        } else if (imageFailed) {
          // Preserve existing images if replacement image download failed; if none existed, set []
          updatePayload.images = row.duplicateMatch.product.images || [];
        }
        await options.updateProduct(row.duplicateMatch.product.id, updatePayload);
        updated++;
      } else {
        await options.createProduct({
          category_id: row.categoryId,
          name: row.name,
          slug: row.slug,
          brand: brandToSave,
          sku: row.sku,
          short_description: row.shortDescription,
          specs: row.specs,
          price: row.tradePrice,
          min_order_qty: row.moq,
          stock_quantity: row.stockQuantity,
          stock_status: row.stockStatus,
          images: combinedImages,
          is_active: row.isActive,
          is_featured: row.isFeatured,
        });
        created++;
      }
    } catch (err: any) {
      failed++;
      reportEntries.push({
        rowNumber: row.rowNumber,
        status: 'Failed',
        reasons: [err?.message || 'Unexpected error while saving product'],
        rawValues: row.rawValues,
      });
    }
  }

  options.onProgress?.({
    completed: importQueue.length,
    total: importQueue.length,
    currentProductName: 'Done',
  });

  reportEntries.sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    created,
    updated,
    skipped,
    failed,
    imageWarningCount,
    imageWarnings,
    reportEntries,
  };
}
