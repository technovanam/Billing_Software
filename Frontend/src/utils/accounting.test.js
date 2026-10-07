// Run with: node --test src/utils/accounting.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntries, trialBalance, profitAndLoss, balanceSheet, ledgerStatement, dayBook, bankReconciliation, tdsReceivable, costCentreReport, budgetVsActual } from "./accounting.js";

const customer = { id: "c1", name: "Kaveri Textiles" };
const supplier = { id: "s1", name: "Steel Mart", openingBalance: 1000 };

const data = {
  customers: [customer],
  suppliers: [supplier],
  invoices: [
    // 10 × 100 @18% intra-state = 1000 + 90 + 90 = 1180
    { id: "i1", invoiceNumber: "001/2026-27", invoiceDate: "2026-04-10", status: "Unpaid", clientId: "c1", client: customer, gstVersion: 2, isInterState: false, isGstEnabled: true, items: [{ quantity: 10, rate: 100, gstRate: 18 }] },
    { id: "i2", invoiceNumber: "002/2026-27", invoiceDate: "2026-04-11", status: "Draft", clientId: "c1", client: customer, gstVersion: 2, items: [{ quantity: 1, rate: 999, gstRate: 18 }] },
  ],
  payments: [{ id: "p1", invoiceId: "i1", amount: 500, method: "Cash", paymentDate: "2026-04-15" }],
  creditNotes: [
    // return 1 unit: 100 + 9 + 9 = 118
    { id: "cn1", voucherNumber: "CN-001/2026-27", voucherDate: "2026-04-20", party: customer, partyId: "c1", gstVersion: 2, isInterState: false, isGstEnabled: true, items: [{ quantity: 1, rate: 100, gstRate: 18 }] },
  ],
  purchases: [
    // 5 × 80 @12% inter-state = 400 + 48 = 448, half paid by bank
    { id: "pu1", voucherNumber: "PUR-001/2026-27", voucherDate: "2026-04-05", supplierBillNumber: "B-1", party: supplier, partyId: "s1", gstVersion: 2, isInterState: true, isGstEnabled: true, items: [{ quantity: 5, rate: 80, gstRate: 12 }], paidAmount: 200, paymentMethod: "NEFT" },
  ],
  debitNotes: [
    // return 1 unit: 80 + 9.6 = 89.6
    { id: "dn1", voucherNumber: "DN-001/2026-27", voucherDate: "2026-04-25", party: supplier, partyId: "s1", gstVersion: 2, isInterState: true, isGstEnabled: true, items: [{ quantity: 1, rate: 80, gstRate: 12 }] },
  ],
  expenses: [{ id: "e1", category: "Rent", amount: 300, expenseDate: "2026-04-30" }],
};

const entries = buildEntries(data);

test("every voucher is balanced and drafts are skipped", () => {
  for (const e of entries) {
    const dr = e.lines.reduce((s, l) => s + l.dr, 0);
    const cr = e.lines.reduce((s, l) => s + l.cr, 0);
    assert.ok(Math.abs(dr - cr) < 0.001, `${e.id} is not balanced`);
  }
  assert.ok(!entries.some((e) => e.id === "sales:i2"));
});

test("trial balance agrees", () => {
  const tb = trialBalance(entries);
  assert.equal(tb.balanced, true);
  const find = (l) => tb.rows.find((r) => r.ledger === l);
  assert.equal(find("Kaveri Textiles").debit, 1180 - 500 - 118);
  assert.equal(find("Output CGST").credit, 81);
  assert.equal(find("Input IGST").debit, 48 - 9.6);
  assert.equal(find("Steel Mart").credit, 1000 + 448 - 200 - 89.6);
  assert.equal(find("Cash").debit, 500 - 300);
  assert.equal(find("Bank").credit, 200);
});

test("profit and loss nets returns and expenses", () => {
  const pl = profitAndLoss(entries, { from: "2026-04-01", to: "2027-03-31" });
  assert.equal(pl.sales, 900); // 1000 − 100 returned
  assert.equal(pl.purchases, 320); // 400 − 80 returned
  assert.equal(pl.grossProfit, 580);
  assert.equal(pl.totalIndirectExp, 300);
  assert.equal(pl.netProfit, 280);
});

test("balance sheet balances with profit carried to capital side", () => {
  const bs = balanceSheet(entries, { to: "2027-03-31" });
  assert.equal(bs.balanced, true, JSON.stringify(bs, null, 1));
  assert.equal(bs.netProfit, 280);
});

test("ledger statement runs a balance with opening", () => {
  const st = ledgerStatement(entries, "Kaveri Textiles", { from: "2026-04-12", to: "2026-04-30" });
  assert.equal(st.opening, 1180);
  assert.equal(st.closing, 562);
  assert.equal(st.rows.length, 2);
});

