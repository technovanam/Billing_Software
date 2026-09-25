// Per-business purchase statistics used to rank match candidates.
// Pure functions: no Firestore here, so they are easy to test.
const { normalizeText } = require('../matcher');

const MAX_RECENT_DATES = 10; // per customer+product, enough for a 90-day count
const MAX_PAIRS_PER_PRODUCT = 10;
const SKIP_STATUSES = new Set(['draft', 'cancelled', 'canceled', 'void']);

function emptyStats() {
  return {
    products: {}, // productId -> { n: bills, q: quantity, last: iso }
    customers: {}, // customerId -> { n: bills, last: iso }
    customerProducts: {}, // customerId -> productId -> { n, last, recent: [iso] }
    pairs: {}, // productId -> otherProductId -> bills together
    picks: {}, // normalised spoken name -> productId -> times picked in the preview
    meta: { builtAt: null, bills: 0, watermark: { at: null, ids: [] } },
  };
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
  return null;
}

// Name -> product id lookups for lines saved before productId was stored.
function buildResolvers(products, customers) {
  const productById = new Map(products.map((p) => [p.id, p]));
  const productByName = new Map();
  const addName = (key, id) => {
    if (!key) return;
    const ids = productByName.get(key) || new Set();
    ids.add(id);
    productByName.set(key, ids);
  };
  for (const p of products) {
    addName(normalizeText(p.name), p.id);
    if (p.brand) addName(normalizeText(`${p.brand} ${p.name}`), p.id);
  }
  const customerIds = new Set(customers.map((c) => c.id));
  const customerByName = new Map();
  for (const c of customers) {
    for (const n of c.names || [normalizeText(c.name)]) {
      const ids = customerByName.get(n) || new Set();
      ids.add(c.id);
      customerByName.set(n, ids);
    }
  }
  const unique = (map, key) => {
    const ids = key ? map.get(key) : null;
    return ids && ids.size === 1 ? [...ids][0] : null;
  };
  return {
    productId(line) {
      if (line.productId && productById.has(line.productId)) return line.productId;
      return unique(productByName, normalizeText(line.description || line.name));
    },
    customerId(doc) {
      if (doc.clientId && customerIds.has(doc.clientId)) return doc.clientId;
      if (doc.client?.id && customerIds.has(doc.client.id)) return doc.client.id;
      return unique(customerByName, normalizeText(doc.customerName || doc.client?.name || doc.clientName));
    },
  };
}

// Invoice / POS bill document -> { id, at, customerId, lines: [{ productId, qty }] }
function extractBill(doc, resolvers) {
  if (SKIP_STATUSES.has(String(doc.status || '').toLowerCase())) return null;
  const at = toIso(doc.createdAt) || toIso(doc.invoiceDate);
  if (!at) return null;
  const lines = [];
  for (const line of doc.items || doc.products || []) {
    const productId = resolvers.productId(line || {});
    if (!productId) continue;
    lines.push({ productId, qty: Number(line.quantity ?? line.qty) || 0 });
  }
  if (!lines.length) return null;
  return { id: doc.id, at, customerId: resolvers.customerId(doc), lines };
}

