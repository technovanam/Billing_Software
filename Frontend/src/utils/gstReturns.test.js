// Run with: node --test src/utils/gstReturns.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGstr1, buildGstr3b, setOffItc, monthPeriod } from "./gstReturns.js";

const company = { gstin: "33AMWPB2116Q1ZS" };
const regLocal = { name: "Kaveri", gstin: "33AAACK1234C1Z2" }; // registered, same state
const regOther = { name: "Bengaluru Co", gstin: "29ABCDE1234F1Z5" };
const walkIn = { name: "Walk-in" };
const farBuyer = { name: "Delhi Retail", state: "Delhi" };

const inv = (id, client, items, extra = {}) => ({
  id, invoiceNumber: `${id}/2026-27`, invoiceDate: "2026-10-05", status: "Unpaid", client, gstVersion: 2, isGstEnabled: true, items, ...extra,
});

const invoices = [
  inv("001", regLocal, [{ hsnCode: "8413", quantity: 1, rate: 1000, gstRate: 18 }], { isInterState: false, placeOfSupply: { code: "33" } }),
  inv("002", regOther, [{ hsnCode: "8413", quantity: 2, rate: 1000, gstRate: 18 }], { isInterState: true, placeOfSupply: { code: "29" } }),
  inv("003", walkIn, [{ hsnCode: "1006", quantity: 10, rate: 50, gstRate: 5 }, { hsnCode: "0701", quantity: 1, rate: 100, gstRate: 0 }], { isInterState: false, placeOfSupply: { code: "33" } }),
  inv("004", farBuyer, [{ hsnCode: "8413", quantity: 150, rate: 1000, gstRate: 18 }], { isInterState: true, placeOfSupply: { code: "07" } }),
  inv("005", walkIn, [{ quantity: 1, rate: 999 }], { status: "Draft" }),
  inv("006", walkIn, [{ quantity: 1, rate: 500, gstRate: 18 }], { invoiceDate: "2026-09-30" }),
];
const creditNotes = [
  { id: "cn1", voucherNumber: "CN-001/2026-27", voucherDate: "2026-10-20", party: regOther, gstVersion: 2, isGstEnabled: true, isInterState: true, placeOfSupply: { code: "29" }, items: [{ hsnCode: "8413", quantity: 1, rate: 1000, gstRate: 18 }] },
];
const purchases = [
  { id: "p1", voucherDate: "2026-10-02", gstVersion: 2, isGstEnabled: true, isInterState: true, items: [{ quantity: 1, rate: 2000, gstRate: 18 }] },
];

test("month period and filing period code", () => {
  assert.deepEqual(monthPeriod("2026-10"), { from: "2026-10-01", to: "2026-10-31", fp: "102026" });
});

test("GSTR-1 splits B2B, B2CL, B2CS and notes", () => {
  const r = buildGstr1({ invoices, creditNotes, company, ym: "2026-10" });
  assert.equal(r.json.fp, "102026");
  assert.equal(r.json.b2b.length, 2);
  const blr = r.json.b2b.find((x) => x.ctin === "29ABCDE1234F1Z5").inv[0];
  assert.equal(blr.pos, "29");
  assert.deepEqual(blr.itms[0].itm_det, { txval: 2000, rt: 18, iamt: 360, csamt: 0 });
  assert.equal(r.json.b2cl.length, 1); // 004: inter-state unregistered above ₹1 lakh
  assert.equal(r.json.b2cl[0].pos, "07");
  const b2cs5 = r.json.b2cs.find((x) => x.rt === 5);
  assert.deepEqual(b2cs5, { sply_ty: "INTRA", pos: "33", typ: "OE", rt: 5, txval: 500, iamt: 0, camt: 12.5, samt: 12.5, csamt: 0 });
  assert.equal(r.json.cdnr[0].nt[0].nt_num, "CN-001/2026-27");
  assert.equal(r.summary.b2b.count, 2);
});

test("GSTR-1 HSN summary nets credit notes; drafts and other months excluded", () => {
  const r = buildGstr1({ invoices, creditNotes, company, ym: "2026-10" });
  const pump = r.json.hsn.data.find((h) => h.hsn_sc === "8413" && h.rt === 18);
  assert.equal(pump.qty, 1 + 2 + 150 - 1);
  assert.equal(pump.txval, 152000);
  assert.ok(!r.json.b2cs.some((x) => x.txval === 500 && x.rt === 18)); // 006 is September
  assert.equal(r.json.doc_issue.doc_det[0].docs[0].net_issue, 4);
});

