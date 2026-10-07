// Year-end closing, Tally style. Books run continuously, so balance-sheet
// ledgers carry forward by themselves; closing a year
//   - shows the closing balances that become next year's opening balances,
//   - moves that year's profit into the opening balance of the P&L A/c, and
//   - locks vouchers dated in the closed year so they can't be changed by mistake.
import { GROUPS, ledgerBalances, profitAndLoss, toDateKey } from "./accounting.js";
import { round2 } from "./gst.js";

export const fyStart = (fy) => `${fy}-04-01`;
export const fyEnd = (fy) => `${Number(fy) + 1}-03-31`;
export const fyLabel = (fy) => `${fy}-${String(Number(fy) + 1).slice(2)}`;

// Closing balances of balance-sheet ledgers on the last day of the year.
export function carryForward(entries, fy, stock = { initial: 0, closing: 0 }) {
  const to = fyEnd(fy);
  const rows = ledgerBalances(entries, { to })
    .filter((b) => GROUPS[b.group]?.statement === "bs" && Math.abs(b.balance) >= 0.005)
    .map((b) => ({ ledger: b.ledger, group: b.group, debit: b.balance > 0 ? round2(b.balance) : 0, credit: b.balance < 0 ? round2(-b.balance) : 0 }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.ledger.localeCompare(b.ledger));
  const year = profitAndLoss(entries, { from: fyStart(fy), to }, { openingStock: stock.opening ?? 0, closingStock: stock.closing || 0 });
  const total = profitAndLoss(entries, { to }, { openingStock: stock.initial || 0, closingStock: stock.closing || 0 });
  return { to, rows, netProfit: year.netProfit, retained: total.netProfit, closingStock: round2(stock.closing || 0) };
}

/* ─── Lock: no changes to vouchers dated on or before the lock date ─────── */

// Collections whose documents are dated vouchers.
export const DATED_COLLECTIONS = new Set([
  "invoices",
  "payments",
  "expenses",
  "creditNotes",
  "debitNotes",
  "purchases",
  "journals",
  "stockJournals",
  "advanceReceipts",
  "payrollRuns",
  "deliveryChallans",
  "cheques",
]);

// Fields that change the books. Settling an old bill (payment status, amount
// received, TDS, e-invoice IRN…) in the new year is still allowed.
const BOOK_FIELDS = new Set([
  "items",
  "products",
  "lines",
  "amount",
  "total",
  "taxableAmount",
  "cgstAmount",
  "sgstAmount",
  "igstAmount",
  "cessAmount",
  "totalTax",
  "invoiceDate",
  "voucherDate",
  "expenseDate",
  "date",
  "client",
  "clientId",
  "party",
  "partyId",
  "isInterState",
  "placeOfSupply",
  "quantity",
  "rate",
  "category",
  "reverseCharge",
  "supplyType",
  "isGstEnabled",
  "exchangeRate",
  "currency",
]);

const DATE_FIELDS = ["invoiceDate", "voucherDate", "expenseDate", "paymentDate", "challanDate", "clearedOn", "date", "runDate"];

// "YYYY-MM-DD" from any stored date (Timestamp, Date, ISO or dd/mm/yyyy).
export function dateKeyOf(v) {
  if (typeof v === "string") {
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return toDateKey(v);
}

export function voucherDateKey(doc) {
  if (!doc) return "";
  const ym = doc.ym || doc.month;
  if (ym && /^\d{4}-\d{2}$/.test(ym)) return `${ym}-01`; // payroll runs
  for (const f of DATE_FIELDS) if (doc[f]) return dateKeyOf(doc[f]);
  return "";
}

// Why a write is refused, or "" if it is allowed.
export function lockViolation(lockedUpTo, collectionName, { before = null, after = null, patch = null } = {}) {
  if (!lockedUpTo || !DATED_COLLECTIONS.has(collectionName)) return "";
  const closed = (d) => d && d <= lockedUpTo;
  const msg = `Books are closed up to ${lockedUpTo}. Reopen the year in Books & Statements → Year End to change this.`;
  if (patch) {
    const touchesBooks = Object.keys(patch).some((k) => BOOK_FIELDS.has(k));
    if (!touchesBooks) return "";
    if (closed(voucherDateKey(before)) || closed(voucherDateKey({ ...(before || {}), ...patch }))) return msg;
    return "";
  }
  if (closed(voucherDateKey(before)) || closed(voucherDateKey(after))) return msg;
  return "";
}
