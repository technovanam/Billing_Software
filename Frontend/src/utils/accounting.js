// Double-entry books, Tally style. Every voucher (sales, credit note, purchase,
// debit note, receipt, expense, journal) is turned into balanced Dr/Cr lines
// against standard ledgers grouped like Tally's chart of accounts. Day Book,
// Ledger, Trial Balance, Profit & Loss and Balance Sheet are all read from
// these postings, so they always agree with each other.
import { invoiceTotalsInr as invoiceTotals, round2 } from "./gst.js";
import { payrollJournalLines } from "./payroll.js";

// Tally's primary groups and which statement each belongs to.
export const GROUPS = {
  "Sales Accounts": { nature: "income", statement: "pl", trading: true },
  "Purchase Accounts": { nature: "expense", statement: "pl", trading: true },
  "Direct Expenses": { nature: "expense", statement: "pl", trading: true },
  "Indirect Expenses": { nature: "expense", statement: "pl" },
  "Indirect Incomes": { nature: "income", statement: "pl" },
  "Sundry Debtors": { nature: "asset", statement: "bs" },
  "Sundry Creditors": { nature: "liability", statement: "bs" },
  "Duties & Taxes": { nature: "liability", statement: "bs" },
  "Cash-in-Hand": { nature: "asset", statement: "bs" },
  "Bank Accounts": { nature: "asset", statement: "bs" },
  "Current Assets": { nature: "asset", statement: "bs" },
  "Fixed Assets": { nature: "asset", statement: "bs" },
  "Loans (Liability)": { nature: "liability", statement: "bs" },
  "Current Liabilities": { nature: "liability", statement: "bs" },
  "Capital Account": { nature: "liability", statement: "bs" },
};

export const LEDGERS = {
  sales: { name: "Sales", group: "Sales Accounts" },
  salesReturns: { name: "Sales Returns", group: "Sales Accounts" },
  purchases: { name: "Purchases", group: "Purchase Accounts" },
  purchaseReturns: { name: "Purchase Returns", group: "Purchase Accounts" },
  outCgst: { name: "Output CGST", group: "Duties & Taxes" },
  outSgst: { name: "Output SGST", group: "Duties & Taxes" },
  outIgst: { name: "Output IGST", group: "Duties & Taxes" },
  inCgst: { name: "Input CGST", group: "Duties & Taxes" },
  inSgst: { name: "Input SGST", group: "Duties & Taxes" },
  inIgst: { name: "Input IGST", group: "Duties & Taxes" },
  roundOff: { name: "Round Off", group: "Indirect Expenses" },
  cash: { name: "Cash", group: "Cash-in-Hand" },
  bank: { name: "Bank", group: "Bank Accounts" },
  tds: { name: "TDS Receivable", group: "Current Assets" },
  opening: { name: "Opening Balance Difference", group: "Capital Account" },
  rcmPayable: { name: "RCM Tax Payable", group: "Duties & Taxes" },
  forex: { name: "Forex Gain / Loss", group: "Indirect Incomes" },
  outCess: { name: "Output Cess", group: "Duties & Taxes" },
  inCess: { name: "Input Cess", group: "Duties & Taxes" },
  tcsPayable: { name: "TCS Payable", group: "Duties & Taxes" },
  tcsReceivable: { name: "TCS Receivable", group: "Current Assets" },
  advanceGst: { name: "GST on Advances", group: "Current Assets" },
};

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// Calendar date in the user's own timezone (an IST time just after midnight
// must not fall on the previous UTC day).
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function toDateKey(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return isNaN(v) ? "" : localKey(v);
  if (typeof v.toDate === "function") return localKey(v.toDate());
  if (v.seconds) return localKey(new Date(v.seconds * 1000));
  return String(v).slice(0, 10);
}

const nameOf = (p) => p?.name || p?.displayName || p?.companyName || "Unknown";
export const customerLedger = (party) => ({ name: nameOf(party), group: "Sundry Debtors" });
export const supplierLedger = (party) => ({ name: nameOf(party), group: "Sundry Creditors" });

