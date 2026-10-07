// Run with: npm run test:chatbot  (node --test, no browser needed)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { classify, rawInvoiceRef } from "./intents.js";
import { respond } from "./responses.js";
import * as A from "./analytics.js";
import { parsePeriod, toDate } from "./dates.js";
import { checkGstin } from "./gstin.js";
import { applyEdit, isConfirmWord, isCancelWord } from "./edits.js";
import { renderPending } from "./cards.js";
import { extractAmounts, findEntityInText } from "./text.js";

const NOW = new Date(2026, 9, 6, 10, 0); // 6 Oct 2026, 10:00 local

const customers = [
  { id: "c1", name: "Ravi Traders", phone: "9876543210" },
  { id: "c2", name: "ABC Company" },
  { id: "c3", name: "Meena Textiles" },
];
const products = [
  { id: "p1", name: "Cement", price: 400, unit: "bag", minStockLevel: 20 },
  { id: "p2", name: "ABC Product", price: 250 },
  { id: "p3", name: "Steel Rod", price: 900 },
];
const inv = (o) => ({ cgst: 9, sgst: 9, igst: 0, isGstEnabled: true, status: "Unpaid", ...o });
const invoices = [
  // today, unpaid, Ravi
  inv({ id: "i1", invoiceNumber: "005/2026-27", invoiceDate: "2026-10-06", dueDate: "2026-10-20", clientId: "c1", client: customers[0], amount: 1180, items: [{ productId: "p2", description: "ABC Product", quantity: 4, rate: 250, amount: 1000 }] }),
  // September, partly paid with TDS, overdue, Ravi
  inv({ id: "i2", invoiceNumber: "004/2026-27", invoiceDate: "2026-09-10", dueDate: "2026-09-25", clientId: "c1", client: customers[0], amount: 4720, paidAmount: 2000, tdsAmount: 80, status: "Partial", items: [{ productId: "p1", description: "Cement", quantity: 10, rate: 400, amount: 4000 }] }),
  // September, paid, ABC
  inv({ id: "i3", invoiceNumber: "003/2026-27", invoiceDate: "2026-09-02", dueDate: "2026-09-02", clientId: "c2", client: customers[1], amount: 2360, paidAmount: 2360, status: "Paid", items: [{ productId: "p1", description: "Cement", quantity: 5, rate: 400, amount: 2000 }] }),
  // draft: never counts
  inv({ id: "i4", invoiceNumber: "006/2026-27", invoiceDate: "2026-10-06", clientId: "c3", client: customers[2], amount: 99999, status: "Draft", items: [] }),
];
const expenses = [
  { id: "e1", amount: 500, category: "Utilities", expenseDate: new Date(2026, 9, 2) },
  { id: "e2", amount: 1500, category: "Rent Expense", expenseDate: { seconds: new Date(2026, 8, 5).getTime() / 1000 } },
];
const payments = [
  { amount: 2000, paymentDate: "15/09/2026", status: "completed" },
  { amount: 2360, paymentDate: "02/09/2026" },
];
const stock = [
  { productId: "p1", quantity: 12, godownId: "a" },
  { productId: "p1", quantity: 3, godownId: "b" },
  { productId: "p2", quantity: 100 },
];
const data = { invoices, expenses, payments, products, customers, stock, companyName: "Test Co" };
const ctx = { customers, products, now: NOW };
const ask = (text, last) => {
  const cls = classify(text, { ...ctx, last });
  return { cls, reply: respond(cls, data, NOW) };
};

describe("dates", () => {
  test("periods use local time", () => {
    assert.equal(parsePeriod("sales today", NOW).start.getDate(), 6);
    assert.equal(parsePeriod("last month", NOW).start.getMonth(), 8);
    assert.equal(parsePeriod("sales in september", NOW).label, "September 2026");
    assert.equal(parsePeriod("november", NOW).start.getFullYear(), 2025, "a month later this year means last year's");
    assert.equal(parsePeriod("this year", NOW).start.getMonth(), 3, "financial year starts in April");
    assert.equal(parsePeriod("may I see sales", NOW), null);
  });
  test("every stored date format is read", () => {
    assert.equal(toDate("2026-10-06").getDate(), 6);
    assert.equal(toDate("15/09/2026").getMonth(), 8);
    assert.equal(toDate({ seconds: 0 }).getTime(), 0);
  });
});

