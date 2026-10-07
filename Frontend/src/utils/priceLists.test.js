// Run with: node --test src/utils/priceLists.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceFor, priceListFor } from "./priceLists.js";
import { applyProduct, newInvoiceItem } from "./invoiceForm.js";

test("price list rate, else list discount, else standard price", () => {
  const lists = [{ name: "Wholesale", discountPct: 10, rates: { p2: 70 } }];
  const list = priceListFor({ priceList: "Wholesale" }, lists);
  assert.equal(priceFor({ id: "p1", price: "₹1,000" }, list), 900);
  assert.equal(priceFor({ id: "p2", price: 100 }, list), 70);
  assert.equal(priceFor({ id: "p1", price: 100 }, null), 100);
  assert.equal(priceListFor({}, lists), null);
  const it = applyProduct(newInvoiceItem(18), { id: "p1", name: "Pump", price: 1000, gstRate: 12 }, 18, list);
  assert.equal(it.rate, 900);
});