// The bank/cash ledger money moved through. A named account (from the chart
// of accounts) wins; otherwise Cash for cash and Bank for everything else.
let ACCOUNT_GROUPS = new Map();
export function moneyLedger(method, account) {
  if (account && ACCOUNT_GROUPS.has(account)) return { name: account, group: ACCOUNT_GROUPS.get(account) };
  return /^cash$/i.test(String(method || "").trim()) ? LEDGERS.cash : LEDGERS.bank;
}

// Ledger masters (chart of accounts) kept in users/{uid}/ledgers with kind "account".
export const isAccountMaster = (doc) => doc?.kind === "account" && doc.name;

// Signed lines (+ = Dr, − = Cr) -> {ledger, group, dr, cr}, dropping zeros.
function lines(list) {
  return list
    .filter(([, amt]) => Math.abs(n(amt)) >= 0.005)
    .map(([ledger, amt]) => ({ ledger: ledger.name, group: ledger.group, dr: amt > 0 ? round2(amt) : 0, cr: amt < 0 ? round2(-amt) : 0 }));
}

const isLive = (doc) => !/^(draft|cancelled)$/i.test(String(doc?.status || ""));

// Every voucher -> balanced journal entries.
export function buildEntries({ invoices = [], creditNotes = [], purchases = [], debitNotes = [], payments = [], expenses = [], journals = [], customers = [], suppliers = [], payrollRuns = [], accounts = [], advances = [] } = {}) {
  const masters = accounts.filter(isAccountMaster);
  ACCOUNT_GROUPS = new Map(masters.map((a) => [a.name, a.group || "Bank Accounts"]));
  const entries = [];
  const custById = new Map(customers.map((c) => [c.id, c]));
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const push = (e) => entries.push({ ...e, lines: lines(e.lines) });
  const cc = (doc) => (doc?.costCentre ? { costCentre: doc.costCentre } : {});

  for (const inv of invoices) {
    if (!isLive(inv)) continue;
    const t = invoiceTotals(inv);
    const party = inv.client || custById.get(inv.clientId);
    push({
      id: `sales:${inv.id}`,
      ...cc(inv),
      date: toDateKey(inv.invoiceDate || inv.createdAt),
      type: "Sales",
      number: inv.invoiceNumber || "",
      party: nameOf(party),
      narration: `Sales invoice ${inv.invoiceNumber || ""}`,
      ref: { collection: "invoices", id: inv.id },
      lines: [
        [customerLedger(party), t.total],
        [LEDGERS.sales, -t.taxableAmount],
        // Under reverse charge the buyer pays the tax, so none is collected here.
        [LEDGERS.outCgst, t.reverseCharge ? 0 : -t.cgstAmount],
        [LEDGERS.outSgst, t.reverseCharge ? 0 : -t.sgstAmount],
        [LEDGERS.outIgst, t.reverseCharge ? 0 : -t.igstAmount],
        [LEDGERS.outCess, t.reverseCharge ? 0 : -n(t.cessAmount)],
        [LEDGERS.tcsPayable, -n(t.tcsAmount)],
        [LEDGERS.roundOff, -t.roundOffAmount],
      ],
    });
    // TDS the customer deducted is held as an asset until claimed.
    if (n(inv.tdsAmount) > 0) {
      push({
        id: `tds:${inv.id}`,
        date: toDateKey(inv.paymentDate || inv.invoiceDate),
        type: "Journal",
        number: inv.invoiceNumber || "",
        party: nameOf(party),
        narration: `TDS deducted by customer on ${inv.invoiceNumber || "invoice"}`,
        ref: { collection: "invoices", id: inv.id },
        lines: [
          [LEDGERS.tds, n(inv.tdsAmount)],
          [customerLedger(party), -n(inv.tdsAmount)],
        ],
      });
    }
  }

  // Receipts: payment records, plus any amount marked paid on an invoice that
  // has no matching payment record (older data).
  const paidByInvoice = new Map();
  for (const p of payments) {
    if (String(p.status || "completed").toLowerCase() === "failed") continue;
    const inv = invById.get(p.invoiceId);
    const party = inv?.client || custById.get(p.clientId || inv?.clientId) || { name: p.customerName };
    const amt = n(p.amount);
    if (amt <= 0) continue;
    paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) || 0) + amt);
    push({
      id: `receipt:${p.id}`,
      date: toDateKey(p.paymentDate || p.createdAt),
      type: "Receipt",
      number: p.transactionId || inv?.invoiceNumber || "",
      party: nameOf(party),
      narration: `Received against ${p.invoiceNumber || inv?.invoiceNumber || "invoice"} by ${p.method || p.paymentMethod || "—"}`,
      ref: { collection: "payments", id: p.id },
      // Export receipts: the bank gets amount + forex gain; the customer is cleared at the invoice rate.
      lines: [
        [moneyLedger(p.method || p.paymentMethod, p.account), amt + n(p.forexGain)],
        [customerLedger(party), -amt],
        ...(n(p.forexGain) ? [[LEDGERS.forex, -n(p.forexGain)]] : []),
      ],
    });
  }
  for (const inv of invoices) {
    if (!isLive(inv)) continue;
    const recorded = n(inv.paidAmount ?? inv.received) - (paidByInvoice.get(inv.id) || 0);
    if (recorded > 0.5) {
      const party = inv.client || custById.get(inv.clientId);
      push({
        id: `receipt-inv:${inv.id}`,
        date: toDateKey(inv.paymentDate || inv.invoiceDate),
        type: "Receipt",
        number: inv.invoiceNumber || "",
        party: nameOf(party),
        narration: `Amount received on ${inv.invoiceNumber || "invoice"}`,
        ref: { collection: "invoices", id: inv.id },
        lines: [
          [moneyLedger(inv.paymentMethod, inv.paymentAccount), recorded],
          [customerLedger(party), -recorded],
        ],
      });
    }
  }

  // Advance receipts: money in, held as a credit on the customer. GST paid on the
  // advance is parked in "GST on Advances" and reversed when the invoice is raised.
  for (const a of advances) {
    if (String(a.status || "").toLowerCase() === "cancelled") continue;
    const t = invoiceTotals(a);
    const amt = n(a.amount) || t.total;
    if (amt <= 0) continue;
    const party = a.party || custById.get(a.partyId);
    const ref = { collection: "advanceReceipts", id: a.id };
    push({
      id: `advance:${a.id}`,
      date: toDateKey(a.voucherDate),
      type: "Receipt",
      number: a.voucherNumber,
      party: nameOf(party),
      narration: `Advance received by ${a.method || "Bank"}`,
      ref,
      lines: [
        [moneyLedger(a.method, a.account), amt],
        [customerLedger(party), -amt],
      ],
    });
    if (t.totalTax > 0) {
      const taxLines = (sign) => [
        [LEDGERS.advanceGst, sign * t.totalTax],
        [LEDGERS.outCgst, -sign * t.cgstAmount],
        [LEDGERS.outSgst, -sign * t.sgstAmount],
        [LEDGERS.outIgst, -sign * t.igstAmount],
      ];
      push({ id: `advance-gst:${a.id}`, date: toDateKey(a.voucherDate), type: "Journal", number: a.voucherNumber, party: nameOf(party), narration: "GST on advance received", ref, lines: taxLines(1) });
      if (a.adjustedDate) {
        push({
          id: `advance-adj:${a.id}`,
          date: toDateKey(a.adjustedDate),
          type: "Journal",
          number: a.voucherNumber,
          party: nameOf(party),
          narration: `Advance adjusted against ${a.adjustedInvoiceNumber || "invoice"}`,
          ref,
          lines: taxLines(-1),
        });
      }
    }
  }

  for (const cn of creditNotes) {
    const t = invoiceTotals(cn);
    push({
      id: `cn:${cn.id}`,
      ...cc(cn),
      date: toDateKey(cn.voucherDate),
      type: "Credit Note",
      number: cn.voucherNumber,
      party: nameOf(cn.party),
      narration: `${cn.reason || "Credit note"}${cn.linkedNumber ? ` against ${cn.linkedNumber}` : ""}`,
      ref: { collection: "creditNotes", id: cn.id },
      lines: [
        [LEDGERS.salesReturns, t.taxableAmount],
        [LEDGERS.outCgst, t.reverseCharge ? 0 : t.cgstAmount],
        [LEDGERS.outSgst, t.reverseCharge ? 0 : t.sgstAmount],
        [LEDGERS.outIgst, t.reverseCharge ? 0 : t.igstAmount],
        [LEDGERS.outCess, t.reverseCharge ? 0 : n(t.cessAmount)],
        [LEDGERS.tcsPayable, n(t.tcsAmount)],
        [LEDGERS.roundOff, t.roundOffAmount],
        [customerLedger(cn.party), -t.total],
      ],
    });
  }

  for (const p of purchases) {
    const t = invoiceTotals(p);
    push({
      id: `purchase:${p.id}`,
      ...cc(p),
      date: toDateKey(p.voucherDate),
      type: "Purchase",
      number: p.voucherNumber,
      party: nameOf(p.party),
      narration: `Purchase bill ${p.supplierBillNumber || ""}`.trim(),
      ref: { collection: "purchases", id: p.id },
      lines: [
        [LEDGERS.purchases, t.taxableAmount],
        [LEDGERS.inCgst, t.cgstAmount],
        [LEDGERS.inSgst, t.sgstAmount],
        [LEDGERS.inIgst, t.igstAmount],
        [LEDGERS.inCess, n(t.cessAmount)],
        [LEDGERS.tcsReceivable, n(t.tcsAmount)],
        [LEDGERS.roundOff, t.roundOffAmount],
        [supplierLedger(p.party), -t.total],
        // Reverse charge: we pay this GST to the government (and claim it as ITC).
        [LEDGERS.rcmPayable, t.reverseCharge ? -t.totalTax : 0],
      ],
    });
    if (n(p.paidAmount) > 0) {
      push({
        id: `payment-pur:${p.id}`,
        date: toDateKey(p.paidDate || p.voucherDate),
        type: "Payment",
        number: p.voucherNumber,
        party: nameOf(p.party),
        narration: `Paid against ${p.supplierBillNumber || p.voucherNumber} by ${p.paymentMethod || "Bank"}`,
        ref: { collection: "purchases", id: p.id },
        lines: [
          [supplierLedger(p.party), n(p.paidAmount)],
          [moneyLedger(p.paymentMethod || "Bank", p.paymentAccount), -n(p.paidAmount)],
        ],
      });
    }
  }

  for (const d of debitNotes) {
    const t = invoiceTotals(d);
    push({
      id: `dn:${d.id}`,
      ...cc(d),
      date: toDateKey(d.voucherDate),
      type: "Debit Note",
      number: d.voucherNumber,
      party: nameOf(d.party),
      narration: `${d.reason || "Debit note"}${d.linkedNumber ? ` against ${d.linkedNumber}` : ""}`,
      ref: { collection: "debitNotes", id: d.id },
      lines: [
        [supplierLedger(d.party), t.total],
        [LEDGERS.purchaseReturns, -t.taxableAmount],
        [LEDGERS.inCgst, -t.cgstAmount],
        [LEDGERS.inSgst, -t.sgstAmount],
        [LEDGERS.inIgst, -t.igstAmount],
        [LEDGERS.inCess, -n(t.cessAmount)],
        [LEDGERS.tcsReceivable, -n(t.tcsAmount)],
        [LEDGERS.roundOff, -t.roundOffAmount],
        [LEDGERS.rcmPayable, t.reverseCharge ? t.totalTax : 0],
      ],
    });
  }

  for (const e of expenses) {
    const amt = n(e.amount);
    if (amt <= 0) continue;
    push({
      id: `expense:${e.id}`,
      ...cc(e),
      date: toDateKey(e.expenseDate || e.date || e.createdAt),
      type: "Payment",
      number: e.invoiceNumber || "",
      party: e.title || e.category || "Expense",
      narration: e.title || e.category || "Expense",
      ref: { collection: "expenses", id: e.id },
      lines: [
        [{ name: e.category || "General Expenses", group: "Indirect Expenses" }, amt],
        [moneyLedger(e.paymentMethod || "Cash", e.paymentAccount), -amt],
      ],
    });
  }

  // Opening balances: ledger masters (Dr positive / Cr negative) and customers
  // (amount receivable), balanced against "Opening Balance Difference".
  for (const a of masters) {
    const ob = n(a.openingBalance) * (a.openingSide === "Cr" ? -1 : 1);
    if (!ob) continue;
    push({
      id: `opening-ledger:${a.id}`,
      date: "",
      type: "Opening",
      number: "",
      party: a.name,
      narration: "Opening balance",
      ref: { collection: "ledgers", id: a.id },
      lines: [
        [{ name: a.name, group: a.group || "Current Assets" }, ob],
        [LEDGERS.opening, -ob],
      ],
    });
  }
  for (const c of customers) {
    const ob = n(c.openingBalance);
    if (!ob) continue;
    push({
      id: `opening-customer:${c.id}`,
      date: "",
      type: "Opening",
      number: "",
      party: nameOf(c),
      narration: "Opening balance",
      ref: { collection: "customers", id: c.id },
      lines: [
        [customerLedger(c), ob],
        [LEDGERS.opening, -ob],
      ],
    });
  }

  for (const s of suppliers) {
    const ob = n(s.openingBalance);
    if (!ob) continue;
    push({
      id: `opening:${s.id}`,
      date: "",
      type: "Opening",
      number: "",
      party: nameOf(s),
      narration: "Opening balance",
      ref: { collection: "suppliers", id: s.id },
      lines: [
        [LEDGERS.opening, ob],
        [supplierLedger(s), -ob],
      ],
    });
  }

  // Manual journals / contra / payment / receipt vouchers: lines given as
  // [{ ledger, group, dr, cr }].
  for (const j of journals) {
    const list = (j.lines || []).map((l) => [{ name: l.ledger, group: l.group || "Current Assets" }, n(l.dr) - n(l.cr)]);
    push({
      id: `journal:${j.id}`,
      ...cc(j),
      date: toDateKey(j.voucherDate),
      type: j.voucherType || "Journal",
      number: j.voucherNumber || "",
      party: j.party || "",
      narration: j.narration || "",
      ref: { collection: "journals", id: j.id },
      lines: list,
    });
  }

  for (const run of payrollRuns) {
    if (!run.totals) continue;
    const [y, m] = String(run.ym || "").split("-").map(Number);
    const last = y && m ? `${run.ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` : toDateKey(run.createdAt);
    push({
      id: `payroll:${run.id}`,
      date: last,
      type: "Payroll",
      number: run.voucherNumber || `PAY-${run.ym}`,
      party: "Employees",
      narration: `Salary for ${run.ym}`,
      ref: { collection: "payrollRuns", id: run.id },
      ...cc(run),
      lines: payrollJournalLines(run.totals).map((l) => [{ name: l.ledger, group: l.group }, l.dr - l.cr]),
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || String(a.number).localeCompare(String(b.number)));
}

// Income and spend per cost centre (project / branch / department).
export function costCentreReport(entries, period = {}) {
  const map = new Map();
  for (const e of entries) {
    if (!e.date || !inPeriod(e.date, period)) continue;
    const key = e.costCentre || "Unallocated";
    const cur = map.get(key) || { costCentre: key, income: 0, purchases: 0, expenses: 0, vouchers: 0 };
    let touched = false;
    for (const l of e.lines) {
      const g = l.group;
      if (g === "Sales Accounts" || g === "Indirect Incomes") {
        cur.income = round2(cur.income + l.cr - l.dr);
        touched = true;
      } else if (g === "Purchase Accounts" || g === "Direct Expenses") {
        cur.purchases = round2(cur.purchases + l.dr - l.cr);
        touched = true;
      } else if (g === "Indirect Expenses") {
        cur.expenses = round2(cur.expenses + l.dr - l.cr);
        touched = true;
      }
    }
    if (touched) {
      cur.vouchers += 1;
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, net: round2(r.income - r.purchases - r.expenses) }))
    .sort((a, b) => (a.costCentre === "Unallocated") - (b.costCentre === "Unallocated") || a.costCentre.localeCompare(b.costCentre));
}