describe("analytics", () => {
  test("drafts are not sales and partial payments owe only the balance", () => {
    const s = A.salesSummary(invoices);
    assert.equal(s.count, 3);
    assert.equal(s.billed, 1180 + 4720 + 2360);
    assert.equal(A.invoiceBalance(invoices[1]), 4720 - 2000 - 80);
    assert.equal(A.invoiceStatus(invoices[1], NOW), "Overdue");
    assert.equal(A.invoiceStatus(invoices[2], NOW), "Paid");
  });
  test("receivables group by customer", () => {
    const r = A.receivables(invoices, NOW);
    assert.equal(r.length, 1);
    assert.equal(r[0].name, "Ravi Traders");
    assert.equal(r[0].balance, 1180 + 2640);
    assert.equal(r[0].overdue, 2640);
  });
  test("GST and profit", () => {
    const g = A.gstSummary(invoices, parsePeriod("september", NOW));
    assert.equal(g.taxable, 6000);
    assert.equal(g.total, 1080);
    const p = A.profitSummary(invoices, expenses, parsePeriod("september", NOW));
    assert.equal(p.profit, 7080 - 1080 - 1500);
  });
  test("payment is split oldest first and capped at what is owed", () => {
    const plan = A.allocatePayment(invoices.filter((i) => i.clientId === "c1"), 5000);
    assert.deepEqual(plan.lines.map((l) => [l.invoice.id, l.amount]), [["i2", 2640], ["i1", 1180]]);
    assert.equal(plan.unapplied, 5000 - 3820);
    assert.equal(A.invoiceAfterPayment(invoices[1], 2640, "UPI", "x").status, "Paid");
  });
  test("stock adds godowns and flags only out-of-stock items", () => {
    const r = A.stockReport(products, stock, invoices, NOW);
    assert.equal(r.rows.find((x) => x.product.id === "p1").qty, 15);
    assert.deepEqual(r.low.map((x) => x.product.id), []);
    assert.deepEqual(r.untracked.map((p) => p.id), ["p3"]);
  });
  test("invoice numbers", () => {
    assert.equal(A.findInvoicesByNumber(invoices, "5")[0].id, "i1");
    assert.equal(A.findInvoicesByNumber(invoices, "004/2026-27")[0].id, "i2");
    assert.equal(rawInvoiceRef("show invoice 005/2026-27"), "005/2026-27");
    assert.equal(rawInvoiceRef("bill no 12"), "12");
  });
});

describe("text", () => {
  test("names are found inside sentences", () => {
    assert.equal(findEntityInText("how much does ravi owe", customers, (c) => c.name).item.id, "c1");
    assert.equal(findEntityInText("meena textile balance", customers, (c) => c.name).item.id, "c3");
    assert.equal(findEntityInText("sales this month", customers, (c) => c.name), null);
  });
  test("amounts", () => {
    assert.deepEqual(extractAmounts("paid ₹5,000 and 2.5k and 1 lakh").map((a) => a.value), [5000, 2500, 100000]);
  });
  test("GSTIN check digit", () => {
    assert.equal(checkGstin("27AAPFU0939F1ZV").valid, true);
    assert.equal(checkGstin("27AAPFU0939F1ZX").valid, false);
    assert.equal(checkGstin("27AAPFU0939F1ZV").state, "Maharashtra");
  });
});

