// Run with: node --test src/utils/ageing.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesAgeing, payablesAgeing, bucketFor } from "./ageing.js";

const asOn = "2026-10-31";

test("buckets by days past due", () => {
  assert.equal(bucketFor("2026-11-05", asOn), "Not due");
  assert.equal(bucketFor("2026-10-20", asOn), "0-30");
  assert.equal(bucketFor("2026-09-15", asOn), "31-60");
  assert.equal(bucketFor("2026-08-15", asOn), "61-90");
  assert.equal(bucketFor("2026-01-01", asOn), "90+");
});

test("receivables net payments, TDS and credit notes; paid and drafts drop out", () => {
  const r = receivablesAgeing(
    [
      { id: "1", invoiceNumber: "001", invoiceDate: "2026-07-01", dueDate: "2026-07-31", amount: 1000, paidAmount: 200, tdsAmount: 20, creditedAmount: 80, client: { id: "c1", name: "Kaveri" }, clientId: "c1" },
      { id: "2", invoiceNumber: "002", invoiceDate: "2026-10-10", dueDate: "2026-11-10", amount: 500, client: { id: "c1", name: "Kaveri" }, clientId: "c1" },
      { id: "3", invoiceNumber: "003", invoiceDate: "2026-10-01", amount: 900, status: "Paid", client: { name: "Arun" } },
      { id: "4", invoiceNumber: "004", invoiceDate: "2026-10-01", amount: 900, status: "Draft", client: { name: "Arun" } },
    ],
    asOn
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].total, 700 + 500);
  assert.equal(r.rows[0].buckets["90+"], 700);
  assert.equal(r.rows[0].buckets["Not due"], 500);
  assert.equal(r.totals.total, 1200);
});

test("payables use credit days and net debit notes", () => {
  const supplier = { name: "Steel Mart" };
  const r = payablesAgeing(
    [{ id: "p1", voucherNumber: "PUR-1", voucherDate: "2026-09-01", supplierBillDate: "2026-09-01", partyId: "s1", party: supplier, gstVersion: 2, isInterState: true, items: [{ quantity: 10, rate: 100, gstRate: 18 }], paidAmount: 180 }],
    [{ id: "d1", linkedId: "p1", gstVersion: 2, isInterState: true, items: [{ quantity: 1, rate: 100, gstRate: 18 }] }],
    asOn,
    30
  );
  assert.equal(r.rows[0].total, 1180 - 180 - 118);
  assert.equal(r.rows[0].bills[0].dueDate, "2026-10-01");
  assert.equal(r.rows[0].buckets["0-30"], 882);
});
