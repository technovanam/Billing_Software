// Per-business localStorage caches for list data. Keys include the uid so one
// account never sees another account's data on a shared browser.
const CACHE_PREFIX = "store_cache_";
const LEGACY_KEYS = ["store_customers_cache", "store_invoices_cache"];

export const cacheKeyFor = (name, uid) => (uid ? `${CACHE_PREFIX}${name}_${uid}` : null);

export function readCache(key) {
  if (!key) return [];
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export function writeCache(key, list) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) {
    // Storage full or blocked: caching is optional.
  }
}

export function clearDataCaches() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX) || LEGACY_KEYS.includes(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    // Storage full or blocked: caching is optional.
  }
}
