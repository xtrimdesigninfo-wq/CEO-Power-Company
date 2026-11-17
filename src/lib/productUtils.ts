import { AdminProduct, Product } from '../types';
import { slugify } from './utils';

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'solar',
  'power',
  'ceo',
  'panel',
  'inverter',
  'battery',
  'system',
  'high',
]);

function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

const KEY_SPEC_FIELDS = [
  'Wattage',
  'Rated Power',
  'Capacity',
  'System Voltage',
  'Battery Voltage',
  'Cell Type',
  'Rated Current',
  'Voltage Rating',
];

function computeSpecSimilarity(
  specsA: Record<string, string> | undefined,
  specsB: Record<string, string> | undefined
): number {
  if (!specsA || !specsB) return 0;

  let score = 0;
  const entriesA = Object.entries(specsA);
  const entriesB = Object.entries(specsB);
  if (entriesA.length === 0 || entriesB.length === 0) return 0;

  // Shared spec key & overlapping tokens
  for (const field of KEY_SPEC_FIELDS) {
    const valA = specsA[field];
    const valB = specsB[field];
    if (valA && valB) {
      if (valA.toLowerCase() === valB.toLowerCase()) {
        score += 5;
      } else {
        const tokA = tokenize(valA);
        const tokB = tokenize(valB);
        for (const t of tokA) {
          if (tokB.has(t)) {
            score += 2.5;
          }
        }
      }
    }
  }

  return Math.min(15, score);
}

export function scoreProductSimilarity(current: Product, candidate: Product): number {
  let score = 0;

  // 1. Same Category (+50)
  if (candidate.category_id === current.category_id) {
    score += 50;
  }

  // 2. Same Brand (+20)
  if (
    current.brand &&
    candidate.brand &&
    current.brand.trim().toLowerCase() === candidate.brand.trim().toLowerCase()
  ) {
    score += 20;
  }

  // 3. Price Tier Proximity (up to +18)
  const maxPrice = Math.max(current.price, candidate.price, 1);
  const relDiff = Math.abs(current.price - candidate.price) / maxPrice;
  if (relDiff <= 0.5) {
    score += Math.round((1 - relDiff / 0.5) * 18);
  }

  // 4. Technical Specification Overlap (up to +15)
  score += computeSpecSimilarity(current.specs, candidate.specs);

  // 5. Title / Short Description Keyword Overlap (up to +10)
  const currentTokens = tokenize(`${current.name} ${current.short_description || ''}`);
  const candidateTokens = tokenize(`${candidate.name} ${candidate.short_description || ''}`);
  let overlapCount = 0;
  for (const t of currentTokens) {
    if (candidateTokens.has(t)) overlapCount++;
  }
  score += Math.min(10, overlapCount * 3);

  // 6. Stock Availability Priority
  if (candidate.stock_status === 'in_stock') {
    score += 8;
  } else if (candidate.stock_status === 'low_stock') {
    score += 3;
  } else {
    score -= 10;
  }

  // 7. Featured Tie-Breaker
  if (candidate.is_featured) {
    score += 3;
  }

  return score;
}

/**
 * Selects up to `limit` (default 4) active products most similar to `currentProduct`.
 */
export function getSimilarProducts(
  currentProduct: Product,
  allProducts: Product[],
  limit = 4
): Product[] {
  const candidates = allProducts.filter(
    p => p.id !== currentProduct.id && p.is_active
  );

  return candidates
    .map(candidate => ({
      product: candidate,
      score: scoreProductSimilarity(currentProduct, candidate),
      priceDiff: Math.abs(candidate.price - currentProduct.price),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.priceDiff !== b.priceDiff) return a.priceDiff - b.priceDiff;
      return (
        new Date(b.product.created_at).getTime() -
        new Date(a.product.created_at).getTime()
      );
    })
    .slice(0, limit)
    .map(entry => entry.product);
}

export interface DuplicateProductDraft {
  category_id: string;
  name: string;
  slug: string;
  brand: string;
  sku: string;
  short_description: string;
  price: number;
  min_order_qty: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
  is_featured: boolean;
  images: string[];
  specs: Record<string, string>;
}

/**
 * Builds an editable pre-filled product draft from an existing product for duplication.
 */
export function buildDuplicateProductDraft(
  source: AdminProduct,
  existingProducts: Array<Pick<AdminProduct, 'slug' | 'sku'>> = []
): DuplicateProductDraft {
  const baseName = `${source.name} (Copy)`;
  const baseSlug = slugify(`${source.slug || source.name}-copy`);
  const existingSlugs = new Set(existingProducts.map(p => p.slug.toLowerCase()));

  let uniqueSlug = baseSlug;
  let suffix = 2;
  while (existingSlugs.has(uniqueSlug.toLowerCase())) {
    uniqueSlug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  let uniqueSku = source.sku ? `${source.sku}-COPY` : '';
  if (uniqueSku) {
    const existingSkus = new Set(
      existingProducts
        .map(p => p.sku?.toLowerCase())
        .filter((s): s is string => Boolean(s))
    );
    let skuSuffix = 2;
    while (existingSkus.has(uniqueSku.toLowerCase())) {
      uniqueSku = `${source.sku}-COPY-${skuSuffix}`;
      skuSuffix++;
    }
  }

  return {
    category_id: source.category_id,
    name: baseName,
    slug: uniqueSlug,
    brand: source.brand || '',
    sku: uniqueSku,
    short_description: source.short_description || '',
    price: source.price ?? 0,
    min_order_qty: source.min_order_qty || 1,
    stock_status: source.stock_status,
    is_active: source.is_active,
    is_featured: false,
    images: [...(source.images || [])],
    specs: { ...(source.specs || {}) },
  };
}

export const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80';

/**
 * Normalizes a product's image array (featured image + up to 3 other images)
 * for display inside a ProductCard carousel.
 */
export function getProductCardImages(
  images: string[] | null | undefined,
  maxImages = 4
): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const raw of images || []) {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
    if (cleaned.length >= maxImages) break;
  }

  return cleaned.length > 0 ? cleaned : [DEFAULT_PRODUCT_IMAGE];
}

/**
 * Computes the wrapped target slide index for carousel next/prev controls.
 */
export function getWrappedCarouselIndex(
  currentIndex: number,
  delta: number,
  total: number
): number {
  if (total <= 0) return 0;
  return ((currentIndex + delta) % total + total) % total;
}

/**
 * Maps a carousel track's horizontal scroll offset to the nearest active slide index.
 */
export function getCarouselIndexFromScroll(
  scrollLeft: number,
  slideWidth: number,
  total: number
): number {
  if (total <= 1 || slideWidth <= 0) return 0;
  const raw = Math.round(scrollLeft / slideWidth);
  return Math.max(0, Math.min(total - 1, raw));
}

