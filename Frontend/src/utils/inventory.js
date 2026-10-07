// Stock Summary, Tally style. Quantities move with every voucher:
//   in  = opening stock + purchases + credit notes (goods returned to us) + adjustments in
//   out = sales invoices + debit notes (goods returned to supplier) + adjustments out
// Stock is valued at the weighted-average purchase rate (falling back to the
// product's purchase price), and the closing value feeds the P&L and Balance Sheet.
import { round2, inrFactor } from "./gst.js";
import { toDateKey } from "./accounting.js";

export const MAIN_GODOWN = "Main Location";
const godownOf = (doc) => (doc?.godown && String(doc.godown).trim()) || MAIN_GODOWN;

const n = (v) => {
  const x = Number.parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const norm = (s) => String(s || "").trim().toLowerCase();
const isLive = (doc) => !/^(draft|cancelled)$/i.test(String(doc?.status || ""));

// Every stock movement as { productId, date, qty (+in / −out), rate, kind, ref }.
export function stockMovements({ products = [], invoices = [], creditNotes = [], purchases = [], debitNotes = [], stockJournals = [] }) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const byName = new Map(products.map((p) => [norm(p.name), p]));
  const resolve = (it) => byId.get(it.productId) || byName.get(norm(it.description || it.name));
  const out = [];
  const add = (doc, date, sign, kind, number) => {
    for (const it of doc.items || doc.products || []) {
      const p = resolve(it);
      const qty = n(it.quantity);
      if (!p || !qty) continue;
      // Taxable rate per unit after discount — what the goods actually cost/sold for.
      const rate = (qty ? n(it.taxable ?? it.amount) / qty || n(it.rate ?? it.price) : 0) * inrFactor(doc);
      out.push({ productId: p.id, date, qty: sign * qty, rate, kind, number, godown: godownOf(doc), batch: String(it.batchNo || "").trim(), expiry: it.expiryDate || "" });
    }
  };
  for (const p of products) {
    if (n(p.openingStock)) out.push({ productId: p.id, date: "", qty: n(p.openingStock), rate: n(p.openingRate) || n(p.purchasePrice), kind: "Opening", number: "", godown: godownOf(p), batch: String(p.openingBatch || "").trim(), expiry: p.openingExpiry || "" });
  }
  for (const v of purchases) add(v, toDateKey(v.voucherDate), 1, "Purchase", v.voucherNumber);
  for (const v of creditNotes) add(v, toDateKey(v.voucherDate), 1, "Sales Return", v.voucherNumber);
  for (const v of invoices) if (isLive(v)) add(v, toDateKey(v.invoiceDate || v.createdAt), -1, "Sales", v.invoiceNumber);
  for (const v of debitNotes) add(v, toDateKey(v.voucherDate), -1, "Purchase Return", v.voucherNumber);
  for (const j of stockJournals) {
    if (j.kind === "manufacture") {
      // Manufacturing journal (Tally "Manufacturing Journal"): components are
      // consumed and the finished item comes in at their cost.
      const fg = byId.get(j.productId);
      const base = { date: toDateKey(j.voucherDate), number: j.voucherNumber || "", godown: godownOf(j), reason: "Manufacture" };
      for (const c of j.components || []) {
        if (!byId.has(c.productId) || !n(c.quantity)) continue;
        out.push({ ...base, productId: c.productId, qty: -Math.abs(n(c.quantity)), rate: n(c.rate), kind: "Consumed", batch: String(c.batchNo || "").trim(), expiry: "" });
      }
      if (fg && n(j.quantity)) out.push({ ...base, productId: fg.id, qty: Math.abs(n(j.quantity)), rate: n(j.rate), kind: "Manufactured", batch: String(j.batchNo || "").trim(), expiry: j.expiryDate || "" });
      continue;
    }
    const p = byId.get(j.productId);
    if (!p || !n(j.quantity)) continue;
    const base = { productId: p.id, date: toDateKey(j.voucherDate), rate: n(j.rate) || n(p.purchasePrice), number: j.voucherNumber || "", reason: j.reason || "" };
    if (j.kind === "transfer") {
      // Moves stock between godowns: out of one, into the other (total unchanged).
      const qty = Math.abs(n(j.quantity));
      out.push({ ...base, qty: -qty, kind: "Transfer Out", godown: j.fromGodown || MAIN_GODOWN });
      out.push({ ...base, qty, kind: "Transfer In", godown: j.toGodown || MAIN_GODOWN });
    } else {
      out.push({ ...base, qty: n(j.quantity), kind: "Adjustment", godown: godownOf(j) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Weighted-average cost from opening stock and purchases up to `to`.
function averageRate(moves, product, to) {
  let qty = 0;
  let value = 0;
  for (const m of moves) {
    if (to && m.date && m.date > to) continue;
    if (m.kind === "Opening" || m.kind === "Purchase" || m.kind === "Manufactured") {
      qty += m.qty;
      value += m.qty * m.rate;
    }
  }
  return qty > 0 ? value / qty : n(product.purchasePrice);
}

export function stockSummary(data, { from, to, godown } = {}) {
  const all = stockMovements(data);
  // Valuation uses every godown's purchases; quantities can be for one godown.
  const allByProduct = new Map();
  for (const m of all) {
    if (!allByProduct.has(m.productId)) allByProduct.set(m.productId, []);
    allByProduct.get(m.productId).push(m);
  }
  const moves = godown ? all.filter((m) => m.godown === godown) : all.filter((m) => !m.kind.startsWith("Transfer"));
  const byProduct = new Map();
  for (const m of moves) {
    if (!byProduct.has(m.productId)) byProduct.set(m.productId, []);
    byProduct.get(m.productId).push(m);
  }
  const rows = [];
  for (const p of data.products || []) {
    const list = byProduct.get(p.id) || [];
    let opening = 0;
    let inward = 0;
    let outward = 0;
    for (const m of list) {
      if (to && m.date && m.date > to) continue;
      if (m.kind === "Opening" || (from && m.date && m.date < from)) opening += m.qty;
      else if (m.qty > 0) inward += m.qty;
      else outward += -m.qty;
    }
    const closing = opening + inward - outward;
    const valuation = allByProduct.get(p.id) || [];
    const rate = averageRate(valuation, p, to);
    const openRate = from ? averageRate(valuation, p, from) : rate;
    if (!list.length && !n(p.openingStock)) continue;
    rows.push({
      productId: p.id,
      name: p.name,
      unit: p.unit || "",
      hsn: p.hsn || "",
      opening: round2(opening),
      inward: round2(inward),
      outward: round2(outward),
      closing: round2(closing),
      rate: round2(rate),
      openingValue: round2(Math.max(0, opening) * openRate),
      closingValue: round2(Math.max(0, closing) * rate),
      negative: closing < 0,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const totalOpening = round2(rows.reduce((s, r) => s + r.openingValue, 0));
  const totalClosing = round2(rows.reduce((s, r) => s + r.closingValue, 0));
  return { rows, totalOpening, totalClosing };
}

// Value of opening stock entered on products (before any voucher) — the
// capital side of the very first stock on hand.
export function initialStockValue(products = []) {
  return round2(products.reduce((s, p) => s + Math.max(0, n(p.openingStock)) * (n(p.openingRate) || n(p.purchasePrice)), 0));
}

export function productMovements(data, productId, { from, to } = {}) {
  return stockMovements(data).filter((m) => m.productId === productId && (!from || !m.date || m.date >= from) && (!to || !m.date || m.date <= to));
}

// Closing quantity of every product in every godown as on `to`.
export function godownStock(data, { to } = {}) {
  const rows = new Map();
  for (const m of stockMovements(data)) {
    if (to && m.date && m.date > to) continue;
    const key = `${m.productId}|${m.godown}`;
    const cur = rows.get(key) || { productId: m.productId, godown: m.godown, qty: 0 };
    cur.qty = round2(cur.qty + m.qty);
    rows.set(key, cur);
  }
  return [...rows.values()];
}

export function godownNames(data, extra = []) {
  const set = new Set([MAIN_GODOWN, ...extra]);
  for (const m of stockMovements(data)) set.add(m.godown);
  return [...set];
}

/* ─── Batches & expiry ───────────────────────────────────────────────── */

const DAY = 86400000;
const utc = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

// Batch-wise closing stock with expiry status as on `asOn` (FEFO order).
export function batchStock(data, { asOn = new Date().toISOString().slice(0, 10), warnDays = 30 } = {}) {
  const names = new Map((data.products || []).map((p) => [p.id, p]));
  const map = new Map();
  for (const m of stockMovements(data)) {
    if (m.date && m.date > asOn) continue;
    if (m.kind.startsWith("Transfer")) continue;
    const key = `${m.productId}|${m.batch || ""}`;
    const cur = map.get(key) || { productId: m.productId, name: names.get(m.productId)?.name || "", unit: names.get(m.productId)?.unit || "", batch: m.batch || "", expiry: "", qty: 0 };
    cur.qty = round2(cur.qty + m.qty);
    if (m.qty > 0 && m.expiry && !cur.expiry) cur.expiry = toDateKey(m.expiry);
    map.set(key, cur);
  }
  const rows = [...map.values()]
    .filter((r) => (r.batch || r.expiry) && Math.abs(r.qty) > 0.0001)
    .map((r) => {
      const days = r.expiry ? Math.round((utc(r.expiry) - utc(asOn)) / DAY) : null;
      const status = days === null ? "No expiry" : days < 0 ? "Expired" : days <= warnDays ? "Expiring soon" : "OK";
      return { ...r, daysLeft: days, status };
    });
  rows.sort((a, b) => a.name.localeCompare(b.name) || String(a.expiry || "9999").localeCompare(String(b.expiry || "9999")));
  return rows;
}

// Batches of one product with stock left, earliest expiry first (FEFO).
export function availableBatches(data, productId, asOn) {
  return batchStock(data, { asOn }).filter((r) => r.productId === productId && r.qty > 0);
}

/* ─── Bill of materials / manufacturing ──────────────────────────────── */

// Components needed to make `quantity` units of a product from its BOM
// ({ outputQty, components: [{ productId, quantity }] }), with cost at `rates`.
export function bomRequirement(product, quantity, rates = new Map()) {
  const bom = product?.bom || {};
  const per = n(bom.outputQty) || 1;
  const factor = n(quantity) / per;
  const components = (bom.components || [])
    .filter((c) => c.productId && n(c.quantity))
    .map((c) => {
      const qty = round2(n(c.quantity) * factor);
      const rate = round2(rates.get(c.productId) || 0);
      return { productId: c.productId, quantity: qty, rate, value: round2(qty * rate) };
    });
  const cost = round2(components.reduce((s, c) => s + c.value, 0) + n(bom.overhead) * factor);
  return { components, cost, rate: n(quantity) ? round2(cost / n(quantity)) : 0 };
}

// Current weighted-average rate of every product (for costing a manufacture).
export function currentRates(data, to) {
  return new Map(stockSummary(data, { to }).rows.map((r) => [r.productId, r.rate]));
}