describe("intents", () => {
  const intent = (text, last) => classify(text, { ...ctx, last }).intent;
  test("questions", () => {
    assert.equal(intent("what was today's sales?"), "sales");
    assert.equal(intent("who owes me money"), "receivables");
    assert.equal(intent("which customers have not paid"), "receivables");
    assert.equal(intent("how much money did i collect this month"), "collections");
    assert.equal(intent("iniku sales evlo"), "sales");
    assert.equal(intent("yaar kaasu tharanum"), "receivables");
    assert.equal(intent("meena textiles gave 1500 through gpay"), "record_payment");
    assert.equal(intent("paid 800 for electricity bill"), "add_expense");
    assert.equal(intent("how much does Ravi owe"), "customer_balance");
    assert.equal(intent("overdue invoices"), "overdue");
    assert.equal(intent("profit last month"), "profit");
    assert.equal(intent("gst collected in september"), "gst");
    assert.equal(intent("expenses this month"), "expenses");
    assert.equal(intent("top selling products"), "top_products");
    assert.equal(intent("best customers"), "top_customers");
    assert.equal(intent("price of cement"), "product_info");
    assert.equal(intent("low stock"), "stock");
    assert.equal(intent("show invoice 005"), "invoice_lookup");
    assert.equal(intent("payments received this week"), "collections");
    assert.equal(intent("recent invoices"), "recent_invoices");
    assert.equal(intent("check gstin 27AAPFU0939F1ZV"), "gstin_check");
    assert.equal(intent("help"), "help");
    assert.equal(intent("hi"), "greeting");
    assert.equal(intent("Meena Textiles"), "customer_info");
  });
  test("actions", () => {
    assert.equal(intent("create a invoice for abc company and for abc product and 2 quantity"), "create_invoice");
    assert.equal(intent("Ravi Traders paid 5000 by UPI"), "record_payment");
    assert.equal(intent("received 2000 from meena textiles cash"), "record_payment");
    assert.equal(intent("mark invoice 004 as paid"), "mark_paid");
    assert.equal(intent("add customer Suresh Stores phone 9876501234"), "add_customer");
    assert.equal(intent("add product Sand price 1200 unit bag hsn 2505"), "add_product");
    assert.equal(intent("add expense 1500 for electricity"), "add_expense");
    assert.equal(intent("spent 300 on tea"), "add_expense");
    assert.equal(intent("open reports"), "navigate");
    assert.equal(intent("did ravi pay 5000?"), "customer_balance", "a question is not an action");
  });
  test("follow-ups reuse the last topic", () => {
    const first = classify("profit this month", ctx);
    const next = classify("and last month?", { ...ctx, last: { intent: first.intent } });
    assert.equal(next.intent, "profit");
    assert.equal(next.period.label, "last month");
  });
  test("fields are extracted", () => {
    const c = classify("add customer Suresh Stores phone 98765 01234 gstin 27AAPFU0939F1ZV", ctx).fields;
    assert.equal(c.name, "Suresh Stores");
    assert.equal(c.phone, "9876501234");
    assert.equal(c.gstin, "27AAPFU0939F1ZV");
    const p = classify("add product River Sand price 1,200 unit bag hsn 2505", ctx).fields;
    assert.deepEqual([p.name, p.price, p.unit, p.hsn], ["River Sand", 1200, "bag", "2505"]);
    const e = classify("add expense 1500 for electricity bill", ctx).fields;
    assert.deepEqual([e.amount, e.category], [1500, "Utilities"]);
  });
});

describe("replies", () => {
  test("sales today ignores drafts", () => {
    const { reply } = ask("sales today");
    assert.match(reply.text, /₹1,180\.00/);
    assert.match(reply.text, /1 invoice\b/);
  });
  test("payment preview applies oldest first", () => {
    const { reply } = ask("Ravi Traders paid 3000 by UPI");
    assert.equal(reply.pending.kind, "payment");
    assert.equal(reply.pending.mode, "UPI");
    assert.deepEqual(reply.pending.lines.map((l) => l.amount), [2640, 360]);
  });
  test("mark paid uses the balance", () => {
    const { reply } = ask("mark invoice 004 as paid");
    assert.equal(reply.pending.amount, 2640);
  });
  test("customer with nothing due", () => {
    assert.match(ask("ABC Company balance").reply.text, /nothing/);
  });
  test("unknown text gets suggestions, not a fake answer", () => {
    assert.match(ask("blorf zzz").reply.text, /not sure/);
  });
  test("every intent replies without throwing", () => {
    for (const text of ["sales", "collections this month", "receivables", "overdue", "Ravi", "cement", "top products", "top customers", "gst", "expenses", "profit", "stock", "invoice 3", "recent invoices", "summary", "add customer X", "add product Y price 10", "add expense 50 tea", "mark invoice 3 paid", "open invoices"]) {
      const { reply } = ask(text);
      assert.ok(reply.text.length > 0, text);
    }
  });
});

