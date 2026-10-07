// Run with: node --test src/utils/gstr2b.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGstr2b, reconcile2b, normaliseInvoiceNo } from "./gstr2b.js";

const json = {
  data: {
    gstin: "33AMWPB2116Q1ZS",
    rtnprd: "102026",
    docdata: {
      b2b: [
        {
          ctin: "29ABCDE1234F1Z5",
          trdnm: "Steel Mart",
          inv: [
            { inum: "INV/0042", dt: "05-10-2026", val: 1180, rev: "N", itcavl: "Y", items: [{ rt: 18, txval: 1000, igst: 180, cgst: 0, sgst: 0 }] },
            { inum: "INV/0043", dt: "06-10-2026", val: 590, rev: "N", itcavl: "Y", items: [{ rt: 18, txval: 500, igst: 90 }] },
            { inum: "INV/0044", dt: "07-10-2026", val: 118, rev: "N", itcavl: "Y", items: [{ rt: 18, txval: 100, igst: 18 }] },
          ],
        },
      ],
      cdnr: [{ ctin: "29ABCDE1234F1Z5", trdnm: "Steel Mart", nt: [{ ntnum: "CN-1", dt: "08-10-2026", typ: "C", val: 118, items: [{ txval: 100, igst: 18 }] }] }],
    },
  },
};

const supplier = { id: "s1", name: "Steel Mart", gstin: "29ABCDE1234F1Z5" };
const bill = (no, qty, rate, extra = {}) => ({
  id: no,
  voucherNumber: `PUR-${no}`,
  voucherDate: "2026-10-05",
  supplierBillNumber: no,
  supplierBillDate: "2026-10-05",
  partyId: "s1",
  party: supplier,
  gstVersion: 2,
  isGstEnabled: true,
  isInterState: true,
  items: [{ quantity: qty, rate, gstRate: 18 }],
  ...extra,
});

test("invoice numbers are compared loosely", () => {
  assert.equal(normaliseInvoiceNo("INV/0042"), normaliseInvoiceNo("inv 42"));
  assert.notEqual(normaliseInvoiceNo("INV/0042"), normaliseInvoiceNo("INV/0043"));
});

test("parse the portal JSON", () => {
  const p = parseGstr2b(json);
  assert.equal(p.period, "102026");
  assert.equal(p.docs.length, 4);
  assert.equal(p.docs[0].date, "2026-10-05");
  assert.equal(p.docs[0].igst, 180);
  assert.equal(p.docs[3].kind, "Credit note");
});

test("matched, mismatch, missing in books, missing in 2B", () => {
  const purchases = [
    bill("INV 42", 10, 100), // matches INV/0042
    bill("INV/0043", 4, 100, { supplierBillDate: "2026-10-06" }), // 400 vs 500 in 2B -> mismatch
    bill("INV/0099", 1, 50), // supplier never uploaded
  ];
  const r = reconcile2b(parseGstr2b(json).docs, purchases, [supplier], { from: "2026-10-01", to: "2026-10-31" });
  const status = (no) => r.rows.find((x) => (x.portal?.number || x.books?.number) === no)?.status;
  assert.equal(status("INV/0042"), "Matched");
  assert.equal(status("INV/0043"), "Mismatch");
  assert.equal(status("INV/0044"), "Missing in books");
  assert.equal(status("INV/0099"), "Missing in 2B");
  assert.equal(r.totals["Missing in 2B"].itc, 9);
  assert.equal(r.notes.length, 1);
});
