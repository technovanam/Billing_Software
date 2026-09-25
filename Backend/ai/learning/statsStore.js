// Reads and writes per-business stats at {business}/aiStats, cached in memory.
// Documents: summary (products, customers, picks, meta), pairs_0..3 and
// cp_0..7 (customer -> product history), sharded to stay under Firestore's 1 MB.
const crypto = require('crypto');
const { getBusinessRef } = require('../businessRef');
const { emptyStats, trimStats } = require('./statsModel');

const PAIR_SHARDS = 4;
const CP_SHARDS = 8;
const MAX_DOC_BYTES = 900 * 1024;
const MAX_PICK_NAMES = 5000;

const shardOf = (id, n) => crypto.createHash('md5').update(String(id)).digest()[0] % n;
const statsCol = (businessId) => getBusinessRef(businessId).collection('aiStats');

// Drops the least recently used entries until the map serialises under the limit.
function fitMap(map, lastOf) {
  let entries = Object.entries(map);
  while (entries.length && Buffer.byteLength(JSON.stringify(Object.fromEntries(entries))) > MAX_DOC_BYTES) {
    entries.sort((a, b) => String(lastOf(b[1]) || '').localeCompare(String(lastOf(a[1]) || '')));
    entries = entries.slice(0, Math.floor(entries.length * 0.9));
  }
  return Object.fromEntries(entries);
}

function toDocs(stats) {
  trimStats(stats);
  const picks = Object.fromEntries(Object.entries(stats.picks).slice(-MAX_PICK_NAMES));
  const docs = {
    summary: {
      products: fitMap(stats.products, (p) => p.last),
      customers: fitMap(stats.customers, (c) => c.last),
      picks,
      meta: stats.meta,
    },
  };
  for (let i = 0; i < PAIR_SHARDS; i += 1) docs[`pairs_${i}`] = { pairs: {} };
  for (let i = 0; i < CP_SHARDS; i += 1) docs[`cp_${i}`] = { customerProducts: {} };
  for (const [id, others] of Object.entries(stats.pairs)) docs[`pairs_${shardOf(id, PAIR_SHARDS)}`].pairs[id] = others;
  for (const [id, byProduct] of Object.entries(stats.customerProducts)) docs[`cp_${shardOf(id, CP_SHARDS)}`].customerProducts[id] = byProduct;
  for (let i = 0; i < CP_SHARDS; i += 1) {
    const doc = docs[`cp_${i}`];
    doc.customerProducts = fitMap(doc.customerProducts, (byProduct) => Object.values(byProduct).map((x) => x.last).sort().pop());
  }
  return docs;
}

function fromDocs(snapshots) {
  const stats = emptyStats();
  for (const snap of snapshots) {
    if (!snap.exists) continue;
    const data = snap.data();
    if (snap.id === 'summary') {
      stats.products = data.products || {};
      stats.customers = data.customers || {};
      stats.picks = data.picks || {};
      stats.meta = { ...stats.meta, ...(data.meta || {}) };
    } else if (snap.id.startsWith('pairs_')) {
      Object.assign(stats.pairs, data.pairs || {});
    } else if (snap.id.startsWith('cp_')) {
      Object.assign(stats.customerProducts, data.customerProducts || {});
    }
  }
  return stats;
}

function createStatsStore({ ttlMs = 10 * 60 * 1000, flushDelayMs = 20 * 1000, now = () => Date.now() } = {}) {
  const cache = new Map(); // businessId -> { stats, loadedAt, loading }
  const timers = new Map();

  async function load(businessId) {
    const snaps = await statsCol(businessId).get();
    return fromDocs(snaps.docs);
  }

  async function get(businessId) {
    const entry = cache.get(businessId);
    if (entry?.stats && now() - entry.loadedAt < ttlMs && !timers.has(businessId)) return entry.stats;
    if (entry?.stats && timers.has(businessId)) return entry.stats; // unsaved changes win over a reload
    if (entry?.loading) return entry.loading;
    const loading = load(businessId).then((stats) => {
      cache.set(businessId, { stats, loadedAt: now() });
      return stats;
    });
    cache.set(businessId, { ...entry, loading });
    try {
      return await loading;
    } catch (err) {
      cache.delete(businessId);
      throw err;
    }
  }

  async function save(businessId, stats) {
    const docs = toDocs(stats);
    const col = statsCol(businessId);
    const batch = col.firestore.batch();
    for (const [id, data] of Object.entries(docs)) batch.set(col.doc(id), data);
    await batch.commit();
  }

  async function flush(businessId) {
    clearTimeout(timers.get(businessId));
    timers.delete(businessId);
    const entry = cache.get(businessId);
    if (entry?.stats) await save(businessId, entry.stats);
  }

  function scheduleFlush(businessId) {
    if (timers.has(businessId)) return;
    const timer = setTimeout(() => {
      flush(businessId).catch((err) => console.error('aiStats flush failed:', err.message));
    }, flushDelayMs);
    timer.unref?.();
    timers.set(businessId, timer);
  }

  // Apply an in-memory change and save it shortly after (batched).
  async function mutate(businessId, fn) {
    const stats = await get(businessId);
    const changed = fn(stats);
    if (changed !== false) scheduleFlush(businessId);
    return changed;
  }

  async function replace(businessId, stats) {
    clearTimeout(timers.get(businessId));
    timers.delete(businessId);
    cache.set(businessId, { stats, loadedAt: now() });
    await save(businessId, stats);
  }

  return { get, mutate, replace, flush, _toDocs: toDocs, _fromDocs: fromDocs };
}

module.exports = { createStatsStore, toDocs, fromDocs };