test("day book lists dated vouchers in the period", () => {
  const db = dayBook(entries, { from: "2026-04-01", to: "2026-04-15" });
  assert.deepEqual(db.map((e) => e.type), ["Payment", "Purchase", "Sales", "Receipt"]);
  assert.ok(db.every((e) => e.date >= "2026-04-01" && e.date <= "2026-04-15"));
  assert.equal(db.find((e) => e.type === "Sales").amount, 1180);
});

test("closing stock flows into P&L and the balance sheet still balances", () => {
  const pl = profitAndLoss(entries, { from: "2026-04-01", to: "2027-03-31" }, { openingStock: 1000, closingStock: 1500 });
  assert.equal(pl.grossProfit, 580 + 500);
  const bs = balanceSheet(entries, { to: "2027-03-31" }, { initial: 1000, closing: 1500 });
  assert.equal(bs.balanced, true);
  assert.ok(bs.assets.some((g) => g.group === "Stock-in-Hand" && g.amount === 1500));
});

test("bank reconciliation: uncleared payments raise the bank balance", () => {
  // Bank ledger has one payment of 200 (purchase paid by NEFT).
  const none = bankReconciliation(entries, {}, { to: "2026-04-30" });
  assert.equal(none.booksBalance, -200);
  assert.equal(none.paymentsNotCleared, 200);
  assert.equal(none.bankBalance, 0);
  const cleared = bankReconciliation(entries, { [none.rows[0].entryId]: "2026-04-07" }, { to: "2026-04-30" });
  assert.equal(cleared.bankBalance, -200);
});

test("TDS receivable by customer", () => {
  const r = tdsReceivable([{ invoiceNumber: "1", invoiceDate: "2026-05-01", amount: 1180, tdsAmount: 20, client: { name: "A" } }, { invoiceNumber: "2", invoiceDate: "2026-05-02", amount: 500, client: { name: "B" } }]);
  assert.equal(r.total, 20);
  assert.equal(r.rows[0].customer, "A");
});

test("payroll runs post a balanced journal; cost centres split income and spend", () => {
  const withMore = buildEntries({
    ...data,
    invoices: data.invoices.map((i) => (i.id === "i1" ? { ...i, costCentre: "Project A" } : i)),
    expenses: [{ ...data.expenses[0], costCentre: "Project A" }],
    payrollRuns: [{ id: "r1", ym: "2026-04", totals: { gross: 1000, pfEmployee: 120, pfEmployer: 120, esiEmployee: 0, esiEmployer: 0, professionalTax: 0, tds: 0, netPay: 880, ctc: 1120 } }],
  });
  const pay = withMore.find((e) => e.id === "payroll:r1");
  assert.equal(pay.date, "2026-04-30");
  assert.equal(trialBalance(withMore).balanced, true);
  const cc = costCentreReport(withMore, { from: "2026-04-01", to: "2027-03-31" });
  const a = cc.find((r) => r.costCentre === "Project A");
  assert.equal(a.income, 1000);
  assert.equal(a.expenses, 300);
  assert.equal(a.net, 700);
  assert.ok(cc.some((r) => r.costCentre === "Unallocated"));
});

test("reverse charge: no output tax on sales; purchase tax owed to government, ITC taken", () => {
  const e = buildEntries({
    invoices: [{ id: "r1", invoiceNumber: "R1", invoiceDate: "2026-06-01", status: "Unpaid", client: { name: "GTA client" }, gstVersion: 2, reverseCharge: true, items: [{ quantity: 1, rate: 1000, gstRate: 5 }] }],
    purchases: [{ id: "rp", voucherNumber: "P1", voucherDate: "2026-06-02", party: { name: "Transporter" }, gstVersion: 2, reverseCharge: true, items: [{ quantity: 1, rate: 2000, gstRate: 5 }] }],
  });
  const tb = trialBalance(e);
  assert.equal(tb.balanced, true);
  const row = (l) => tb.rows.find((r) => r.ledger === l);
  assert.equal(row("GTA client").debit, 1000);
  assert.ok(!row("Output CGST"));
  assert.equal(row("Transporter").credit, 2000);
  assert.equal(row("RCM Tax Payable").credit, 100);
  assert.equal(row("Input CGST").debit, 50);
});

test("foreign-currency export invoice is booked in rupees", () => {
  const e = buildEntries({ invoices: [{ id: "x", invoiceNumber: "X1", invoiceDate: "2026-06-05", status: "Unpaid", client: { name: "US Buyer" }, gstVersion: 2, supplyType: "EXPWOP", currency: "USD", exchangeRate: 80, items: [{ quantity: 1, rate: 100, gstRate: 18 }] }] });
  const tb = trialBalance(e);
  assert.equal(tb.rows.find((r) => r.ledger === "US Buyer").debit, 8000);
  assert.equal(tb.rows.find((r) => r.ledger === "Sales").credit, 8000);
});

