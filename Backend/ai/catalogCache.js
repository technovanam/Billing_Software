// In-memory product and customer lists per business, kept current by Firestore
// listeners. Any create, edit or delete of a product or customer (from the admin
// pages, POS, warehouse, backend routes or the AI preview) replaces the cached
// list, so matching never uses stale names, prices or aliases. Businesses that
// stop sending commands are dropped after IDLE_MS.
const { businessCollections } = require('./businessRef');
const { toProductRecord, toCustomerRecord } = require('./matcher');

const IDLE_MS = 10 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

// Default source: live Firestore listeners. Tests pass a fake source instead.
const firestoreSource = {
  subscribe(businessId, { onProducts, onCustomers, onError }) {
    const unsubProducts = businessCollections
      .products(businessId)
      .onSnapshot((snap) => onProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    const unsubCustomers = businessCollections
      .customers(businessId)
      .onSnapshot((snap) => onCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    return () => {
      unsubProducts();
      unsubCustomers();
    };
  },
};

function createCatalogCache({ source = firestoreSource, idleMs = IDLE_MS, now = () => Date.now() } = {}) {
  const entries = new Map();

  function drop(businessId) {
    const entry = entries.get(businessId);
    if (!entry) return;
    entries.delete(businessId);
    try {
      entry.unsubscribe?.();
    } catch (_) {
      // listener already closed
    }
  }

  function open(businessId) {
    const entry = { products: null, customers: null, lastUsed: now(), version: 0, unsubscribe: null };
    entry.ready = new Promise((resolve, reject) => {
      const settle = () => {
        if (entry.products && entry.customers) resolve();
      };
      entry.unsubscribe = source.subscribe(businessId, {
        onProducts: (docs) => {
          entry.products = docs.map(toProductRecord);
          entry.version += 1;
          settle();
        },
        onCustomers: (docs) => {
          entry.customers = docs.map(toCustomerRecord);
          entry.version += 1;
          settle();
        },
        onError: (err) => {
          drop(businessId);
          reject(err);
        },
      });
    });
    entries.set(businessId, entry);
    return entry;
  }

  async function get(businessId) {
    const entry = entries.get(businessId) || open(businessId);
    entry.lastUsed = now();
    await entry.ready;
    return { products: entry.products, customers: entry.customers, version: entry.version };
  }

  function sweep() {
    const cutoff = now() - idleMs;
    for (const [businessId, entry] of entries) {
      if (entry.lastUsed < cutoff) drop(businessId);
    }
  }

  const timer = setInterval(sweep, SWEEP_MS);
  timer.unref?.();

  return {
    get,
    invalidate: drop,
    sweep,
    size: () => entries.size,
    close() {
      clearInterval(timer);
      for (const businessId of [...entries.keys()]) drop(businessId);
    },
  };
}

module.exports = { createCatalogCache };
