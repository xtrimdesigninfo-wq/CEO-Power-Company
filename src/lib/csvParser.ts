import { Brand, Category, StockStatus } from '../types';
import { slugify } from './utils';

/**
 * Parses RFC-4180 CSV text into an array of string rows, handling quoted commas,
 * escaped quotes (""), UTF-8 BOM, and CRLF/LF line endings.
 */
export function parseCsvRows(csvText: string): string[][] {
  const clean = (csvText || '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && next === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some(cell => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

const SPEC_HEADER_NAMES = new Set([
  'key',
  'spec',
  'specs',
  'specification',
  'specifications',
  'parameter',
  'name',
  'attribute',
  'property',
]);

const SPEC_VALUE_HEADERS = new Set(['value', 'val', 'detail', 'details', 'rating']);

/**
 * Parses a 2-column CSV (Key, Value) into Technical Specifications key/value pairs.
 */
export function parseSpecsCsv(csvText: string): Record<string, string> {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const specs: Record<string, string> = {};
  let startIdx = 0;

  if (rows[0].length >= 2) {
    const h0 = rows[0][0].toLowerCase().trim();
    const h1 = rows[0][1].toLowerCase().trim();
    if (SPEC_HEADER_NAMES.has(h0) && SPEC_VALUE_HEADERS.has(h1)) {
      startIdx = 1;
    }
  }

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    const key = (row[0] || '').trim();
    if (!key) continue;
    const value = (row[1] ?? '').trim();
    specs[key] = value;
  }

  if (Object.keys(specs).length === 0) {
    throw new Error('No technical specification rows found in CSV.');
  }

  return specs;
}

export interface ParsedProductCsvResult {
  category_id?: string;
  category_name?: string;
  name?: string;
  slug?: string;
  brand?: string;
  sku?: string;
  short_description?: string;
  price?: number;
  min_order_qty?: number;
  stock_status?: StockStatus;
  stock_quantity?: number;
  is_active?: boolean;
  is_featured?: boolean;
  featured_image?: string;
  other_images?: string[];
  specs: Record<string, string>;
  populatedFieldsCount: number;
}

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const FIELD_ALIASES: Record<string, keyof Omit<ParsedProductCsvResult, 'specs' | 'populatedFieldsCount'>> = {
  category: 'category_name',
  category_name: 'category_name',
  category_slug: 'category_name',
  category_id: 'category_id',
  name: 'name',
  product_name: 'name',
  title: 'name',
  slug: 'slug',
  url_slug: 'slug',
  brand: 'brand',
  sub_category: 'brand',
  subcategory: 'brand',
  brand_name: 'brand',
  sku: 'sku',
  sku_code: 'sku',
  short_description: 'short_description',
  description: 'short_description',
  summary: 'short_description',
  price: 'price',
  trade_price: 'price',
  wholesale_price: 'price',
  min_order_qty: 'min_order_qty',
  moq: 'min_order_qty',
  minimum_order_qty: 'min_order_qty',
  stock_status: 'stock_status',
  stock: 'stock_status',
  availability: 'stock_status',
  stock_quantity: 'stock_quantity',
  stock_qty: 'stock_quantity',
  quantity: 'stock_quantity',
  qty: 'stock_quantity',
  inventory: 'stock_quantity',
  is_active: 'is_active',
  active: 'is_active',
  is_featured: 'is_featured',
  featured: 'is_featured',
  featured_image: 'featured_image',
  main_image: 'featured_image',
  primary_image: 'featured_image',
  image: 'featured_image',
  other_images: 'other_images',
  gallery_images: 'other_images',
  additional_images: 'other_images',
};

function parseStockStatusValue(val: string): StockStatus | undefined {
  const norm = val.toLowerCase().trim().replace(/[\s\-]+/g, '_');
  if (norm === 'in_stock' || norm === 'instock' || norm === 'available') return 'in_stock';
  if (norm === 'low_stock' || norm === 'lowstock' || norm === 'low') return 'low_stock';
  if (norm === 'out_of_stock' || norm === 'outofstock' || norm === 'unavailable') return 'out_of_stock';
  return undefined;
}

function parseBooleanValue(val: string): boolean | undefined {
  const norm = val.toLowerCase().trim();
  if (['true', 'yes', '1', 'active', 'on'].includes(norm)) return true;
  if (['false', 'no', '0', 'inactive', 'hidden', 'off'].includes(norm)) return false;
  return undefined;
}

function parseNumericPrice(val: string): number | undefined {
  const cleaned = val.replace(/[₦,\s]/g, '').replace(/^ngn/i, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseInlineSpecs(val: string): Record<string, string> {
  const trimmed = val.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (k.trim()) out[k.trim()] = String(v ?? '');
        }
        return out;
      }
    } catch {
      // Fall through to delimiter parsing
    }
  }
  const out: Record<string, string> = {};
  for (const segment of trimmed.split(/[|;]/)) {
    const colonIdx = segment.indexOf(':');
    if (colonIdx > 0) {
      const k = segment.slice(0, colonIdx).trim();
      const v = segment.slice(colonIdx + 1).trim();
      if (k) out[k] = v;
    }
  }
  return out;
}

/**
 * Parses a product CSV (either horizontal header+data row OR vertical Field,Value rows)
 * and resolves matching category and brand references. Any extra unrecognized columns
 * (or rows in vertical mode) are captured automatically as technical specifications.
 */
