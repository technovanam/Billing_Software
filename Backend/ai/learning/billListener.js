// Watches a business's new bills while it is using AI commands and adds them
// to its stats. Opened on each command, closed after IDLE_MS without one.
// Bills saved while no listener is open are picked up by the nightly rebuild.
const admin = require('firebase-admin');
const { businessCollections } = require('../businessRef');
const { buildResolvers, applyNewBill } = require('./statsModel');

const IDLE_MS = 30 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

// Browser-saved bills store createdAt as an ISO string; backend-created ones
// (recurring invoices) use a Firestore Timestamp. Firestore compares the two
// types separately, so both are queried.
const firestoreSource = {
  subscribe(businessId, sinceIso, onDocs, onError) {
    const col = businessCollections.invoices(businessId);
    const handle = (snap) => {
      const added = snap.docChanges().filter((c) => c.type === 'added').map((c) => ({ id: c.doc.id, ...c.doc.data() }));
      if (added.length) onDocs(added);
    };
    const unsubString = col.where('createdAt', '>=', sinceIso).onSnapshot(handle, onError);
    const unsubStamp = col.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(sinceIso))).onSnapshot(handle, onError);
    return () => {
      unsubString();
      unsubStamp();
    };
  },
};

function createBillListener({ statsStore, getCatalog, rebuild, source = firestoreSource, idleMs = IDLE_MS, now = () => Date.now() }) {
  const open = new Map(); // businessId -> { unsubscribe, lastUsed }
  const opening = new Map();

  async function applyDocs(businessId, docs) {
    const catalog = await getCatalog(businessId);
    const resolvers = buildResolvers(catalog.products, catalog.customers);
    await statsStore.mutate(businessId, (stats) => {
      let changed = false;
      for (const doc of docs) changed = applyNewBill(stats, doc, resolvers) || changed;
      return changed || undefined; // watermark moved either way; save it
    });
  }

  async function start(businessId) {
    let stats = await statsStore.get(businessId);
    if (!stats.meta.builtAt) {
      await rebuild(businessId);
      stats = await statsStore.get(businessId);
    }
    const sinceIso = stats.meta.watermark?.at || new Date(0).toISOString();
    const unsubscribe = source.subscribe(
      businessId,
      sinceIso,
      (docs) => applyDocs(businessId, docs).catch((err) => console.error('aiStats bill update failed:', err.message)),
      (err) => {
        console.error('aiStats bill listener error:', err.message);
        close(businessId);
      }
    );
    open.set(businessId, { unsubscribe, lastUsed: now() });
  }

  function close(businessId) {
    const entry = open.get(businessId);
    open.delete(businessId);
    try {
      entry?.unsubscribe?.();
    } catch (_) {
      // already closed
    }
  }

  // Call on every AI command. Never throws; learning must not block billing.
  function touch(businessId) {
    const entry = open.get(businessId);
    if (entry) {
      entry.lastUsed = now();
      return Promise.resolve();
    }
    if (!opening.has(businessId)) {
      const p = start(businessId)
        .catch((err) => console.error('aiStats listener start failed:', err.message))
        .finally(() => opening.delete(businessId));
      opening.set(businessId, p);
    }
    return opening.get(businessId);
  }

  function sweep() {
    const cutoff = now() - idleMs;
    for (const [businessId, entry] of open) {
      if (entry.lastUsed < cutoff) close(businessId);
    }
  }

  const timer = setInterval(sweep, SWEEP_MS);
  timer.unref?.();

  return {
    touch,
    sweep,
    isOpen: (businessId) => open.has(businessId),
    close,
    closeAll() {
      clearInterval(timer);
      for (const id of [...open.keys()]) close(id);
    },
  };
}

module.exports = { createBillListener };