function later(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function addBill(stats, bill) {
  const productIds = [...new Set(bill.lines.map((l) => l.productId))];
  for (const line of bill.lines) {
    const p = stats.products[line.productId] || { n: 0, q: 0, last: null };
    p.q += line.qty;
    p.last = later(p.last, bill.at);
    stats.products[line.productId] = p;
  }
  for (const id of productIds) stats.products[id].n += 1;

  if (bill.customerId) {
    const c = stats.customers[bill.customerId] || { n: 0, last: null };
    c.n += 1;
    c.last = later(c.last, bill.at);
    stats.customers[bill.customerId] = c;
    const byProduct = stats.customerProducts[bill.customerId] || {};
    for (const id of productIds) {
      const cp = byProduct[id] || { n: 0, last: null, recent: [] };
      cp.n += 1;
      cp.last = later(cp.last, bill.at);
      cp.recent = [...cp.recent, bill.at].sort().reverse().slice(0, MAX_RECENT_DATES);
      byProduct[id] = cp;
    }
    stats.customerProducts[bill.customerId] = byProduct;
  }

  for (const a of productIds) {
    for (const b of productIds) {
      if (a === b) continue;
      stats.pairs[a] = stats.pairs[a] || {};
      stats.pairs[a][b] = (stats.pairs[a][b] || 0) + 1;
    }
  }
  stats.meta.bills += 1;
}

function addPick(stats, spokenName, productId) {
  const key = normalizeText(spokenName);
  if (!key || !productId) return;
  stats.picks[key] = stats.picks[key] || {};
  stats.picks[key][productId] = (stats.picks[key][productId] || 0) + 1;
}

// Keeps documents small: top pairs per product only.
function trimStats(stats) {
  for (const [a, others] of Object.entries(stats.pairs)) {
    const top = Object.entries(others).sort((x, y) => y[1] - x[1]).slice(0, MAX_PAIRS_PER_PRODUCT);
    stats.pairs[a] = Object.fromEntries(top);
  }
  return stats;
}

// Picks come from preview corrections and saved aliases in aiLogs.
function picksFromLogs(logs) {
  const picks = [];
  for (const log of logs) {
    if (log.type === 'alias_saved' && log.alias && log.productId) picks.push({ spokenName: log.alias, productId: log.productId });
    if (log.type === 'pick_signal' && log.spokenName && log.productId) picks.push({ spokenName: log.spokenName, productId: log.productId });
    if (log.type === 'command') {
      for (const c of log.corrections || []) {
        if (c.type === 'pick_product' && c.spokenName && typeof c.to === 'string') picks.push({ spokenName: c.spokenName, productId: c.to });
      }
    }
  }
  return picks;
}

function buildStats({ invoices, logs = [], products, customers, now = new Date() }) {
  const stats = emptyStats();
  const resolvers = buildResolvers(products, customers);
  let watermark = null;
  const ids = [];
  const bills = invoices.map((doc) => extractBill(doc, resolvers)).filter(Boolean);
  for (const bill of bills) {
    addBill(stats, bill);
    if (!watermark || bill.at > watermark) {
      watermark = bill.at;
      ids.length = 0;
    }
    if (bill.at === watermark) ids.push(bill.id);
  }
  // Seen-but-unusable bills still move the watermark so the listener skips them.
  for (const doc of invoices) {
    const at = toIso(doc.createdAt);
    if (at && (!watermark || at > watermark)) {
      watermark = at;
      ids.length = 0;
      ids.push(doc.id);
    }
  }
  for (const pick of picksFromLogs(logs)) addPick(stats, pick.spokenName, pick.productId);
  stats.meta = { builtAt: now.toISOString(), bills: stats.meta.bills, watermark: { at: watermark, ids } };
  return trimStats(stats);
}

// Incremental: apply one new bill unless the watermark says it was counted.
function applyNewBill(stats, doc, resolvers) {
  const at = toIso(doc.createdAt);
  const wm = stats.meta.watermark || { at: null, ids: [] };
  if (at && wm.at && (at < wm.at || (at === wm.at && wm.ids.includes(doc.id)))) return false;
  const bill = extractBill(doc, resolvers);
  if (bill) addBill(stats, bill);
  if (at) {
    if (!wm.at || at > wm.at) stats.meta.watermark = { at, ids: [doc.id] };
    else stats.meta.watermark = { at: wm.at, ids: [...wm.ids, doc.id].slice(-200) };
  }
  return Boolean(bill);
}

module.exports = { emptyStats, toIso, buildResolvers, extractBill, addBill, addPick, trimStats, picksFromLogs, buildStats, applyNewBill };
