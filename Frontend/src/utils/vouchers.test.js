// Run with: node --test src/utils/vouchers.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { VOUCHER_TYPES, nextVoucherNumber, newVoucher, withLinked, withParty, voucherForSave, voucherProblems } from "./vouchers.js";
import { voucherFromOrder, invoicePatchFromOrder } from "./vouchers.js";
import { invoiceTotals } from "./gst.js";

const company = { companyName: "Acme Traders", gstin: "33AMWPB2116Q1ZS" };
const OCT = new Date(2026, 9, 7);

test("numbers restart each financial year per voucher type", () => {
  const list = [{ voucherNumber: "CN-004/2026-27" }, { voucherNumber: "CN-009/2025-26" }, { voucherNumber: "PUR-020/2026-27" }];
  assert.equal(nextVoucherNumber(list, "CN", OCT), "CN-005/2026-27");
  assert.equal(nextVoucherNumber(list, "DN", OCT), "DN-001/2026-27");
  assert.equal(nextVoucherNumber([], "CN", new Date(2027, 1, 1)), "CN-001/2026-27");
});

test("credit note copies the invoice's items and its CGST/IGST choice", () => {
  const invoice = {
    id: "inv1",
    invoiceNumber: "007/2026-27",
    invoiceDate: "2026-09-01",
    clientId: "c1",
    client: { id: "c1", name: "Kaveri", gstin: "29ABCDE1234F1Z5" },
    gstVersion: 2,
    isInterState: true,
    placeOfSupply: { code: "29", name: "Karnataka" },
    items: [{ description: "Pump", hsnCode: "8413", quantity: 2, rate: 1000, gstRate: 18, taxable: 2000 }],
  };
  const type = VOUCHER_TYPES.creditNote;
  const cn = withLinked(newVoucher(type, { today: OCT }), type, invoice, { company });
  assert.equal(cn.linkedNumber, "007/2026-27");
  assert.equal(cn.partyId, "c1");
  assert.equal(cn.isInterState, true);
  assert.equal(cn.items[0].gstRate, 18);
  const t = invoiceTotals({ ...cn, items: [{ ...cn.items[0], quantity: 1 }] });
  assert.equal(t.igstAmount, 180);
});

test("credit note against an old single-rate invoice keeps CGST+SGST", () => {
  const type = VOUCHER_TYPES.creditNote;
  const legacy = { id: "i2", invoiceNumber: "002/2026-27", client: { id: "c1" }, clientId: "c1", cgst: 9, sgst: 9, igst: 0, items: [{ quantity: 1, rate: 500 }] };
  const cn = withLinked(newVoucher(type, { today: OCT }), type, legacy, { company });
  assert.equal(cn.isInterState, false);
  assert.equal(cn.items[0].gstRate, 18);
  assert.equal(invoiceTotals(cn).cgstAmount, 45);
});

test("purchase from another state is IGST, same state is CGST+SGST", () => {
  const type = VOUCHER_TYPES.purchase;
  const other = withParty(newVoucher(type, { today: OCT }), type, { id: "s1", gstin: "27AAACB1234C1Z5" }, company);
  assert.equal(other.isInterState, true);
  assert.equal(other.placeOfSupply.code, "33");
  const local = withParty(newVoucher(type, { today: OCT }), type, { id: "s2", state: "Tamil Nadu" }, company);
  assert.equal(local.isInterState, false);
});

test("saved voucher stores tax amounts and the company snapshot", () => {
  const type = VOUCHER_TYPES.purchase;
  let v = withParty(newVoucher(type, { today: OCT }), type, { id: "s1", gstin: "27AAACB1234C1Z5" }, company);
  v = { ...v, supplierBillNumber: "B-77", items: [{ quantity: 10, rate: 50, gstRate: 12 }] };
  const doc = voucherForSave(v, company);
  assert.equal(doc.taxableAmount, 500);
  assert.equal(doc.igstAmount, 60);
  assert.equal(doc.amount, 560);
  assert.equal(doc.seller.companyName, "Acme Traders");
  assert.deepEqual(voucherProblems(doc, type), []);
});

test("validation lists what is missing", () => {
  const type = VOUCHER_TYPES.creditNote;
  const problems = voucherProblems(newVoucher(type, { today: OCT }), type);
  assert.ok(problems.includes("Customer"));
  assert.ok(problems.includes("Against invoice"));
  assert.ok(problems.some((p) => p.startsWith("At least one item")));
});

test("orders convert into bills with party, items and a back-reference", () => {
  const order = {
    id: "o1",
    voucherType: "purchaseOrder",
    voucherNumber: "PO-001/2026-27",
    voucherDate: "2026-06-01",
    partyId: "s1",
    party: { id: "s1", name: "Supplier", state: "Karnataka" },
    items: [{ description: "Steel", quantity: 10, rate: 50, gstRate: 18 }],
    gstVersion: 2,
    status: "Open",
  };
  const company = { state: "Tamil Nadu" };
  const bill = voucherFromOrder(VOUCHER_TYPES.purchase, order, { company, today: new Date("2026-06-10") });
  assert.equal(bill.partyId, "s1");
  assert.equal(bill.items[0].quantity, 10);
  assert.equal(bill.orderRef.collection, "purchaseOrders");
  assert.equal(bill.orderRef.number, "PO-001/2026-27");
  assert.equal(bill.status, "Unpaid");
  assert.equal(newVoucher(VOUCHER_TYPES.quotation).status, "Open");
  const inv = invoicePatchFromOrder({ ...order, voucherType: "salesOrder" });
  assert.equal(inv.clientId, "s1");
  assert.equal(inv.orderRef.collection, "salesOrders");
});
