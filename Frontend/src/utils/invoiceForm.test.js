// Run with: node --test src/utils/invoiceForm.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceTotals } from "./gst.js";
import { ITEMWISE_DEFAULTS, newInvoiceItem, applyProduct, applyItemChange, withClient, withPlaceOfSupply, prepareForEdit, invoiceForSave, withSupplyType } from "./invoiceForm.js";

const seller = { companyName: "Acme Traders", gstin: "33AMWPB2116Q1ZS", bank: { bankName: "HDFC", ifsc: "HDFC0001234" } };

test("editing an old CGST+SGST bill keeps its total, even for an out-of-state customer", () => {
  const legacy = { items: [{ quantity: 2, rate: 500 }], cgst: 9, sgst: 9, igst: 0, isGstEnabled: true, isRoundOff: true, client: { gstin: "29ABCDE1234F1Z5" } };
  const ed = prepareForEdit(legacy, seller);
  assert.equal(invoiceTotals(legacy).total, 1180);
  assert.equal(invoiceTotals(ed).total, 1180);
  assert.equal(ed.isInterState, false);
  assert.equal(ed.placeOfSupply.code, "33");
});

test("editing an old IGST bill stays IGST", () => {
  const legacy = { items: [{ quantity: 1, rate: 1000 }], cgst: 0, sgst: 0, igst: 18, isGstEnabled: true, client: { state: "Karnataka" } };
  const ed = prepareForEdit(legacy, seller);
  assert.equal(invoiceTotals(ed).igstAmount, 180);
  assert.equal(ed.placeOfSupply.name, "Karnataka");
});

test("picking a customer sets the place of supply", () => {
  const inv = withClient({ ...ITEMWISE_DEFAULTS, items: [] }, { id: "c1", gstin: "29ABCDE1234F1Z5" }, seller);
  assert.equal(inv.placeOfSupply.name, "Karnataka");
  assert.equal(inv.isInterState, true);
  const back = withPlaceOfSupply(inv, "33", seller);
  assert.equal(back.isInterState, false);
});

test("product fills rate, HSN and its own GST rate; discount updates the amount", () => {
  let it = applyProduct(newInvoiceItem(18), { id: "p1", name: "Pump", hsn: "8413", price: "₹1,000", gstRate: 12, unit: "Piece" });
  assert.equal(it.rate, 1000);
  assert.equal(it.gstRate, 12);
  it = applyItemChange(it, "discount", 10);
  assert.equal(it.amount, 900);
});

test("saved invoice carries tax amounts, HSN summary and the seller snapshot", () => {
  let inv = withClient({ ...ITEMWISE_DEFAULTS, items: [], isGstEnabled: true, isRoundOff: false }, { id: "c1", gstin: "29ABCDE1234F1Z5" }, seller);
  inv.items = [applyItemChange(applyProduct(newInvoiceItem(), { name: "Pump", hsn: "8413", price: 1000, gstRate: 12 }), "discount", 10)];
  const doc = invoiceForSave(inv, seller, { status: "Unpaid" });
  assert.equal(doc.taxableAmount, 900);
  assert.equal(doc.igstAmount, 108);
  assert.equal(doc.amount, 1008);
  assert.equal(doc.hsnSummary[0].hsn, "8413");
  assert.equal(doc.seller.companyName, "Acme Traders");
  assert.equal(doc.seller.bank.ifsc, "HDFC0001234");
  assert.equal(doc.status, "Unpaid");
});

test("re-saving keeps the original seller snapshot", () => {
  const doc = invoiceForSave({ ...ITEMWISE_DEFAULTS, items: [], seller: { companyName: "Old Name" } }, seller);
  assert.equal(doc.seller.companyName, "Old Name");
});

test("export supply type: IGST, POS 96, survives picking a customer; back to regular resets", () => {
  let inv = withSupplyType({ ...ITEMWISE_DEFAULTS, items: [] }, "EXPWOP", seller);
  assert.equal(inv.isInterState, true);
  assert.equal(inv.placeOfSupply.code, "96");
  inv = withClient(inv, { id: "c9", name: "US Buyer" }, seller);
  assert.equal(inv.placeOfSupply.code, "96");
  inv = withSupplyType(inv, "REGULAR", seller);
  assert.equal(inv.isInterState, false);
  assert.equal(inv.currency, "INR");
});
