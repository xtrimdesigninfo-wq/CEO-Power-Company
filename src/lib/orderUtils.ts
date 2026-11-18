import { CartItem, OrderItem, OrderRequest, Product } from '../types';

export interface ReorderCartPlan {
  itemsToCart: CartItem[];
  skippedItems: OrderItem[];
  adjustedMoqNames: string[];
}

/**
 * Returns true when an order has been completed / fulfilled.
 */
export function isCompletedOrder(order: Pick<OrderRequest, 'status'>): boolean {
  return order.status === 'fulfilled';
}

/**
 * Resolves items from a previous order against the current live product catalogue
 * so the cart can be repopulated with accurate pricing, MOQs, and stock checks.
 */
export function buildReorderCartPlan(
  order: Pick<OrderRequest, 'items'>,
  products: Product[]
): ReorderCartPlan {
  const productById = new Map<string, Product>();
  const productByName = new Map<string, Product>();

  for (const product of products) {
    productById.set(product.id, product);
    const normalizedName = product.name.trim().toLowerCase();
    if (normalizedName && !productByName.has(normalizedName)) {
      productByName.set(normalizedName, product);
    }
  }

  const cartItemMap = new Map<string, CartItem>();
  const skippedItems: OrderItem[] = [];
  const adjustedMoqNames: string[] = [];

  for (const item of order.items) {
    const matched =
      productById.get(item.product_id) ??
      productByName.get(item.name.trim().toLowerCase());

    if (!matched || !matched.is_active || matched.stock_status === 'out_of_stock') {
      skippedItems.push(item);
      continue;
    }

    const minQty = matched.min_order_qty || 1;
    const requestedQty = Math.max(1, Math.floor(item.qty || 1));
    const finalQty = Math.max(requestedQty, minQty);

    if (finalQty > requestedQty) {
      adjustedMoqNames.push(matched.name);
    }

    const existing = cartItemMap.get(matched.id);
    if (existing) {
      cartItemMap.set(matched.id, {
        product: matched,
        quantity: existing.quantity + requestedQty,
      });
    } else {
      cartItemMap.set(matched.id, {
        product: matched,
        quantity: finalQty,
      });
    }
  }

  return {
    itemsToCart: Array.from(cartItemMap.values()),
    skippedItems,
    adjustedMoqNames,
  };
}
