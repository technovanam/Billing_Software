// Run with: node --test src/utils/gst.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeInvoice,
  computeLegacyInvoice,
  invoiceTotals,
  placeOfSupply,
  partyStateCode,
  stateCodeFromName,
  taxFieldsForSave,
  round2,
  GST_VERSION,
  invoiceTotalsInr,
} from "./gst.js";

const seller = { gstin: "33AMWPB2116Q1ZS", state: "Tamil Nadu" };

describe("place of supply", () => {
  test("GSTIN decides the state before the state field", () => {
    assert.equal(partyStateCode({ gstin: "29ABCDE1234F1Z5", state: "Tamil Nadu" }), "29");
  });
  test("state name is matched loosely", () => {
    assert.equal(stateCodeFromName("tamil nadu"), "33");
    assert.equal(stateCodeFromName("Jammu and Kashmir"), "01");
    assert.equal(stateCodeFromName("Andaman & Nicobar Islands"), "35");
  });
  test("same state is intra-state, other state is inter-state", () => {
    assert.equal(placeOfSupply(seller, { state: "Tamil Nadu" }).isInterState, false);
    const other = placeOfSupply(seller, { gstin: "29ABCDE1234F1Z5" });
    assert.equal(other.isInterState, true);
    assert.equal(other.name, "Karnataka");
  });
  test("customer without state is treated as local", () => {
    const p = placeOfSupply(seller, { name: "Walk-in" });
    assert.equal(p.code, "33");
    assert.equal(p.isInterState, false);
  });
});

describe("item-wise GST", () => {
  const items = [
    { hsnCode: "7214", quantity: 10, rate: 100, gstRate: 18 },
    { hsnCode: "1006", quantity: 2, rate: 50, gstRate: 5, discount: 10 },
    { hsnCode: "7214", quantity: 1, rate: 200, gstRate: 18 },
  ];

  test("intra-state splits each rate into CGST and SGST", () => {
    const t = computeInvoice({ items, isInterState: false });
    assert.equal(t.taxableAmount, 1290); // 1000 + 90 + 200
    assert.equal(t.cgstAmount, 110.25); // 90 + 2.25 + 18
    assert.equal(t.sgstAmount, 110.25);
    assert.equal(t.igstAmount, 0);
    assert.equal(t.total, 1510.5);
  });

  test("inter-state charges IGST only", () => {
    const t = computeInvoice({ items, isInterState: true });
    assert.equal(t.cgstAmount, 0);
    assert.equal(t.igstAmount, 220.5);
    assert.equal(t.total, 1510.5);
  });

  test("line discount reduces the taxable value", () => {
    const t = computeInvoice({ items: [items[1]] });
    assert.equal(t.lines[0].discountAmount, 10);
    assert.equal(t.lines[0].taxable, 90);
  });

  test("HSN summary groups by HSN and rate", () => {
    const t = computeInvoice({ items });
    const steel = t.hsnSummary.find((h) => h.hsn === "7214");
    assert.equal(steel.taxable, 1200);
    assert.equal(steel.cgst, 108);
    assert.equal(t.hsnSummary.length, 2);
  });

  test("tax breakup is per rate, zero-rated lines excluded", () => {
    const t = computeInvoice({ items: [...items, { quantity: 1, rate: 40, gstRate: 0 }] });
    assert.deepEqual(t.taxBreakup.map((b) => b.gstRate), [5, 18]);
  });

  test("round off goes to the nearest rupee", () => {
    const t = computeInvoice({ items, isRoundOff: true });
    assert.equal(t.total, 1511);
    assert.equal(t.roundOffAmount, 0.5);
  });

  test("GST off means no tax", () => {
    const t = computeInvoice({ items, isGstEnabled: false });
    assert.equal(t.totalTax, 0);
    assert.equal(t.total, 1290);
  });

  test("paise rounding is stable", () => {
    assert.equal(round2(1.005), 1.01);
    const t = computeInvoice({ items: [{ quantity: 3, rate: 33.33, gstRate: 18 }] });
    assert.equal(t.taxableAmount, 99.99);
    assert.equal(t.cgstAmount, 9);
  });
});