export function parseProductCsv(
  csvText: string,
  categories: Category[],
  brands: Brand[] = []
): ParsedProductCsvResult {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('Product CSV must contain a header row and at least one data row.');
  }

  const result: ParsedProductCsvResult = {
    specs: {},
    populatedFieldsCount: 0,
  };

  const assignField = (rawKey: string, rawVal: string) => {
    const trimmedKey = rawKey.trim();
    const trimmedVal = rawVal.trim();
    if (!trimmedKey || !trimmedVal) return;

    const normKey = normalizeHeaderKey(trimmedKey);
    if (normKey === 'specs' || normKey === 'specifications' || normKey === 'technical_specifications') {
      const parsed = parseInlineSpecs(trimmedVal);
      Object.assign(result.specs, parsed);
      return;
    }

    const mappedField = FIELD_ALIASES[normKey];
    if (!mappedField) {
      // Treat extra columns/rows as technical specifications
      result.specs[trimmedKey] = trimmedVal;
      return;
    }

    if (mappedField === 'price') {
      const p = parseNumericPrice(trimmedVal);
      if (p !== undefined) {
        result.price = p;
        result.populatedFieldsCount++;
      }
      return;
    }
    if (mappedField === 'min_order_qty') {
      const qty = parseInt(trimmedVal.replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(qty) && qty >= 1) {
        result.min_order_qty = qty;
        result.populatedFieldsCount++;
      }
      return;
    }
    if (mappedField === 'stock_status') {
      const st = parseStockStatusValue(trimmedVal);
      if (st) {
        result.stock_status = st;
        result.populatedFieldsCount++;
      }
      return;
    }
    if (mappedField === 'stock_quantity') {
      const qty = parseInt(trimmedVal.replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(qty) && qty >= 0) {
        result.stock_quantity = qty;
        result.populatedFieldsCount++;
      }
      return;
    }
    if (mappedField === 'is_active') {
      const b = parseBooleanValue(trimmedVal);
      if (b !== undefined) {
        result.is_active = b;
        result.populatedFieldsCount++;
      }
      return;
    }
    if (mappedField === 'is_featured') {
      const b = parseBooleanValue(trimmedVal);
      if (b !== undefined) {
        result.is_featured = b;
        result.populatedFieldsCount++;
      }
      return;
    }
    if (mappedField === 'other_images') {
      const urls = trimmedVal
        .split(/[|;]/)
        .map(u => u.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (urls.length > 0) {
        result.other_images = urls;
        result.populatedFieldsCount++;
      }
      return;
    }

    (result as any)[mappedField] = trimmedVal;
    result.populatedFieldsCount++;
  };

  // Detect vertical Field,Value CSV layout vs horizontal table layout
  const firstRowNorm = rows[0].map(normalizeHeaderKey);
  const isVerticalHeader =
    rows[0].length === 2 &&
    ['field', 'attribute', 'key', 'property', 'column'].includes(firstRowNorm[0]) &&
    ['value', 'val', 'data', 'entry'].includes(firstRowNorm[1]);

  if (isVerticalHeader) {
    for (let i = 1; i < rows.length; i++) {
      assignField(rows[i][0] || '', rows[i][1] || '');
    }
  } else {
    const headers = rows[0];
    const dataRow = rows[1];
    for (let col = 0; col < headers.length; col++) {
      assignField(headers[col] || '', dataRow[col] || '');
    }
  }

  // Resolve Category ID by id, slug, or name
  if (result.category_id) {
    const exactCat = categories.find(c => c.id === result.category_id);
    if (!exactCat) delete result.category_id;
  }
  if (!result.category_id && result.category_name) {
    const q = result.category_name.toLowerCase().trim();
    const matchedCat = categories.find(
      c => c.name.toLowerCase() === q || c.slug.toLowerCase() === q || c.slug.toLowerCase() === slugify(q)
    );
    if (matchedCat) {
      result.category_id = matchedCat.id;
    }
  }

  // Canonicalize Brand capitalization if it matches an existing brand in that category
  if (result.brand) {
    const bLower = result.brand.toLowerCase().trim();
    const matchedBrand =
      brands.find(
        b =>
          (!result.category_id || b.category_id === result.category_id) &&
          (b.name.toLowerCase() === bLower || b.slug.toLowerCase() === slugify(bLower))
      ) ||
      brands.find(b => b.name.toLowerCase() === bLower || b.slug.toLowerCase() === slugify(bLower));
    if (matchedBrand) {
      result.brand = matchedBrand.name;
      if (!result.category_id) {
        result.category_id = matchedBrand.category_id;
      }
    }
  }

  if (result.name && !result.slug) {
    result.slug = slugify(result.name);
  }

  if (result.populatedFieldsCount === 0 && Object.keys(result.specs).length === 0) {
    throw new Error('Could not recognize any product fields or specifications in this CSV.');
  }

  return result;
}

export function generateSampleSpecsCsv(): string {
  return [
    'Specification,Value',
    'Wattage,600W',
    'Cell Type,Monocrystalline PERC',
    'Efficiency,21.6%',
    'Voc,49.8V',
    'Isc,15.3A',
    'Dimensions,2465 x 1134 x 35 mm',
    'Weight,31.2 kg',
    'Warranty,12-Year Product / 25-Year Linear Power',
  ].join('\n');
}

export function generateSampleProductCsv(): string {
  return [
    'name,category,brand,sku,price,min_order_qty,stock_quantity,stock_status,short_description,is_active,is_featured,Wattage,Cell Type,Efficiency,Warranty',
    '"ZN Shine 600W Solar Panel","Solar Panels","ZN Shine","ZNS-600W-MONO",155000,1,30,"in_stock","High-output 600W Tier-1 monocrystalline solar PV module.",true,false,"600W","Monocrystalline PERC","21.6%","12-Year Product / 25-Year Power"',
  ].join('\n');
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