describe("follow-up edits and record updates", () => {
  test("confirm and cancel words", () => {
    for (const w of ["yes", "Save it", "confirm", "ok", "create it"]) assert.equal(isConfirmWord(w), true, w);
    for (const w of ["no", "cancel", "discard it"]) assert.equal(isCancelWord(w), true, w);
    assert.equal(isConfirmWord("yes add 5 more"), false);
  });
  test("customer card edits", () => {
    const { reply } = ask("add customer Suresh Stores");
    let p = reply.pending;
    p = applyEdit(p, "phone 98765 01234", data, NOW).pending;
    p = applyEdit(p, "gstin 27AAPFU0939F1ZV", data, NOW).pending;
    p = applyEdit(p, "change name to Suresh Traders", data, NOW).pending;
    assert.deepEqual([p.payload.name, p.payload.phone, p.payload.gstin], ["Suresh Traders", "9876501234", "27AAPFU0939F1ZV"]);
    assert.match(renderPending(p, data), /Suresh Traders/);
    assert.match(applyEdit(p, "gstin 27AAPFU0939F1ZX", data, NOW).error, /GSTIN/);
    assert.equal(applyEdit(p, "what is the weather", data, NOW), null);
  });
  test("product card edits", () => {
    let p = ask("add product Sand price 1200").reply.pending;
    p = applyEdit(p, "price 1250", data, NOW).pending;
    p = applyEdit(p, "unit bag", data, NOW).pending;
    p = applyEdit(p, "purchase price 900", data, NOW).pending;
    p = applyEdit(p, "hsn 2505", data, NOW).pending;
    assert.deepEqual([p.payload.price, p.payload.unit, p.payload.purchasePrice, p.payload.hsn], [1250, "bag", 900, "2505"]);
  });
  test("expense card edits", () => {
    let p = ask("add expense 1500 for electricity").reply.pending;
    p = applyEdit(p, "make it 2000", data, NOW).pending;
    p = applyEdit(p, "yesterday", data, NOW).pending;
    p = applyEdit(p, "category rent", data, NOW).pending;
    assert.deepEqual([p.payload.amount, p.payload.expenseDate, p.payload.category], [2000, "2026-10-05", "Rent Expense"]);
  });
  test("payment card edits re-split the money", () => {
    let p = ask("Ravi Traders paid 1000 by upi").reply.pending;
    p = applyEdit(p, "make it 3000", data, NOW).pending;
    p = applyEdit(p, "by cash", data, NOW).pending;
    assert.deepEqual(p.lines.map((l) => l.amount), [2640, 360]);
    assert.equal(p.mode, "Cash");
  });
  test("updating existing records", () => {
    const u = ask("change price of steel rod to 950");
    assert.equal(u.cls.intent, "update_product");
    assert.equal(u.reply.pending.patch.price, 950);
    const c = ask("update phone of Meena Textiles to 9876501234");
    assert.equal(c.cls.intent, "update_customer");
    assert.equal(c.reply.pending.patch.phone, "9876501234");
    const city = ask("change city of Ravi Traders to Madurai");
    assert.equal(city.reply.pending.patch.city, "Madurai");
    assert.equal(ask("set cement hsn to 2523").reply.pending.patch.hsn, "2523");
    assert.equal(ask("deactivate product steel rod").reply.pending.kind, "product_deactivate");
    assert.equal(classify("create challan for Ravi Traders 10 bag cement", ctx).intent, "create_challan");
  });
});

describe("credit notes reduce what is due", () => {
  test("balance and status count credited amounts", () => {
    const inv = { amount: 1180, paidAmount: 500, creditedAmount: 680, status: "Unpaid", dueDate: "2099-01-01" };
    assert.equal(A.invoiceBalance(inv), 0);
    assert.equal(A.invoiceStatus(inv), "Paid");
    assert.equal(A.invoiceBalance({ ...inv, creditedAmount: 118 }), 562);
  });
});
