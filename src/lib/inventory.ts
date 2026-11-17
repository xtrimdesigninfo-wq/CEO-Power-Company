import { AdminProduct, Product, StockStatus } from '../types';

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/**
 * Normalizes a customizable low-stock threshold into a valid integer >= 1.
 */
export function normalizeLowStockThreshold(
  value: string | number | undefined | null,
  fallback = DEFAULT_LOW_STOCK_THRESHOLD
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const num = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(num) || num < 1) {
    return fallback;
  }
  return Math.min(Math.floor(num), 100000);
}

/**
 * Derives the semantic StockStatus from a numeric inventory count and threshold.
 */
export function deriveStockStatusFromQuantity(quantity: number, threshold: number): StockStatus {
  const safeThreshold = normalizeLowStockThreshold(threshold);
  const safeQty = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (safeQty <= 0) return 'out_of_stock';
  if (safeQty < safeThreshold) return 'low_stock';
  return 'in_stock';
}

/**
 * Returns true if a product's inventory is strictly below the customizable threshold,
 * or (when numeric quantity isn't tracked yet) its status is low_stock / out_of_stock.
 */
export function isProductBelowThreshold(
  product: Pick<Product | AdminProduct, 'stock_quantity' | 'stock_status'>,
  threshold: number
): boolean {
  const safeThreshold = normalizeLowStockThreshold(threshold);
  if (typeof product.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)) {
    return product.stock_quantity < safeThreshold;
  }
  return product.stock_status === 'low_stock' || product.stock_status === 'out_of_stock';
}

export function isProductOutOfStock(
  product: Pick<Product | AdminProduct, 'stock_quantity' | 'stock_status'>
): boolean {
  if (typeof product.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)) {
    return product.stock_quantity <= 0;
  }
  return product.stock_status === 'out_of_stock';
}

/**
 * Builds an automated alert fingerprint so dismissing an alert hides it only
 * until stock drops further or the threshold increases.
 */
export function buildAlertFingerprint(
  product: Pick<Product | AdminProduct, 'id' | 'stock_quantity' | 'stock_status'>,
  threshold: number
): string {
  const safeThreshold = normalizeLowStockThreshold(threshold);
  const qtyToken =
    typeof product.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)
      ? String(product.stock_quantity)
      : product.stock_status;
  return `${product.id}:${qtyToken}:${safeThreshold}`;
}

export interface LowStockEvaluationResult<T> {
  threshold: number;
  alerts: T[];
  outOfStockCount: number;
  lowStockCount: number;
  totalAlertCount: number;
}

/**
 * Evaluates a product collection against the customizable low-stock threshold,
 * returning highlighted items sorted by urgency (0 / out-of-stock first, then lowest quantity).
 */
export function evaluateLowStockAlerts<
  T extends Pick<Product | AdminProduct, 'id' | 'name' | 'stock_quantity' | 'stock_status'>
>(products: T[], threshold: number): LowStockEvaluationResult<T> {
  const safeThreshold = normalizeLowStockThreshold(threshold);
  const flagged = products.filter(p => isProductBelowThreshold(p, safeThreshold));

  flagged.sort((a, b) => {
    const aOut = isProductOutOfStock(a) ? 0 : 1;
    const bOut = isProductOutOfStock(b) ? 0 : 1;
    if (aOut !== bOut) return aOut - bOut;

    const aQty =
      typeof a.stock_quantity === 'number' && Number.isFinite(a.stock_quantity)
        ? a.stock_quantity
        : a.stock_status === 'out_of_stock'
          ? 0
          : safeThreshold - 1;
    const bQty =
      typeof b.stock_quantity === 'number' && Number.isFinite(b.stock_quantity)
        ? b.stock_quantity
        : b.stock_status === 'out_of_stock'
          ? 0
          : safeThreshold - 1;
    if (aQty !== bQty) return aQty - bQty;
    return a.name.localeCompare(b.name);
  });

  const outOfStockCount = flagged.filter(isProductOutOfStock).length;
  const lowStockCount = flagged.length - outOfStockCount;

  return {
    threshold: safeThreshold,
    alerts: flagged,
    outOfStockCount,
    lowStockCount,
    totalAlertCount: flagged.length,
  };
}

export function inferSeedStockQuantity(status: StockStatus): number {
  if (status === 'out_of_stock') return 0;
  if (status === 'low_stock') return 5;
  return 25;
}