describe("old invoices keep their numbers", () => {
  const legacy = { items: [{ quantity: 2, rate: 500 }], cgst: 9, sgst: 9, igst: 0, isGstEnabled: true, isRoundOff: true };

  test("legacy maths is unchanged", () => {
    const t = computeLegacyInvoice(legacy);
    assert.equal(t.cgstAmount, 90);
    assert.equal(t.total, 1180);
  });

  test("invoiceTotals picks legacy maths without gstVersion", () => {
    assert.equal(invoiceTotals(legacy).total, 1180);
  });

  test("invoiceTotals picks item-wise maths with gstVersion", () => {
    const inv = { gstVersion: GST_VERSION, isInterState: true, items: [{ quantity: 1, rate: 1000, gstRate: 12 }] };
    const t = invoiceTotals(inv);
    assert.equal(t.igstAmount, 120);
    assert.equal(t.total, 1120);
  });

  test("taxFieldsForSave stores amounts on the invoice", () => {
    const inv = { gstVersion: GST_VERSION, isInterState: false, items: [{ id: 1, quantity: 1, rate: 1000, gstRate: 12 }] };
    const f = taxFieldsForSave(inv);
    assert.equal(f.cgstAmount, 60);
    assert.equal(f.amount, 1120);
    assert.equal(f.items[0].amount, 1000);
    assert.equal(f.items[0].cgst, 60);
  });
});

describe("reverse charge, exports, SEZ and foreign currency", () => {
  const items = [{ hsnCode: "9965", quantity: 1, rate: 10000, gstRate: 5 }];

  test("reverse charge: tax shown but not added to the bill", () => {
    const t = invoiceTotals({ gstVersion: GST_VERSION, reverseCharge: true, isInterState: false, items });
    assert.equal(t.cgstAmount, 250);
    assert.equal(t.totalTax, 500);
    assert.equal(t.taxCharged, 0);
    assert.equal(t.total, 10000);
  });

  test("export under LUT is zero-rated and always IGST", () => {
    const t = invoiceTotals({ gstVersion: GST_VERSION, supplyType: "EXPWOP", isInterState: false, items: [{ quantity: 2, rate: 100, gstRate: 18 }] });
    assert.equal(t.igstAmount, 0);
    assert.equal(t.cgstAmount, 0);
    assert.equal(t.total, 200);
    assert.equal(t.taxBreakup[0].gstRate, 18);
  });

  test("export with payment and SEZ with payment charge IGST", () => {
    for (const supplyType of ["EXPWP", "SEZWP"]) {
      const t = invoiceTotals({ gstVersion: GST_VERSION, supplyType, isInterState: false, items: [{ quantity: 1, rate: 1000, gstRate: 18 }] });
      assert.equal(t.igstAmount, 180, supplyType);
      assert.equal(t.cgstAmount, 0, supplyType);
    }
  });

  test("foreign currency: saved amounts are in rupees, invoice total kept", () => {
    const inv = { gstVersion: GST_VERSION, supplyType: "EXPWP", currency: "USD", exchangeRate: 83.5, items: [{ id: 1, quantity: 10, rate: 12, gstRate: 18 }] };
    assert.equal(invoiceTotals(inv).total, 141.6);
    const inr = invoiceTotalsInr(inv);
    assert.equal(inr.taxableAmount, 10020);
    assert.equal(inr.igstAmount, 1803.6);
    const f = taxFieldsForSave(inv);
    assert.equal(f.amount, 11823.6);
    assert.equal(f.foreignAmount, 141.6);
  });
});

test("compensation cess and TCS", () => {
  const t = computeInvoice({ items: [{ quantity: 10, rate: 100, gstRate: 28, cessRate: 12 }], isInterState: false, tcsRate: 1 });
  assert.equal(t.taxableAmount, 1000);
  assert.equal(t.cgstAmount, 140);
  assert.equal(t.cessAmount, 120);
  assert.equal(t.totalTax, 400);
  assert.equal(t.tcsAmount, 14); // 1% of 1,400
  assert.equal(t.total, 1414);
  assert.equal(t.taxBreakup[0].cess, 120);
  // Under LUT no cess is charged either.
  assert.equal(computeInvoice({ items: [{ quantity: 1, rate: 100, gstRate: 28, cessRate: 12 }], taxMode: "zero" }).cessAmount, 0);
});
