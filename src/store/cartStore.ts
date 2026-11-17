import { create } from 'zustand';
import { Product, CartItem } from '../types';
import { safeStorage } from '../lib/storage';

interface CartState {
  userId: string | null;
  items: CartItem[];
  note: string;
  setUserId: (userId: string | null) => void;
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  setNote: (note: string) => void;
  getItemCount: () => number;
  getSubtotal: () => number;
}

function getCartStorageKey(userId: string | null): string {
  return `ceo_power_cart_${userId || 'anonymous'}`;
}

function loadPersistedCart(userId: string | null): { items: CartItem[]; note: string } {
  if (typeof window === 'undefined') return { items: [], note: '' };
  try {
    const raw = safeStorage.getItem(getCartStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        note: typeof parsed.note === 'string' ? parsed.note : '',
      };
    }
  } catch {}
  return { items: [], note: '' };
}

function saveCart(userId: string | null, items: CartItem[], note: string): void {
  if (typeof window === 'undefined') return;
  try {
    safeStorage.setItem(
      getCartStorageKey(userId),
      JSON.stringify({ items, note })
    );
  } catch (e) {
    console.error('Failed to persist cart:', e);
  }
}

export const useCartStore = create<CartState>((set, get) => {
  const initial = loadPersistedCart(null);

  return {
    userId: null,
    items: initial.items,
    note: initial.note,

    setUserId: (userId: string | null) => {
      const currentUserId = get().userId;
      if (currentUserId !== userId) {
        const userCart = loadPersistedCart(userId);
        set({ userId, items: userCart.items, note: userCart.note });
      }
    },

    addItem: (product: Product, quantity?: number) => {
      const { items, userId, note } = get();
      const minQty = product.min_order_qty || 1;
      const addQty = quantity && quantity >= minQty ? quantity : minQty;

      const existingIndex = items.findIndex(i => i.product.id === product.id);
      let updatedItems: CartItem[];

      if (existingIndex > -1) {
        updatedItems = [...items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          product, // refresh product metadata
          quantity: updatedItems[existingIndex].quantity + addQty,
        };
      } else {
        updatedItems = [...items, { product, quantity: addQty }];
      }

      saveCart(userId, updatedItems, note);
      set({ items: updatedItems });
    },

    updateQuantity: (productId: string, quantity: number) => {
      const { items, userId, note } = get();
      if (quantity <= 0) {
        get().removeItem(productId);
        return;
      }

      const updatedItems = items.map(item => {
        if (item.product.id === productId) {
          const min = item.product.min_order_qty || 1;
          const validQty = Math.max(quantity, min);
          return { ...item, quantity: validQty };
        }
        return item;
      });

      saveCart(userId, updatedItems, note);
      set({ items: updatedItems });
    },

    removeItem: (productId: string) => {
      const { items, userId, note } = get();
      const updatedItems = items.filter(item => item.product.id !== productId);
      saveCart(userId, updatedItems, note);
      set({ items: updatedItems });
    },

    clearCart: () => {
      const { userId } = get();
      saveCart(userId, [], '');
      set({ items: [], note: '' });
    },

    setNote: (note: string) => {
      const { userId, items } = get();
      saveCart(userId, items, note);
      set({ note });
    },

    getItemCount: () => {
      return get().items.reduce((acc, item) => acc + item.quantity, 0);
    },

    getSubtotal: () => {
      return get().items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    },
  };
});
