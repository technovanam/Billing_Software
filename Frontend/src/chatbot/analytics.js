// Business numbers the chatbot answers from. Every function takes plain data
// (invoices, payments, expenses, products, stock) so it can be tested alone.
// Rules match the rest of the app: drafts are not sales, a partly paid
// invoice owes only its balance, and TDS counts as settled.
import { toDate, inPeriod, startOfDay } from "./dates.js";
import { normalize } from "./text.js";

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const isDraft = (inv) => String(inv?.status || "").toLowerCase() === "draft";
export const invoiceTotal = (inv) => num(inv?.amount ?? inv?.total ?? inv?.totalAmount);
export const invoiceDate = (inv) => toDate(inv?.invoiceDate) || toDate(inv?.createdAt);

// Paid + TDS + credit notes issued against the invoice.
export function settledAmount(inv) {
  const covered = num(inv?.paidAmount) + num(inv?.tdsAmount) + num(inv?.creditedAmount) + num(inv?.advanceAdjusted);
  if (String(inv?.status || "").toLowerCase() === "paid") return Math.max(covered, invoiceTotal(inv));
  return covered;
}

// Amounts under ₹1 are rounding, not dues.
export const invoiceBalance = (inv) => {
  const b = invoiceTotal(inv) - settledAmount(inv);
  return b >= 1 ? b : 0;
};

export function invoiceStatus(inv, today = new Date()) {
  if (isDraft(inv)) return "Draft";
  const balance = invoiceBalance(inv);
  if (balance === 0) return "Paid";
  const due = toDate(inv.dueDate);
  if (due && startOfDay(today) > due) return "Overdue";
  return settledAmount(inv) > 0 ? "Partial" : "Unpaid";
}

export const customerIdOf = (inv) => inv?.clientId || inv?.client?.id || inv?.customerId || null;
export const customerNameOf = (inv) =>
  inv?.client?.name || inv?.client?.companyName || inv?.client?.displayName || inv?.clientName || inv?.customerName || "Walk-in customer";