export const inPeriod = (date, { from, to } = {}) => (!from || date >= from) && (!to || date <= to);

// Running ledger account for one ledger.
export function ledgerStatement(entries, ledgerName, period = {}) {
  let opening = 0;
  const rows = [];
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.ledger !== ledgerName) continue;
      const amt = l.dr - l.cr;
      if (period.from && (!e.date || e.date < period.from)) opening += amt;
      else if (inPeriod(e.date, period)) rows.push({ entryId: e.id, date: e.date, type: e.type, number: e.number, narration: e.narration, particulars: e.lines.filter((x) => x.ledger !== ledgerName).map((x) => x.ledger).join(", "), dr: l.dr, cr: l.cr });
    }
  }
  let bal = round2(opening);
  const withBalance = rows.map((r) => {
    bal = round2(bal + r.dr - r.cr);
    return { ...r, balance: bal };
  });
  const totalDr = round2(rows.reduce((s, r) => s + r.dr, 0));
  const totalCr = round2(rows.reduce((s, r) => s + r.cr, 0));
  return { opening: round2(opening), rows: withBalance, totalDr, totalCr, closing: bal };
}

// Closing balance of every ledger up to `to` (Dr positive).
export function ledgerBalances(entries, { to } = {}) {
  const map = new Map();
  for (const e of entries) {
    if (to && e.date && e.date > to) continue;
    for (const l of e.lines) {
      const cur = map.get(l.ledger) || { ledger: l.ledger, group: l.group, dr: 0, cr: 0 };
      cur.dr = round2(cur.dr + l.dr);
      cur.cr = round2(cur.cr + l.cr);
      map.set(l.ledger, cur);
    }
  }
  return [...map.values()].map((b) => ({ ...b, balance: round2(b.dr - b.cr) }));
}