test("GSTR-3B outward, nil-rated, ITC and cash payable", () => {
  const r = buildGstr3b({ invoices, creditNotes, purchases, company, ym: "2026-10" });
  assert.equal(r.outward.txval, 1000 + 2000 + 500 + 150000 - 1000);
  assert.equal(r.outward.iamt, 360 + 27000 - 180);
  assert.equal(r.outward.camt, 90 + 12.5);
  assert.equal(r.nil.txval, 100);
  assert.equal(r.itc.iamt, 360);
  assert.equal(r.setOff.cash.igst, 27180 - 360);
  assert.equal(r.interUnregistered[0].pos, "07");
});

test("ITC set-off follows the legal order", () => {
  const r = setOffItc({ igst: 100, cgst: 50, sgst: 50 }, { igst: 180, cgst: 0, sgst: 40 });
  // IGST credit: 100 to IGST, 50 to CGST, 30 to SGST; SGST credit then covers the remaining 20 SGST.
  assert.deepEqual(r.cash, { igst: 0, cgst: 0, sgst: 0 });
  assert.deepEqual(r.carryForward, { igst: 0, cgst: 0, sgst: 20 });
});

test("exports, SEZ and reverse charge land in the right GSTR sections", () => {
  const extra = [
    { id: "x1", invoiceNumber: "X1", invoiceDate: "2026-10-08", status: "Unpaid", client: { name: "US Buyer" }, gstVersion: 2, isGstEnabled: true, supplyType: "EXPWOP", currency: "USD", exchangeRate: 80, portCode: "INMAA1", shippingBillNo: "123", items: [{ hsnCode: "8413", quantity: 1, rate: 100, gstRate: 18 }] },
    { id: "s1", invoiceNumber: "S1", invoiceDate: "2026-10-09", status: "Unpaid", client: regOther, gstVersion: 2, isGstEnabled: true, supplyType: "SEZWP", items: [{ quantity: 1, rate: 1000, gstRate: 18 }] },
    { id: "r1", invoiceNumber: "R1", invoiceDate: "2026-10-10", status: "Unpaid", client: regLocal, gstVersion: 2, isGstEnabled: true, reverseCharge: true, items: [{ quantity: 1, rate: 1000, gstRate: 5 }] },
  ];
  const r1 = buildGstr1({ invoices: extra, creditNotes: [], company, ym: "2026-10" });
  assert.equal(r1.json.exp[0].exp_typ, "WOPAY");
  assert.equal(r1.json.exp[0].inv[0].itms[0].txval, 8000);
  assert.equal(r1.json.exp[0].inv[0].sbpcode, "INMAA1");
  const sez = r1.json.b2b.find((c) => c.ctin === regOther.gstin).inv[0];
  assert.equal(sez.inv_typ, "SEWP");
  assert.equal(r1.json.b2b.find((c) => c.ctin === regLocal.gstin).inv[0].rchrg, "Y");

  const rcmPurchase = { id: "rp", voucherDate: "2026-10-03", gstVersion: 2, isGstEnabled: true, reverseCharge: true, items: [{ quantity: 1, rate: 2000, gstRate: 5 }] };
  const r3 = buildGstr3b({ invoices: extra, creditNotes: [], purchases: [rcmPurchase], company, ym: "2026-10" });
  assert.equal(r3.zeroRated.txval, 8000 + 1000);
  assert.equal(r3.zeroRated.iamt, 180);
  assert.equal(r3.rcmOutward.txval, 1000);
  assert.equal(r3.inwardRcm.camt, 50);
  assert.equal(r3.itcRcm.camt, 50);
  assert.equal(r3.setOff.rcmCash.cgst, 50); // RCM tax is paid in cash
  // Export IGST 180, less the RCM CGST/SGST credit (50 + 50) set off against IGST.
  assert.equal(r3.setOff.cash.igst, 80);
  assert.equal(r3.setOff.totalCash, 80 + 50 + 50);
});
