// Run with: node --test src/utils/einvoice.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEinvoicePayload, buildEwayBillJson, uqcFor } from "./einvoice.js";

const profile = { companyName: "Acme Traders", gstin: "33AMWPB2116Q1ZS", address: "1/100 Main Road", city: "Coimbatore", state: "Tamil Nadu", pincode: "641050", phone: "+91 98765 43210", email: "a@acme.in" };
const invoice = {
  invoiceNumber: "008/2026-27",
  invoiceDate: "2026-10-07",
  gstVersion: 2,
  isGstEnabled: true,
  isInterState: true,
  isRoundOff: true,
  placeOfSupply: { code: "29", name: "Karnataka" },
  client: { name: "Bengaluru Co", gstin: "29ABCDE1234F1Z5", address: "12 MG Road, Bengaluru 560001" },
  items: [
    { description: "Pump", hsnCode: "8413", quantity: 2, unit: "Piece", rate: 30000, gstRate: 18, discount: 5 },
    { description: "Installation", hsnCode: "998719", quantity: 1, unit: "Hour", rate: 2000, gstRate: 18 },
  ],
};

test("UQC codes", () => {
  assert.equal(uqcFor("Kilogram"), "KGS");
  assert.equal(uqcFor("Piece"), "PCS");
  assert.equal(uqcFor("weird"), "OTH");
});

test("e-invoice payload follows the IRP schema and adds up", () => {
  const { payload, problems } = buildEinvoicePayload(invoice, profile);
  assert.deepEqual(problems, []);
  assert.equal(payload.Version, "1.1");
  assert.equal(payload.DocDtls.Dt, "07/10/2026");
  assert.equal(payload.SellerDtls.Stcd, "33");
  assert.equal(payload.SellerDtls.Pin, 641050);
  assert.equal(payload.BuyerDtls.Pos, "29");
  assert.equal(payload.BuyerDtls.Pin, 560001);
  const pump = payload.ItemList[0];
  assert.equal(pump.TotAmt, 60000);
  assert.equal(pump.Discount, 3000);
  assert.equal(pump.AssAmt, 57000);
  assert.equal(pump.IgstAmt, 10260);
  assert.equal(pump.Unit, "PCS");
  assert.equal(payload.ItemList[1].IsServc, "Y");
  const sumItems = payload.ItemList.reduce((s, i) => s + i.TotItemVal, 0);
  assert.equal(payload.ValDtls.TotInvVal, Math.round(sumItems));
  assert.equal(payload.ValDtls.AssVal, 59000);
});

test("e-invoice lists what is missing", () => {
  const { problems } = buildEinvoicePayload({ ...invoice, client: { name: "Walk-in" } }, { companyName: "X" });
  assert.ok(problems.some((p) => p.includes("Your GSTIN")));
  assert.ok(problems.some((p) => p.includes("registered buyers")));
});

test("e-way bill JSON carries goods only, with state codes as numbers", () => {
  const { json, problems } = buildEwayBillJson(invoice, profile, { vehicleNo: "TN 37 AB-1234", distance: 350 });
  const bill = json.billLists[0];
  assert.equal(json.version, "1.0.0621");
  assert.equal(bill.fromStateCode, 33);
  assert.equal(bill.toStateCode, 29);
  assert.equal(bill.vehicleNo, "TN37AB1234");
  assert.equal(bill.itemList.length, 1); // installation (SAC 99…) left out
  assert.equal(bill.itemList[0].igstRate, 18);
  assert.equal(bill.totalValue, 57000);
  assert.equal(bill.mainHsnCode, 8413);
  assert.deepEqual(problems, []);
});

test("export e-invoice: URP buyer, POS 96, values in rupees, export details", () => {
  const exp = { ...invoice, supplyType: "EXPWOP", currency: "USD", exchangeRate: 80, countryCode: "us", portCode: "INMAA1", shippingBillNo: "SB1", client: { name: "US Buyer", address: "NYC" }, items: [{ description: "Pump", hsnCode: "8413", quantity: 1, unit: "Piece", rate: 100, gstRate: 18 }] };
  const { payload, problems } = buildEinvoicePayload(exp, profile);
  assert.deepEqual(problems, []);
  assert.equal(payload.TranDtls.SupTyp, "EXPWOP");
  assert.equal(payload.BuyerDtls.Gstin, "URP");
  assert.equal(payload.BuyerDtls.Pos, "96");
  assert.equal(payload.ItemList[0].AssAmt, 8000);
  assert.equal(payload.ItemList[0].IgstAmt, 0);
  assert.equal(payload.ExpDtls.CntCode, "US");
  assert.equal(payload.ExpDtls.ForCur, "USD");
});

test("reverse-charge e-invoice is flagged", () => {
  const { payload } = buildEinvoicePayload({ ...invoice, reverseCharge: true }, profile);
  assert.equal(payload.TranDtls.RegRev, "Y");
});
