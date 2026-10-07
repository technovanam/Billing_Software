// Run with: node --test src/utils/inventory.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { stockSummary, initialStockValue, godownStock, MAIN_GODOWN } from "./inventory.js";

const products = [
  { id: "p1", name: "Pump", unit: "Piece", purchasePrice: 700, openingStock: 10 },
  { id: "p2", name: "Cable", unit: "Metre", purchasePrice: 20 },
  { id: "p3", name: "Unused", purchasePrice: 5 },
];
const data = {
  products,
  purchases: [{ voucherNumber: "PUR-1", voucherDate: "2026-04-05", items: [{ productId: "p1", quantity: 10, rate: 800, taxable: 8000 }, { description: "cable", quantity: 100, rate: 20, taxable: 2000 }] }],
  invoices: [
    { invoiceNumber: "001", invoiceDate: "2026-04-10", status: "Unpaid", items: [{ productId: "p1", quantity: 5, rate: 1200 }] },
    { invoiceNumber: "002", invoiceDate: "2026-04-11", status: "Draft", items: [{ productId: "p1", quantity: 50, rate: 1200 }] },
    { invoiceNumber: "003", invoiceDate: "2026-05-02", status: "Paid", items: [{ description: "Cable", quantity: 30, rate: 40 }] },
  ],
  creditNotes: [{ voucherNumber: "CN-1", voucherDate: "2026-04-20", items: [{ productId: "p1", quantity: 1, rate: 1200 }] }],
  debitNotes: [{ voucherNumber: "DN-1", voucherDate: "2026-04-25", items: [{ productId: "p1", quantity: 2, rate: 800, taxable: 1600 }] }],
  stockJournals: [{ productId: "p2", quantity: -5, voucherDate: "2026-05-10", reason: "Damaged" }],
};

test("quantities move with every voucher; drafts ignored; names match products", () => {
  const s = stockSummary(data);
  const pump = s.rows.find((r) => r.productId === "p1");
  assert.equal(pump.opening, 10);
  assert.equal(pump.inward, 10 + 1);
  assert.equal(pump.outward, 5 + 2);
  assert.equal(pump.closing, 14);
  const cable = s.rows.find((r) => r.productId === "p2");
  assert.equal(cable.closing, 100 - 30 - 5);
  assert.ok(!s.rows.some((r) => r.productId === "p3"));
});

test("weighted-average valuation", () => {
  const pump = stockSummary(data).rows.find((r) => r.productId === "p1");
  assert.equal(pump.rate, 750); // (10×700 + 10×800) / 20
  assert.equal(pump.closingValue, 14 * 750);
});

test("period opening includes earlier movements", () => {
  const s = stockSummary(data, { from: "2026-05-01", to: "2026-05-31" });
  const cable = s.rows.find((r) => r.productId === "p2");
  assert.equal(cable.opening, 100);
  assert.equal(cable.outward, 35);
  assert.equal(cable.closing, 65);
});

test("initial stock value for the capital account", () => {
  assert.equal(initialStockValue(products), 7000);
});

test("godowns: purchases land in their godown, transfers move stock without changing the total", () => {
  const d = {
    products: [{ id: "g1", name: "Bolt", purchasePrice: 2, openingStock: 100 }],
    purchases: [{ voucherDate: "2026-04-02", godown: "Chennai", items: [{ productId: "g1", quantity: 50, rate: 2, taxable: 100 }] }],
    invoices: [{ invoiceDate: "2026-04-03", status: "Unpaid", godown: "Chennai", items: [{ productId: "g1", quantity: 10, rate: 5 }] }],
    stockJournals: [{ kind: "transfer", productId: "g1", quantity: 30, fromGodown: MAIN_GODOWN, toGodown: "Chennai", voucherDate: "2026-04-04" }],
  };
  const total = stockSummary(d).rows[0];
  assert.equal(total.closing, 140);
  assert.equal(stockSummary(d, { godown: "Chennai" }).rows[0].closing, 50 - 10 + 30);
  assert.equal(stockSummary(d, { godown: MAIN_GODOWN }).rows[0].closing, 70);
  const g = godownStock(d);
  assert.equal(g.find((r) => r.godown === "Chennai").qty, 70);
});

test("batch-wise stock with expiry status (FEFO)", async () => {
  const { batchStock, availableBatches } = await import("./inventory.js");
  const data = {
    products: [{ id: "m", name: "Paracetamol", unit: "Strip", trackBatches: true }],
    purchases: [
      { id: "p1", voucherDate: "2026-04-01", items: [{ productId: "m", quantity: 100, rate: 10, batchNo: "B1", expiryDate: "2026-06-30" }] },
      { id: "p2", voucherDate: "2026-04-05", items: [{ productId: "m", quantity: 50, rate: 11, batchNo: "B2", expiryDate: "2027-03-31" }] },
    ],
    invoices: [{ id: "i1", invoiceDate: "2026-05-01", status: "Unpaid", items: [{ productId: "m", quantity: 30, rate: 20, batchNo: "B1" }] }],
  };
  const rows = batchStock(data, { asOn: "2026-06-15" });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].batch, "B1");
  assert.equal(rows[0].qty, 70);
  assert.equal(rows[0].status, "Expiring soon");
  assert.equal(rows[1].status, "OK");
  assert.equal(batchStock(data, { asOn: "2026-07-01" })[0].status, "Expired");
  assert.deepEqual(availableBatches(data, "m", "2026-06-15").map((b) => b.batch), ["B1", "B2"]);
});

test("manufacturing journal consumes components and values the finished item at their cost", async () => {
  const { bomRequirement, stockSummary, currentRates } = await import("./inventory.js");
  const products = [
    { id: "flour", name: "Flour", purchasePrice: 40 },
    { id: "sugar", name: "Sugar", purchasePrice: 50 },
    { id: "cake", name: "Cake", bom: { outputQty: 10, components: [{ productId: "flour", quantity: 2 }, { productId: "sugar", quantity: 1 }], overhead: 30 } },
  ];
  const data = { products, purchases: [{ id: "p", voucherDate: "2026-04-01", items: [{ productId: "flour", quantity: 10, rate: 40 }, { productId: "sugar", quantity: 10, rate: 50 }] }] };
  const need = bomRequirement(products[2], 20, currentRates(data));
  assert.deepEqual(need.components.map((c) => c.quantity), [4, 2]);
  assert.equal(need.cost, 4 * 40 + 2 * 50 + 60);
  data.stockJournals = [{ kind: "manufacture", voucherDate: "2026-04-02", productId: "cake", quantity: 20, rate: need.rate, components: need.components }];
  const s = stockSummary(data, { to: "2026-04-30" });
  const row = (id) => s.rows.find((r) => r.productId === id);
  assert.equal(row("flour").closing, 6);
  assert.equal(row("sugar").closing, 8);
  assert.equal(row("cake").closing, 20);
  assert.equal(row("cake").rate, 16);
});