export const customerDisplayName = (c) =>
  c?.name || c?.companyName || c?.displayName || [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "Customer";

const itemsOf = (inv) => inv?.items || inv?.products || [];
const lineQty = (it) => num(it.quantity ?? it.qty ?? 1);
const lineAmount = (it) => num(it.amount ?? it.total ?? lineQty(it) * num(it.rate ?? it.price));
const lineName = (it) => it.description || it.name || it.productName || "Item";

// Real (non-draft) invoices, optionally limited to a period.
export const salesInvoices = (invoices, period) =>
  (invoices || []).filter((inv) => !isDraft(inv) && inPeriod(invoiceDate(inv), period));

export function salesSummary(invoices, period) {
  const list = salesInvoices(invoices, period);
  const billed = list.reduce((s, inv) => s + invoiceTotal(inv), 0);
  const balance = list.reduce((s, inv) => s + invoiceBalance(inv), 0);
  return { count: list.length, billed, collected: billed - balance, balance, average: list.length ? billed / list.length : 0, invoices: list };
}

export function paymentsReceived(payments, period) {
  const list = (payments || []).filter((p) => {
    const status = String(p.status || p.paymentStatus || "").toLowerCase();
    return status !== "refunded" && status !== "failed" && inPeriod(toDate(p.paymentDate) || toDate(p.paidAt) || toDate(p.createdAt), period);
  });
  return { count: list.length, total: list.reduce((s, p) => s + num(p.amount), 0) };
}

// Outstanding money per customer, largest first.
export function receivables(invoices, today = new Date()) {
  const byCustomer = new Map();
  for (const inv of invoices || []) {
    if (isDraft(inv)) continue;
    const balance = invoiceBalance(inv);
    if (!balance) continue;
    const key = customerIdOf(inv) || `name:${normalize(customerNameOf(inv))}`;
    const row = byCustomer.get(key) || { customerId: customerIdOf(inv), name: customerNameOf(inv), balance: 0, overdue: 0, invoices: [] };
    row.balance += balance;
    if (invoiceStatus(inv, today) === "Overdue") row.overdue += balance;
    row.invoices.push(inv);
    byCustomer.set(key, row);
  }
  return [...byCustomer.values()].sort((a, b) => b.balance - a.balance);
}

export function overdueInvoices(invoices, today = new Date()) {
  return (invoices || [])
    .filter((inv) => invoiceStatus(inv, today) === "Overdue")
    .map((inv) => ({ inv, balance: invoiceBalance(inv), days: Math.round((startOfDay(today) - toDate(inv.dueDate)) / 86400000) }))
    .sort((a, b) => b.days - a.days);
}

export function productSales(invoices, period) {
  const map = new Map();
  for (const inv of salesInvoices(invoices, period)) {
    for (const it of itemsOf(inv)) {
      const key = it.productId || `name:${normalize(lineName(it))}`;
      const row = map.get(key) || { productId: it.productId || null, name: lineName(it), units: 0, revenue: 0, bills: 0 };
      row.units += lineQty(it);
      row.revenue += lineAmount(it);
      row.bills += 1;
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function customerSales(invoices, period) {
  const map = new Map();
  for (const inv of salesInvoices(invoices, period)) {
    const key = customerIdOf(inv) || `name:${normalize(customerNameOf(inv))}`;
    const row = map.get(key) || { customerId: customerIdOf(inv), name: customerNameOf(inv), billed: 0, balance: 0, bills: 0, last: null };
    row.billed += invoiceTotal(inv);
    row.balance += invoiceBalance(inv);
    row.bills += 1;
    const d = invoiceDate(inv);
    if (d && (!row.last || d > row.last)) row.last = d;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.billed - a.billed);
}

// GST charged on bills: rates are stored per invoice; amounts come from the subtotal.
export function gstSummary(invoices, period) {
  const t = { taxable: 0, cgst: 0, sgst: 0, igst: 0, bills: 0 };
  for (const inv of salesInvoices(invoices, period)) {
    // Item-wise invoices store their taxable value (after discounts).
    const subtotal = inv.taxableAmount !== undefined
      ? num(inv.taxableAmount)
      : itemsOf(inv).reduce((s, it) => s + lineQty(it) * num(it.rate ?? it.price), 0);
    t.taxable += subtotal;
    t.bills += 1;
    if (inv.isGstEnabled === false) continue;
    t.cgst += inv.cgstAmount !== undefined ? num(inv.cgstAmount) : (subtotal * num(inv.cgst)) / 100;
    t.sgst += inv.sgstAmount !== undefined ? num(inv.sgstAmount) : (subtotal * num(inv.sgst)) / 100;
    t.igst += inv.igstAmount !== undefined ? num(inv.igstAmount) : (subtotal * num(inv.igst)) / 100;
  }
  return { ...t, total: t.cgst + t.sgst + t.igst };
}

export const expenseDate = (e) => toDate(e?.expenseDate) || toDate(e?.date) || toDate(e?.createdAt);

export function expenseSummary(expenses, period) {
  const list = (expenses || []).filter((e) => inPeriod(expenseDate(e), period));
  const byCategory = new Map();
  for (const e of list) {
    const cat = e.category || "Other Expenses";
    byCategory.set(cat, (byCategory.get(cat) || 0) + num(e.amount));
  }
  return {
    count: list.length,
    total: list.reduce((s, e) => s + num(e.amount), 0),
    categories: [...byCategory.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
    expenses: list,
  };
}

export function profitSummary(invoices, expenses, period) {
  const sales = salesSummary(invoices, period);
  const gst = gstSummary(invoices, period);
  const spent = expenseSummary(expenses, period).total;
  // GST collected is owed to the government, so profit uses sales before tax.
  const netSales = sales.billed - gst.total;
  return { sales: sales.billed, gst: gst.total, netSales, expenses: spent, profit: netSales - spent };
}

// Stock on hand per product from users/{uid}/stock (all godowns added up).
export function stockByProduct(stockDocs) {
  const map = new Map();
  for (const s of stockDocs || []) {
    if (!s.productId) continue;
    map.set(s.productId, (map.get(s.productId) || 0) + num(s.quantity));
  }
  return map;
}

/**
 * Stock on hand per product (out-of-stock flagged), with how long it lasts
 * at the last 30 days' selling rate. Products without stock records
 * are reported separately rather than guessed.
 */
export function stockReport(products, stockDocs, invoices, today = new Date()) {
  const onHand = stockByProduct(stockDocs);
  const last30 = { start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29), end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) };
  const sold = new Map(productSales(invoices, last30).map((r) => [r.productId || r.name, r.units]));
  const rows = [];
  const untracked = [];
  for (const p of products || []) {
    if (p.isActive === false) continue;
    if (!onHand.has(p.id)) {
      untracked.push(p);
      continue;
    }
    const qty = onHand.get(p.id);
    const perDay = (sold.get(p.id) || sold.get(p.name) || 0) / 30;
    rows.push({ product: p, qty, perDay, daysLeft: perDay > 0 ? Math.floor(qty / perDay) : null, low: qty <= 0 });
  }
  rows.sort((a, b) => a.qty - b.qty);
  return { rows, low: rows.filter((r) => r.low), untracked };
}

export function customerProfile(customer, invoices, today = new Date()) {
  const mine = (invoices || []).filter((inv) => !isDraft(inv) && (customerIdOf(inv) === customer.id || normalize(customerNameOf(inv)) === normalize(customerDisplayName(customer))));
  const billed = mine.reduce((s, inv) => s + invoiceTotal(inv), 0);
  const balance = mine.reduce((s, inv) => s + invoiceBalance(inv), 0);
  const overdue = mine.filter((inv) => invoiceStatus(inv, today) === "Overdue");
  const dates = mine.map(invoiceDate).filter(Boolean).sort((a, b) => b - a);
  const products = productSales(mine).slice(0, 3);
  return { invoices: mine, billed, balance, overdue, lastBill: dates[0] || null, products };
}

export function productProfile(product, invoices, stockDocs, period) {
  const rows = productSales(invoices, period);
  const row = rows.find((r) => r.productId === product.id) || rows.find((r) => normalize(r.name) === normalize(product.name));
  const onHand = stockByProduct(stockDocs);
  return { units: row?.units || 0, revenue: row?.revenue || 0, bills: row?.bills || 0, stock: onHand.has(product.id) ? onHand.get(product.id) : null };
}

// "005", "5", "005/2026-27", "INV-005" -> the matching invoice(s).
export function findInvoicesByNumber(invoices, ref) {
  const clean = String(ref || "").trim().toLowerCase();
  if (!clean) return [];
  const exact = (invoices || []).filter((inv) => String(inv.invoiceNumber || "").toLowerCase() === clean);
  if (exact.length) return exact;
  const n = Number((clean.match(/\d+/) || [])[0]);
  if (!Number.isFinite(n)) return [];
  return (invoices || [])
    .filter((inv) => {
      const m = String(inv.invoiceNumber || "").match(/(\d+)(?:\/\d{4}-\d{2})?$/);
      return m && Number(m[1]) === n;
    })
    .sort((a, b) => (invoiceDate(b) || 0) - (invoiceDate(a) || 0));
}

/**
 * Splits a payment across a customer's unpaid invoices, oldest first.
 * Returns the per-invoice amounts and anything left over.
 */
export function allocatePayment(customerInvoices, amount) {
  let left = num(amount);
  const open = (customerInvoices || [])
    .filter((inv) => !isDraft(inv) && invoiceBalance(inv) > 0)
    .sort((a, b) => (invoiceDate(a) || 0) - (invoiceDate(b) || 0));
  const lines = [];
  for (const inv of open) {
    if (left <= 0) break;
    const pay = Math.min(left, invoiceBalance(inv));
    lines.push({ invoice: inv, amount: Math.round(pay * 100) / 100, clears: pay >= invoiceBalance(inv) });
    left -= pay;
  }
  return { lines, unapplied: Math.max(0, Math.round(left * 100) / 100), openCount: open.length };
}

// New invoice fields after a payment, using the same rules as the Payments page.
export function invoiceAfterPayment(inv, amount, method, dateLabel) {
  const paid = num(inv.paidAmount) + num(amount);
  const covered = paid + num(inv.tdsAmount);
  const total = invoiceTotal(inv);
  const status = Math.abs(total - covered) < 5 || covered >= total ? "Paid" : covered > 0 ? "Partial" : "Unpaid";
  return { paidAmount: paid, status, paymentMethod: method, paymentDate: dateLabel };
}
