// Run with: node --test src/utils/yearEnd.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { carryForward, lockViolation, voucherDateKey, fyEnd } from "./yearEnd.js";
import { buildEntries, balanceSheet } from "./accounting.js";

const inv = (id, date, rate) => ({ id, invoiceNumber: id, invoiceDate: date, status: "Paid", paidAmount: rate, paymentMethod: "Cash", client: { name: "A" }, gstVersion: 2, isGstEnabled: false, items: [{ quantity: 1, rate }] });

test("closing balances carry forward and profit splits into opening + current", () => {
  const entries = buildEntries({ invoices: [inv("1", "2025-06-01", 1000), inv("2", "2026-05-01", 500)] });
  const cf = carryForward(entries, 2025);
  assert.equal(cf.to, "2026-03-31");
  assert.equal(cf.netProfit, 1000);
  assert.equal(cf.rows.find((r) => r.ledger === "Cash").debit, 1000);
  const bs = balanceSheet(entries, { from: "2026-04-01", to: "2027-03-31" }, { initial: 0, closing: 0, priorClosing: 0 });
  const pl = bs.liabilities.find((g) => g.group === "Profit & Loss A/c");
  assert.equal(pl.amount, 1500);
  assert.deepEqual(pl.ledgers.map((l) => [l.ledger, l.amount]), [["Opening balance", 1000], ["Current period", 500]]);
  assert.equal(bs.balanced, true);
});

test("lock blocks book changes in a closed year but allows settling old bills", () => {
  const lockedUpTo = fyEnd(2025);
  const old = { invoiceDate: "2026-02-10", items: [] };
  assert.match(lockViolation(lockedUpTo, "invoices", { after: old }), /closed up to 2026-03-31/);
  assert.equal(lockViolation(lockedUpTo, "invoices", { after: { invoiceDate: "2026-04-02" } }), "");
  assert.equal(lockViolation(lockedUpTo, "invoices", { before: old, patch: { paidAmount: 100, status: "Paid" } }), "");
  assert.notEqual(lockViolation(lockedUpTo, "invoices", { before: old, patch: { items: [] } }), "");
  assert.notEqual(lockViolation(lockedUpTo, "invoices", { before: { invoiceDate: "2026-05-01" }, patch: { invoiceDate: "2026-03-01" } }), "");
  assert.notEqual(lockViolation(lockedUpTo, "payments", { before: { paymentDate: "15/03/2026" } }), "");
  assert.equal(lockViolation(lockedUpTo, "customers", { after: { date: "2025-01-01" } }), "");
  assert.equal(lockViolation("", "invoices", { after: old }), "");
  assert.equal(voucherDateKey({ ym: "2026-03" }), "2026-03-01");
});