test("budget vs actual: income above budget and spend below budget are favourable", () => {
  const rows = budgetVsActual(entries, { from: "2026-04-01", to: "2027-03-31" }, { Sales: 800, Rent: 500, Travel: 100 });
  const sales = rows.find((r) => r.ledger === "Sales");
  assert.equal(sales.actual, 1000);
  assert.equal(sales.variance, 200);
  const rent = rows.find((r) => r.ledger === "Rent");
  assert.equal(rent.actual, 300);
  assert.equal(rent.variance, 200);
  assert.equal(rent.usedPct, 60);
  assert.equal(rows.find((r) => r.ledger === "Travel").actual, 0);
});

test("chart of accounts: named bank accounts and opening balances", () => {
  const e = buildEntries({
    accounts: [
      { id: "a1", kind: "account", name: "HDFC Current", group: "Bank Accounts", openingBalance: 50000, openingSide: "Dr" },
      { id: "a2", kind: "account", name: "Capital", group: "Capital Account", openingBalance: 60000, openingSide: "Cr" },
      { id: "a3", kind: "account", name: "Cash", group: "Cash-in-Hand", openingBalance: 10000, openingSide: "Dr" },
    ],
    customers: [{ id: "c1", name: "Kaveri", openingBalance: 2500 }],
    invoices: [{ id: "i1", invoiceNumber: "1", invoiceDate: "2026-05-01", status: "Unpaid", clientId: "c1", client: { id: "c1", name: "Kaveri" }, gstVersion: 2, isGstEnabled: false, items: [{ quantity: 1, rate: 1000 }] }],
    payments: [{ id: "p1", invoiceId: "i1", amount: 1000, method: "UPI", account: "HDFC Current", paymentDate: "2026-05-02" }],
  });
  const tb = trialBalance(e);
  assert.equal(tb.balanced, true);
  const row = (l) => tb.rows.find((r) => r.ledger === l);
  assert.equal(row("HDFC Current").debit, 51000);
  assert.equal(row("Kaveri").debit, 2500);
  assert.equal(row("Capital").credit, 60000);
  assert.ok(!row("Bank"));
  // Openings: 50,000 + 10,000 + 2,500 Dr vs 60,000 Cr -> 2,500 difference on the credit side.
  assert.equal(row("Opening Balance Difference").credit, 2500);
  const bs = balanceSheet(e, { to: "2027-03-31" });
  assert.equal(bs.balanced, true);
});

test("forex gain on export receipt", () => {
  const e = buildEntries({
    invoices: [{ id: "i1", invoiceNumber: "E1", invoiceDate: "2026-05-01", status: "Paid", clientId: "c1", client: { id: "c1", name: "Acme Inc" }, gstVersion: 2, isGstEnabled: false, currency: "USD", exchangeRate: 80, items: [{ quantity: 1, rate: 100 }] }],
    payments: [{ id: "p1", invoiceId: "i1", amount: 8000, forexGain: 300, receiptRate: 83, method: "Bank Transfer", paymentDate: "2026-06-01" }],
  });
  const tb = trialBalance(e);
  assert.equal(tb.balanced, true);
  const row = (l) => tb.rows.find((r) => r.ledger === l);
  assert.equal(row("Bank").debit, 8300);
  assert.equal(row("Forex Gain / Loss").credit, 300);
  assert.ok(!row("Acme Inc"));
});

test("cess and TCS post to their own ledgers and the books balance", () => {
  const e = buildEntries({
    invoices: [{ id: "i1", invoiceNumber: "1", invoiceDate: "2026-05-01", status: "Unpaid", client: { name: "Kaveri" }, gstVersion: 2, isGstEnabled: true, tcsRate: 1, items: [{ quantity: 10, rate: 100, gstRate: 28, cessRate: 12 }] }],
    purchases: [{ id: "p1", voucherNumber: "PUR-1", voucherDate: "2026-05-02", party: { name: "Sup" }, gstVersion: 2, isGstEnabled: true, tcsRate: 0.1, items: [{ quantity: 1, rate: 1000, gstRate: 28, cessRate: 12 }] }],
  });
  const tb = trialBalance(e);
  assert.equal(tb.balanced, true);
  const row = (l) => tb.rows.find((r) => r.ledger === l);
  assert.equal(row("Output Cess").credit, 120);
  assert.equal(row("TCS Payable").credit, 14);
  assert.equal(row("Input Cess").debit, 120);
  assert.equal(row("TCS Receivable").debit, 1.4);
});
