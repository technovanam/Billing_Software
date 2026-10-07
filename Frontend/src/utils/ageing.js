// Bill-wise outstanding with ageing (Tally: Outstandings -> Receivables / Payables).
// Each open bill is bucketed by days past its due date as on `asOn`.
import { invoiceTotalsInr, round2 } from "./gst.js";
import { toDateKey } from "./accounting.js";

export const BUCKETS = ["Not due", "0-30", "31-60", "61-90", "90+"];

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const isLive = (doc) => !/^(draft|cancelled)$/i.test(String(doc?.status || ""));

// Date arithmetic on "YYYY-MM-DD" in UTC so the local timezone never shifts a day.
const utc = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (iso, days) => new Date(utc(iso) + days * 86400000).toISOString().slice(0, 10);

function daysBetween(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function bucketFor(dueDate, asOn) {
  if (!dueDate) return "0-30";
  const d = daysBetween(dueDate, asOn);
  if (d < 0) return "Not due";
  if (d <= 30) return "0-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

function group(bills, asOn) {
  const parties = new Map();
  for (const b of bills) {
    if (b.balance < 0.5) continue;
    const bucket = bucketFor(b.dueDate, asOn);
    const overdueDays = b.dueDate ? Math.max(0, daysBetween(b.dueDate, asOn)) : 0;
    const p = parties.get(b.partyKey) || { party: b.party, total: 0, buckets: Object.fromEntries(BUCKETS.map((k) => [k, 0])), bills: [] };
    p.total = round2(p.total + b.balance);
    p.buckets[bucket] = round2(p.buckets[bucket] + b.balance);
    p.bills.push({ ...b, bucket, overdueDays });
    parties.set(b.partyKey, p);
  }
  const rows = [...parties.values()].sort((a, b) => b.total - a.total);
  for (const r of rows) r.bills.sort((a, b) => b.overdueDays - a.overdueDays);
  const totals = Object.fromEntries(BUCKETS.map((k) => [k, round2(rows.reduce((s, r) => s + r.buckets[k], 0))]));
  totals.total = round2(rows.reduce((s, r) => s + r.total, 0));
  return { rows, totals };
}

// Money customers owe: invoice total − received − TDS − credit notes.
export function receivablesAgeing(invoices = [], asOn = new Date().toISOString().slice(0, 10)) {
  const bills = invoices
    .filter((inv) => isLive(inv) && toDateKey(inv.invoiceDate) <= asOn)
    .map((inv) => {
      const total = n(inv.amount) || invoiceTotalsInr(inv).total;
      const settled = String(inv.status).toLowerCase() === "paid" ? total : n(inv.paidAmount ?? inv.received) + n(inv.tdsAmount) + n(inv.creditedAmount) + n(inv.advanceAdjusted);
      return {
        id: inv.id,
        partyKey: inv.clientId || inv.client?.id || inv.client?.name || "—",
        party: inv.client?.name || inv.customerName || "Unknown customer",
        number: inv.invoiceNumber,
        date: toDateKey(inv.invoiceDate),
        dueDate: toDateKey(inv.dueDate) || toDateKey(inv.invoiceDate),
        amount: round2(total),
        balance: round2(Math.max(0, total - settled)),
      };
    });
  return group(bills, asOn);
}

// Money you owe suppliers: purchase total − paid − debit notes against it.
export function payablesAgeing(purchases = [], debitNotes = [], asOn = new Date().toISOString().slice(0, 10), creditDays = 30) {
  const returned = new Map();
  for (const d of debitNotes) if (d.linkedId) returned.set(d.linkedId, round2((returned.get(d.linkedId) || 0) + invoiceTotalsInr(d).total));
  const bills = purchases
    .filter((p) => toDateKey(p.voucherDate) <= asOn)
    .map((p) => {
      const total = invoiceTotalsInr(p).total;
      const billDate = toDateKey(p.supplierBillDate || p.voucherDate);
      const due = p.dueDate ? toDateKey(p.dueDate) : addDays(billDate, creditDays);
      return {
        id: p.id,
        partyKey: p.partyId || p.party?.name || "—",
        party: p.party?.name || "Unknown supplier",
        number: p.supplierBillNumber || p.voucherNumber,
        date: billDate,
        dueDate: due,
        amount: round2(total),
        balance: round2(Math.max(0, total - n(p.paidAmount) - (returned.get(p.id) || 0))),
      };
    });
  return group(bills, asOn);
}
