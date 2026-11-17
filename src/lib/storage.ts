/**
 * Safe storage utility that wraps window.localStorage in try/catch and falls back
 * to an in-memory Map when running in cross-origin iframes or browsers that
 * block third-party storage/cookies (throwing SecurityError on window.localStorage).
 */

const memoryFallback = new Map<string, string>();

function getNativeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    const storage = getNativeLocalStorage();
    if (storage) {
      try {
        return storage.getItem(key);
      } catch {
        // Fall through to in-memory fallback
      }
    }
    return memoryFallback.has(key) ? (memoryFallback.get(key) ?? null) : null;
  },

  setItem(key: string, value: string): void {
    const storage = getNativeLocalStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        // Fall through to in-memory fallback
      }
    }
    memoryFallback.set(key, value);
  },

  removeItem(key: string): void {
    const storage = getNativeLocalStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Fall through to in-memory fallback
      }
    }
    memoryFallback.delete(key);
  },
};