export function trialBalance(entries, period = {}) {
  const rows = ledgerBalances(entries, period)
    .filter((b) => Math.abs(b.balance) >= 0.005)
    .map((b) => ({ ledger: b.ledger, group: b.group, debit: b.balance > 0 ? b.balance : 0, credit: b.balance < 0 ? -b.balance : 0 }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.ledger.localeCompare(b.ledger));
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

// Movement of each P&L ledger within the period (Dr positive).
function periodMovements(entries, period) {
  const map = new Map();
  for (const e of entries) {
    if (!inPeriod(e.date, period) || !e.date) continue;
    for (const l of e.lines) {
      if (GROUPS[l.group]?.statement !== "pl") continue;
      const cur = map.get(l.ledger) || { ledger: l.ledger, group: l.group, amount: 0 };
      cur.amount = round2(cur.amount + l.dr - l.cr);
      map.set(l.ledger, cur);
    }
  }
  return [...map.values()];
}

// Trading + Profit & Loss account. Pass opening/closing stock values (see
// utils/inventory.js) for a proper trading account.
export function profitAndLoss(entries, period = {}, { openingStock = 0, closingStock = 0 } = {}) {
  const mv = periodMovements(entries, period);
  const pick = (group) => mv.filter((m) => m.group === group);
  const sales = -pick("Sales Accounts").reduce((s, m) => s + m.amount, 0);
  const purchases = pick("Purchase Accounts").reduce((s, m) => s + m.amount, 0);
  const directExp = pick("Direct Expenses").reduce((s, m) => s + m.amount, 0);
  const grossProfit = round2(sales + closingStock - openingStock - purchases - directExp);
  const indirectExpenses = pick("Indirect Expenses").filter((m) => m.amount > 0);
  const indirectIncomes = [
    ...pick("Indirect Incomes").map((m) => ({ ...m, amount: -m.amount })),
    ...pick("Indirect Expenses").filter((m) => m.amount < 0).map((m) => ({ ...m, amount: -m.amount })),
  ].filter((m) => m.amount > 0);
  const totalIndirectExp = round2(indirectExpenses.reduce((s, m) => s + m.amount, 0));
  const totalIndirectInc = round2(indirectIncomes.reduce((s, m) => s + m.amount, 0));
  const netProfit = round2(grossProfit + totalIndirectInc - totalIndirectExp);
  return {
    sales: round2(sales),
    salesDetail: pick("Sales Accounts").map((m) => ({ ledger: m.ledger, amount: round2(-m.amount) })),
    purchases: round2(purchases),
    purchaseDetail: pick("Purchase Accounts").map((m) => ({ ledger: m.ledger, amount: m.amount })),
    directExpenses: round2(directExp),
    openingStock,
    closingStock,
    grossProfit,
    indirectExpenses,
    indirectIncomes,
    totalIndirectExp,
    totalIndirectInc,
    netProfit,
  };
}

// Balance Sheet as on `to`. Net profit to date goes to the capital side, so
// assets always equal liabilities. `stock`: { initial, closing } values —
// closing stock is an asset, the initial opening stock is capital brought in.
export function balanceSheet(entries, { to, from } = {}, stock = { initial: 0, closing: 0 }) {
  const balances = ledgerBalances(entries, { to });
  const pl = profitAndLoss(entries, { to }, { openingStock: stock.initial || 0, closingStock: stock.closing || 0 });
  const byGroup = (nature) => {
    const groups = new Map();
    for (const b of balances) {
      const g = GROUPS[b.group];
      if (!g || g.statement !== "bs") continue;
      // Assets carry Dr balances, liabilities Cr; a Dr balance on a liability
      // ledger (e.g. ITC above output tax) is shown on the asset side.
      const assetSide = b.balance > 0;
      if ((nature === "asset") !== assetSide || Math.abs(b.balance) < 0.005) continue;
      const amt = Math.abs(b.balance);
      const cur = groups.get(b.group) || { group: b.group, amount: 0, ledgers: [] };
      cur.amount = round2(cur.amount + amt);
      cur.ledgers.push({ ledger: b.ledger, amount: amt });
      groups.set(b.group, cur);
    }
    return [...groups.values()].sort((a, b) => a.group.localeCompare(b.group));
  };
  const assets = byGroup("asset");
  const liabilities = byGroup("liability");
  if (stock.closing > 0.005) assets.push({ group: "Stock-in-Hand", amount: round2(stock.closing), ledgers: [] });
  if (stock.initial > 0.005) {
    const cap = liabilities.find((g) => g.group === "Capital Account");
    const row = { ledger: "Opening Stock", amount: round2(stock.initial) };
    if (cap) {
      cap.amount = round2(cap.amount + row.amount);
      cap.ledgers.push(row);
    } else liabilities.push({ group: "Capital Account", amount: row.amount, ledgers: [row] });
  }
  if (Math.abs(pl.netProfit) >= 0.005) {
    const row = { group: pl.netProfit >= 0 ? "Profit & Loss A/c" : "Profit & Loss A/c (Loss)", amount: Math.abs(pl.netProfit), ledgers: [] };
    // Opening balance (profit of earlier, closed years) and this period's profit.
    if (from && stock.priorClosing !== undefined) {
      const dayBefore = new Date(Date.UTC(...from.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0))) - 86400000).toISOString().slice(0, 10);
      const prior = profitAndLoss(entries, { to: dayBefore }, { openingStock: stock.initial || 0, closingStock: stock.priorClosing || 0 }).netProfit;
      const sign = pl.netProfit >= 0 ? 1 : -1;
      if (Math.abs(prior) >= 0.005) {
        row.ledgers.push({ ledger: "Opening balance", amount: round2(sign * prior) });
        row.ledgers.push({ ledger: "Current period", amount: round2(sign * (pl.netProfit - prior)) });
      }
    }
    if (pl.netProfit >= 0) liabilities.push(row);
    else assets.push(row);
  }
  const totalAssets = round2(assets.reduce((s, g) => s + g.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((s, g) => s + g.amount, 0));
  return { assets, liabilities, totalAssets, totalLiabilities, balanced: Math.abs(totalAssets - totalLiabilities) < 0.01, netProfit: pl.netProfit };
}

// Day Book: all vouchers in a period with their totals.
export function dayBook(entries, period = {}) {
  return entries
    .filter((e) => e.date && inPeriod(e.date, period))
    .map((e) => ({ ...e, amount: round2(e.lines.reduce((s, l) => s + l.dr, 0)) }));
}

export function ledgerNames(entries) {
  const map = new Map();
  for (const e of entries) for (const l of e.lines) if (!map.has(l.ledger)) map.set(l.ledger, l.group);
  return [...map.entries()].map(([ledger, group]) => ({ ledger, group })).sort((a, b) => a.group.localeCompare(b.group) || a.ledger.localeCompare(b.ledger));
}

// Bank reconciliation: book balance vs bank balance from the dates entries
// cleared in the bank statement. `cleared` maps entry id -> bank date.
export function bankReconciliation(entries, cleared = {}, { to, ledger = "Bank" } = {}) {
  const st = ledgerStatement(entries, ledger, { to });
  const rows = st.rows.map((r) => ({ ...r, bankDate: cleared[r.entryId] || "" }));
  const pending = rows.filter((r) => !r.bankDate || (to && r.bankDate > to));
  const depositsNotCleared = round2(pending.reduce((s, r) => s + r.dr, 0));
  const paymentsNotCleared = round2(pending.reduce((s, r) => s + r.cr, 0));
  const booksBalance = st.closing;
  return {
    rows,
    booksBalance,
    depositsNotCleared,
    paymentsNotCleared,
    bankBalance: round2(booksBalance - depositsNotCleared + paymentsNotCleared),
  };
}

// TDS deducted by customers (from invoices), by customer.
export function tdsReceivable(invoices = [], period = {}) {
  const map = new Map();
  for (const inv of invoices) {
    const amt = n(inv.tdsAmount);
    if (amt <= 0) continue;
    const date = toDateKey(inv.paymentDate || inv.invoiceDate);
    if (!inPeriod(date, period)) continue;
    const name = nameOf(inv.client);
    const gstin = inv.client?.gstin || inv.client?.taxId || "";
    const cur = map.get(name) || { customer: name, gstin, invoices: 0, invoiceValue: 0, tds: 0, rows: [] };
    cur.invoices += 1;
    cur.invoiceValue = round2(cur.invoiceValue + n(inv.amount));
    cur.tds = round2(cur.tds + amt);
    cur.rows.push({ number: inv.invoiceNumber, date, amount: n(inv.amount), tds: amt });
    map.set(name, cur);
  }
  const rows = [...map.values()].sort((a, b) => b.tds - a.tds);
  return { rows, total: round2(rows.reduce((s, r) => s + r.tds, 0)) };
}

// Budget vs actual for income and expense ledgers in a period. `budgets` maps
// ledger name -> budgeted amount for the period. Income is shown as earned
// (credit) and expenses as spent (debit).
export function budgetVsActual(entries, period = {}, budgets = {}) {
  const actual = new Map();
  for (const e of entries) {
    if (!e.date || !inPeriod(e.date, period)) continue;
    for (const l of e.lines) {
      const g = GROUPS[l.group];
      if (!g || g.statement !== "pl") continue;
      const cur = actual.get(l.ledger) || { ledger: l.ledger, group: l.group, nature: g.nature, amount: 0 };
      cur.amount = round2(cur.amount + (g.nature === "income" ? l.cr - l.dr : l.dr - l.cr));
      actual.set(l.ledger, cur);
    }
  }
  const names = new Set([...actual.keys(), ...Object.keys(budgets)]);
  const rows = [...names].map((ledger) => {
    const a = actual.get(ledger);
    const budget = round2(n(budgets[ledger]));
    const amount = a ? a.amount : 0;
    const nature = a?.nature || "expense";
    // Positive variance is good: income above budget, spending below it.
    const variance = round2(nature === "income" ? amount - budget : budget - amount);
    return { ledger, group: a?.group || "", nature, budget, actual: amount, variance, usedPct: budget ? Math.round((amount / budget) * 100) : null };
  });
  return rows.sort((x, y) => x.nature.localeCompare(y.nature) || x.ledger.localeCompare(y.ledger));
}
