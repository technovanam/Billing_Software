// Builds the chatbot's reply for a classified message. Questions are answered
// from the business data; actions return a `pending` object that the chat
// shows as a confirm card, and nothing is saved until the user confirms.
import * as A from "./analytics.js";
import { formatDate, financialYear, toDate } from "./dates.js";
import { checkGstin } from "./gstin.js";
import { PAGES } from "./intents.js";
import { rankEntities, titleCase } from "./text.js";
import { renderPending } from "./cards.js";
import { applyEdit } from "./edits.js";

// Losses read "−₹700.00", not "₹-700.00".
const sign = (n) => (n < 0 ? "−" : "");
export const money = (v) => {
  const n = A.num(v);
  return `${sign(n)}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const short = (v) => {
  const n = A.num(v);
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign(n)}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign(n)}₹${(a / 1e5).toFixed(2)} L`;
  return `${sign(n)}₹${Math.round(a).toLocaleString("en-IN")}`;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (a, b) => (b ? `${(((a - b) / Math.abs(b)) * 100).toFixed(1)}%` : null);
const invoiceLabel = (inv) => `#${inv.invoiceNumber || inv.id}`;

function defaultPeriod(cls, now) {
  if (cls.period) return cls.period;
  const fy = financialYear(now);
  return { start: fy.start, end: fy.end, label: `this financial year (${fy.label})` };
}

function previousPeriod(period) {
  const len = period.end - period.start;
  return { start: new Date(period.start - len), end: new Date(period.start) };
}

export const HELP_TEXT = [
  "### 🤖 What I can do",
  "#### Create & record (I show a preview first)",
  "• create invoice for ABC Company, 2 ABC product",
  "• Ravi Traders paid 5000 by UPI",
  "• mark invoice 005 as paid",
  "• add customer Ravi Traders phone 9876543210",
  "• add product Cement price 400 unit bag hsn 2523",
  "• add expense 1500 for electricity",
  "• create challan for ABC Company, 10 bag cement",
  "#### Change things",
  "• On any preview, keep typing: \"add 10 more\", \"remove sugar\", \"phone 98765 43210\", \"price 450\", \"make it 2000\" · then \"yes\" to save or \"cancel\"",
  "• change price of cement to 450 · update phone of Ravi Traders to 9876543210",
  "• deactivate product cement",
  "#### Ask about your business",
  "• sales today / this week / last month / in September",
  "• who owes me money? · how much does Ravi owe?",
  "• overdue invoices · payments received this month",
  "• profit this month · GST last month · expenses this year",
  "• top products · best customers · stock levels",
  "• price of cement · show invoice 005 · recent invoices",
  "• check GSTIN 33ABCDE1234F1Z5",
  "#### Go somewhere",
  "• open invoices · go to reports",
  "",
  "Follow-ups work too: after a sales question, try \"and last month?\"",
].join("\n");

/**
 * @param {object} cls  result of classify()
 * @param {{ invoices, payments, expenses, products, stock, customers, companyName }} data
 * @returns {{ text, stats?, buttons?, pending?, topic? }}
 */
export function respond(cls, data, now = new Date()) {
  const invoices = data.invoices || [];
  const topic = { intent: cls.intent, period: cls.period, customer: cls.customer, product: cls.product };

  switch (cls.intent) {
    case "empty":
      return { text: "Type a question or a command. Say **help** to see what I can do." };

    case "greeting":
      return { text: `Hello! 👋 Ask me about sales, dues, profit, GST or stock, or tell me to create a bill.\n\nSay **help** to see everything I can do.` };

    case "thanks":
      return { text: "You're welcome! Anything else?" };

    case "help":
      return { text: HELP_TEXT };

    case "navigate":
      return { text: `Opening **${cls.page.label}**.`, navigateTo: cls.page.path, buttons: [{ label: `Open ${cls.page.label}`, to: cls.page.path }] };

    case "gstin_check": {
      const r = checkGstin(cls.gstin);
      if (!r.valid) {
        return { text: `### 🏢 GSTIN check: \`${r.gstin}\`\n\n❌ **Not valid**: ${r.problems.join("; ")}.` };
      }
      return {
        text:
          `### 🏢 GSTIN check: \`${r.gstin}\`\n\n` +
          `✅ **Format and check digit are correct.**\n` +
          `• **State**: ${r.state} (code ${r.stateCode})\n` +
          `• **PAN**: \`${r.pan}\`\n` +
          `• **Registration no. under this PAN**: ${r.entity}\n\n` +
          `Whether it is currently active can only be confirmed on the GST portal (gst.gov.in → Search Taxpayer).`,
        stats: [
          { label: "State", value: r.state, color: "text-blue-600" },
          { label: "PAN", value: r.pan, color: "text-indigo-600" },
        ],
      };
    }

    case "sales": {
      const period = defaultPeriod(cls, now);
      const s = A.salesSummary(invoices, period);
      const prev = A.salesSummary(invoices, previousPeriod(period));
      const change = pct(s.billed, prev.billed);
      const recent = [...s.invoices].sort((a, b) => (A.invoiceDate(b) || 0) - (A.invoiceDate(a) || 0)).slice(0, 5);
      return {
        topic: { ...topic, period },
        text:
          `### 📈 Sales ${period.label}\n\n` +
          `• **Billed**: **${money(s.billed)}** across ${plural(s.count, "invoice")}\n` +
          `• **Collected**: ${money(s.collected)} · **Still due**: ${money(s.balance)}\n` +
          (s.count ? `• **Average bill**: ${money(s.average)}\n` : "") +
          (change !== null ? `• **Versus the period before**: ${s.billed >= prev.billed ? "📈 +" : "📉 "}${change} (${money(prev.billed)})\n` : "") +
          (recent.length ? `\n#### Latest bills\n${recent.map((inv) => `• ${invoiceLabel(inv)} · ${A.customerNameOf(inv)} · ${money(A.invoiceTotal(inv))} · ${A.invoiceStatus(inv, now)}`).join("\n")}` : `\nNo bills ${period.label} yet.`),
        stats: [
          { label: "Billed", value: short(s.billed), color: "text-emerald-600" },
          { label: "Invoices", value: `${s.count}`, color: "text-blue-600" },
          { label: "Collected", value: short(s.collected), color: "text-indigo-600" },
          { label: "Due", value: short(s.balance), color: "text-rose-600" },
        ],
      };
    }

    case "collections": {
      const period = defaultPeriod(cls, now);
      const r = A.paymentsReceived(data.payments, period);
      return {
        topic: { ...topic, period },
        text: `### 💵 Payments received ${period.label}\n\n• **Received**: **${money(r.total)}** in ${plural(r.count, "payment")}\n\nThis counts payments recorded on the Payments page, the public pay link and the chat.`,
        stats: [{ label: "Received", value: short(r.total), color: "text-emerald-600" }, { label: "Payments", value: `${r.count}`, color: "text-blue-600" }],
      };
    }

    case "receivables": {
      const rows = A.receivables(invoices, now);
      if (!rows.length) return { topic, text: "### 🎉 Nobody owes you money\n\nEvery invoice is fully paid." };
      const total = rows.reduce((s, r) => s + r.balance, 0);
      const overdue = rows.reduce((s, r) => s + r.overdue, 0);
      return {
        topic,
        text:
          `### 💰 Who owes you money\n\n**${plural(rows.length, "customer")}** owe **${money(total)}** in total${overdue ? `, of which **${money(overdue)}** is overdue` : ""}.\n\n` +
          rows.slice(0, 8).map((r, i) => `${i + 1}. **${r.name}**: ${money(r.balance)}${r.overdue ? ` (⚠️ ${money(r.overdue)} overdue)` : ""} · ${plural(r.invoices.length, "bill")}`).join("\n") +
          (rows.length > 8 ? `\n…and ${rows.length - 8} more.` : "") +
          `\n\nTo record a payment, type e.g. "${rows[0].name} paid ${Math.round(rows[0].balance)} by UPI".`,
        stats: [
          { label: "Total due", value: short(total), color: "text-rose-600" },
          { label: "Overdue", value: short(overdue), color: "text-amber-600" },
          { label: "Customers", value: `${rows.length}`, color: "text-blue-600" },
        ],
        buttons: [{ label: "Open Payments", to: "/payments" }],
      };
    }

    case "overdue": {
      const list = A.overdueInvoices(invoices, now).filter((o) => !cls.customer || A.customerIdOf(o.inv) === cls.customer.id);
      if (!list.length) return { topic, text: `### ✅ No overdue invoices${cls.customer ? ` for ${A.customerDisplayName(cls.customer)}` : ""}` };
      const total = list.reduce((s, o) => s + o.balance, 0);
      return {
        topic,
        text:
          `### ⏰ Overdue invoices\n\n**${plural(list.length, "invoice")}** are past their due date, **${money(total)}** in total:\n\n` +
          list.slice(0, 10).map((o) => `• ${invoiceLabel(o.inv)} · ${A.customerNameOf(o.inv)} · ${money(o.balance)} · ${plural(o.days, "day")} late`).join("\n") +
          (list.length > 10 ? `\n…and ${list.length - 10} more.` : ""),
        stats: [{ label: "Overdue", value: short(total), color: "text-rose-600" }, { label: "Invoices", value: `${list.length}`, color: "text-amber-600" }],
        buttons: [{ label: "Open Invoices", to: "/invoices" }],
      };
    }

    case "customer_balance":
    case "customer_info": {
      if (!cls.customer) return clarifyCustomer(cls, data);
      const c = cls.customer;
      const name = A.customerDisplayName(c);
      const p = A.customerProfile(c, invoices, now);
      const periodSales = cls.period ? A.salesSummary(p.invoices, cls.period) : null;
      const openBills = p.invoices.filter((inv) => A.invoiceBalance(inv) > 0);
      return {
        topic,
        text:
          `### 👤 ${name}\n\n` +
          (p.balance
            ?`• **Owes you**: **${money(p.balance)}**${p.overdue.length ? ` (⚠️ ${plural(p.overdue.length, "bill")} overdue)` : ""}\n`
            : `• **Owes you**: nothing 🎉\n`) +
          (periodSales ? `• **Billed ${cls.period.label}**: ${money(periodSales.billed)} in ${plural(periodSales.count, "invoice")}\n` : "") +
          `• **Billed in total**: ${money(p.billed)} across ${plural(p.invoices.length, "invoice")}\n` +
          `• **Last bill**: ${p.lastBill ? formatDate(p.lastBill) : "never"}\n` +
          (c.phone || c.mobile ? `• **Phone**: ${c.phone || c.mobile}\n` : "") +
          (c.gstin || c.taxId ? `• **GSTIN**: \`${c.gstin || c.taxId}\`\n` : "") +
          (p.products.length ? `• **Usually buys**: ${p.products.map((r) => r.name).join(", ")}\n` : "") +
          (openBills.length
            ? `\n#### Unpaid bills\n${openBills.slice(0, 6).map((inv) => `• ${invoiceLabel(inv)} · ${formatDate(A.invoiceDate(inv))} · ${money(A.invoiceBalance(inv))} due · ${A.invoiceStatus(inv, now)}`).join("\n")}`
            : ""),
        stats: [
          { label: "Owes", value: short(p.balance), color: "text-rose-600" },
          { label: "Total billed", value: short(p.billed), color: "text-emerald-600" },
          { label: "Invoices", value: `${p.invoices.length}`, color: "text-blue-600" },
        ],
      };
    }

    case "product_info": {
      if (!cls.product) return { topic, text: "Which product? Type its name, e.g. \"price of cement\"." };
      const pr = cls.product;
      const period = defaultPeriod(cls, now);
      const r = A.productProfile(pr, invoices, data.stock, period);
      return {
        topic,
        text:
          `### 📦 ${pr.name}\n\n` +
          `• **Selling price**: **${money(pr.price)}**${pr.unit ? ` per ${pr.unit}` : ""}\n` +
          (pr.purchasePrice ? `• **Purchase price**: ${money(pr.purchasePrice)} (margin ${money(A.num(pr.price) - A.num(pr.purchasePrice))})\n` : "") +
          (pr.hsn ? `• **HSN**: ${pr.hsn}\n` : "") +
          `• **Sold ${period.label}**: ${r.units} ${pr.unit || "units"} in ${plural(r.bills, "bill")} · ${money(r.revenue)}\n` +
          (r.stock !== null
            ? `• **In stock**: ${r.stock}${pr.unit ? ` ${pr.unit}` : ""}${r.stock <= 0 ? " ⚠️ out of stock" : ""}\n`
            : `• **In stock**: not tracked (no stock records for this product)\n`) +
          (pr.isActive === false ? "\n⚠️ This product is deactivated." : ""),
        stats: [
          { label: "Price", value: money(pr.price), color: "text-blue-600" },
          { label: "Units sold", value: `${r.units}`, color: "text-emerald-600" },
          ...(r.stock !== null ? [{ label: "Stock", value: `${r.stock}`, color: r.stock <= 0 ? "text-rose-600" : "text-indigo-600" }] : []),
        ],
      };
    }

    case "top_products": {
      const period = defaultPeriod(cls, now);
      const rows = A.productSales(invoices, period);
      if (!rows.length) return { topic: { ...topic, period }, text: `No products sold ${period.label} yet.` };
      return {
        topic: { ...topic, period },
        text: `### 🏆 Top products ${period.label}\n\n` + rows.slice(0, 8).map((r, i) => `${i + 1}. **${r.name}**: ${money(r.revenue)} · ${r.units} units · ${plural(r.bills, "bill")}`).join("\n"),
        stats: [{ label: "Best seller", value: rows[0].name, color: "text-emerald-600" }, { label: "Its revenue", value: short(rows[0].revenue), color: "text-blue-600" }],
      };
    }

    case "top_customers": {
      const period = defaultPeriod(cls, now);
      const rows = A.customerSales(invoices, period);
      if (!rows.length) return { topic: { ...topic, period }, text: `No sales ${period.label} yet.` };
      return {
        topic: { ...topic, period },
        text:
          `### 🌟 Top customers ${period.label}\n\n` +
          rows.slice(0, 8).map((r, i) => `${i + 1}. **${r.name}**: ${money(r.billed)} · ${plural(r.bills, "bill")}${r.balance ? ` · owes ${money(r.balance)}` : ""}`).join("\n"),
        stats: [{ label: "Top customer", value: rows[0].name, color: "text-emerald-600" }, { label: "Billed", value: short(rows[0].billed), color: "text-blue-600" }],
      };
    }

    case "gst": {
      const period = defaultPeriod(cls, now);
      const g = A.gstSummary(invoices, period);
      return {
        topic: { ...topic, period },
        text:
          `### 🧾 GST on your bills ${period.label}\n\n` +
          `• **Taxable value**: ${money(g.taxable)} across ${plural(g.bills, "bill")}\n` +
          `• **CGST**: ${money(g.cgst)}\n• **SGST**: ${money(g.sgst)}\n• **IGST**: ${money(g.igst)}\n` +
          `• **Total GST charged**: **${money(g.total)}**\n\n` +
          `This is output GST from your invoices (drafts excluded). Input GST on purchases is not tracked here, so check with your accountant before filing.`,
        stats: [
          { label: "Total GST", value: short(g.total), color: "text-emerald-600" },
          { label: "CGST", value: short(g.cgst), color: "text-indigo-600" },
          { label: "SGST", value: short(g.sgst), color: "text-purple-600" },
        ],
      };
    }

    case "expenses": {
      const period = defaultPeriod(cls, now);
      const e = A.expenseSummary(data.expenses, period);
      return {
        topic: { ...topic, period },
        text:
          `### 💸 Expenses ${period.label}\n\n• **Total**: **${money(e.total)}** in ${plural(e.count, "entry")}\n\n` +
          (e.categories.length ? `#### By category\n${e.categories.map((c) => `• ${c.category}: ${money(c.total)}`).join("\n")}` : "No expenses recorded for this period.") +
          `\n\nAdd one by typing e.g. "add expense 1500 for electricity".`,
        stats: [{ label: "Expenses", value: short(e.total), color: "text-amber-600" }, { label: "Entries", value: `${e.count}`, color: "text-blue-600" }],
      };
    }

    case "profit": {
      const period = defaultPeriod(cls, now);
      const p = A.profitSummary(invoices, data.expenses, period);
      const prev = A.profitSummary(invoices, data.expenses, previousPeriod(period));
      return {
        topic: { ...topic, period },
        text:
          `### 📊 Profit ${period.label}\n\n` +
          `• **Sales (with GST)**: ${money(p.sales)}\n` +
          `• **Less GST collected**: −${money(p.gst)}\n` +
          `• **Less expenses**: −${money(p.expenses)}\n` +
          `• **Profit**: **${money(p.profit)}**${p.netSales ? ` (${((p.profit / p.netSales) * 100).toFixed(1)}% of sales)` : ""}\n` +
          `• **Period before**: ${money(prev.profit)}\n\n` +
          `Based on billed sales and recorded expenses; the cost of goods you bought is only included if you record it as an expense.`,
        stats: [
          { label: "Profit", value: short(p.profit), color: p.profit >= 0 ? "text-emerald-600" : "text-rose-600" },
          { label: "Sales", value: short(p.sales), color: "text-blue-600" },
          { label: "Expenses", value: short(p.expenses), color: "text-amber-600" },
        ],
      };
    }

    case "stock": {
      const r = A.stockReport(data.products, data.stock, invoices, now);
      if (!r.rows.length) {
        return { topic, text: `### 📦 Stock\n\nNo stock records yet. Stock is tracked when goods are received through the POS / warehouse app.${r.untracked.length ? `\n\n${plural(r.untracked.length, "product")} have no stock records.` : ""}` };
      }
      const list = (r.low.length ? r.low : r.rows.slice(0, 8)).map((row) => `• **${row.product.name}**: ${row.qty}${row.product.unit ? ` ${row.product.unit}` : ""}${row.daysLeft !== null ? ` · lasts ~${plural(row.daysLeft, "day")} at the current selling rate` : ""}`);
      return {
        topic,
        text:
          `### 📦 Stock\n\n` +
          (r.low.length ? `⚠️ **${plural(r.low.length, "product")}** out of stock:\n\n` : `✅ Nothing is out of stock. Lowest stock:\n\n`) +
          list.join("\n") +
          (r.untracked.length ? `\n\n${plural(r.untracked.length, "product")} have no stock records.` : ""),
        stats: [{ label: "Out of stock", value: `${r.low.length}`, color: r.low.length ? "text-rose-600" : "text-emerald-600" }, { label: "Tracked", value: `${r.rows.length}`, color: "text-blue-600" }],
      };
    }

    case "invoice_lookup": {
      const found = A.findInvoicesByNumber(invoices, cls.invoiceRef);
      if (!found.length) return { topic, text: `I could not find invoice **${cls.invoiceRef}**.` };
      const inv = found[0];
      return {
        topic,
        text:
          `### 🧾 Invoice ${invoiceLabel(inv)}\n\n` +
          `• **Customer**: ${A.customerNameOf(inv)}\n` +
          `• **Date**: ${formatDate(A.invoiceDate(inv))} · **Due**: ${formatDate(toDate(inv.dueDate))}\n` +
          `• **Amount**: **${money(A.invoiceTotal(inv))}** · **Paid**: ${money(A.settledAmount(inv))} · **Due**: ${money(A.invoiceBalance(inv))}\n` +
          `• **Status**: ${A.invoiceStatus(inv, now)}\n` +
          ((inv.items || []).length ? `\n#### Items\n${inv.items.map((it) => `• ${it.description || it.name} × ${it.quantity} @ ${money(it.rate)} = ${money(it.amount)}`).join("\n")}` : "") +
          (found.length > 1 ? `\n\n${found.length - 1} other invoice(s) share this number from other years.` : "") +
          (A.invoiceBalance(inv) ? `\n\nTo settle it, type "mark invoice ${inv.invoiceNumber} as paid".` : ""),
        buttons: [{ label: "Open Invoices", to: "/invoices" }],
      };
    }

    case "recent_invoices": {
      const list = A.salesInvoices(invoices).sort((a, b) => (A.invoiceDate(b) || 0) - (A.invoiceDate(a) || 0)).slice(0, cls.limit || 5);
      if (!list.length) return { topic, text: "No invoices yet." };
      return { topic, text: `### 🧾 Recent invoices\n\n${list.map((inv) => `• ${invoiceLabel(inv)} · ${formatDate(A.invoiceDate(inv))} · ${A.customerNameOf(inv)} · ${money(A.invoiceTotal(inv))} · ${A.invoiceStatus(inv, now)}`).join("\n")}` };
    }

    // ---- actions: build a preview, save only on confirm ----------------------
    case "record_payment":
      return paymentPreview(cls, data);

    case "mark_paid": {
      const found = A.findInvoicesByNumber(invoices, cls.invoiceRef).filter((inv) => !A.isDraft(inv));
      if (!found.length) return { text: `I could not find invoice **${cls.invoiceRef}**.` };
      const inv = found[0];
      const balance = A.invoiceBalance(inv);
      if (!balance) return { text: `Invoice ${invoiceLabel(inv)} is already fully paid.` };
      return card({ kind: "payment", customerId: A.customerIdOf(inv), customerName: A.customerNameOf(inv), mode: cls.mode || "Cash", amount: balance, lines: [{ invoice: inv, amount: balance, clears: true }], unapplied: 0 }, data);
    }

    case "add_customer": {
      const f = cls.fields;
      if (!f.name) return { text: 'Tell me the customer\'s name, e.g. "add customer Ravi Traders phone 9876543210".' };
      const name = titleCase(f.name);
      const city = f.city ? titleCase(f.city) : "";
      return card({
        kind: "customer",
        payload: {
          name, displayName: name, companyName: name, customerType: f.gstin ? "Business" : "Individual",
          phone: f.phone, mobile: f.phone, email: f.email, gstin: f.gstin, taxId: f.gstin, city,
          address: [f.address, city].filter(Boolean).join(", "), customerLanguage: "English",
        },
      }, data);
    }

    case "add_product": {
      const f = cls.fields;
      if (!f.name) return { text: 'Tell me the product name and price, e.g. "add product Cement price 400 unit bag hsn 2523".' };
      if (!(f.price > 0)) return { text: `What is the selling price of **${titleCase(f.name)}**? e.g. "add product ${titleCase(f.name)} price 250".` };
      return card({ kind: "product", payload: { name: titleCase(f.name), price: f.price, unit: f.unit, hsn: f.hsn, purchasePrice: f.purchasePrice || "", description: "", sku: "", brand: "", category: "", imageUrl: "" } }, data);
    }

    case "add_expense": {
      const f = cls.fields;
      if (!(f.amount > 0)) return { text: 'How much was it? e.g. "add expense 1500 for electricity".' };
      const date = cls.period?.label === "yesterday" ? cls.period.start : now;
      return card({
        kind: "expense",
        payload: {
          title: titleCase(f.title), category: f.category, amount: f.amount, currency: "INR",
          expenseDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          notes: f.mode ? `Paid by ${f.mode} (added from chat)` : "Added from chat", invoiceNumber: "", customerId: "", customerName: "", itemized: false,
        },
      }, data);
    }

    case "update_customer": {
      if (!cls.customer) return clarifyCustomer(cls, data);
      const edit = applyEdit({ kind: "customer_update", patch: {} }, cls.fieldText || cls.raw, data, now);
      if (edit?.error) return { text: edit.error };
      const patch = edit?.pending?.patch || {};
      if (!Object.keys(patch).length) return { text: `What should I change for **${A.customerDisplayName(cls.customer)}**? e.g. "update phone of ${A.customerDisplayName(cls.customer)} to 9876543210".` };
      return card({ kind: "customer_update", id: cls.customer.id, name: A.customerDisplayName(cls.customer), before: cls.customer, patch }, data);
    }

    case "update_product": {
      if (!cls.product) return { text: 'Which product? e.g. "change price of cement to 450".' };
      const edit = applyEdit({ kind: "product_update", patch: {} }, cls.fieldText || cls.raw, data, now);
      if (edit?.error) return { text: edit.error };
      const patch = edit?.pending?.patch || {};
      if (!Object.keys(patch).length) return { text: `What should I change for **${cls.product.name}**? e.g. "change price of ${cls.product.name} to 450".` };
      return card({ kind: "product_update", id: cls.product.id, name: cls.product.name, before: cls.product, patch }, data);
    }

    case "deactivate_product":
      if (!cls.product) return { text: 'Which product? e.g. "deactivate product cement".' };
      if (cls.product.isActive === false) return { text: `**${cls.product.name}** is already inactive.` };
      return card({ kind: "product_deactivate", id: cls.product.id, name: cls.product.name }, data);

    case "summary":
      return summary(data, now);

    default:
      return unknown(cls, data);
  }
}

function clarifyCustomer(cls, data) {
  const options = rankEntities(cls.raw, data.customers, A.customerDisplayName, 4);
  if (options.length) return { text: `Which customer do you mean? ${options.map((o) => `**${A.customerDisplayName(o.item)}**`).join(", ")}` };
  return { text: "I could not find that customer. Check the spelling, or say \"add customer <name>\" to add them." };
}

function paymentPreview(cls, data) {
  if (!cls.customer) {
    const options = rankEntities(cls.raw, data.customers, A.customerDisplayName, 4);
    return {
      text: options.length
        ? `Which customer paid? ${options.map((o) => `**${A.customerDisplayName(o.item)}**`).join(", ")}. Type it again with the full name.`
        : "I could not find that customer. Type the name as it appears in your customer list, e.g. \"Ravi Traders paid 5000 by UPI\".",
    };
  }
  const name = A.customerDisplayName(cls.customer);
  const mine = (data.invoices || []).filter((inv) => A.customerIdOf(inv) === cls.customer.id);
  const plan = A.allocatePayment(mine, cls.amount);
  if (!plan.openCount) return { text: `**${name}** has no unpaid invoices, so there is nothing to apply ${money(cls.amount)} to.` };
  return card({ kind: "payment", customerId: cls.customer.id, customerName: name, mode: cls.mode, amount: cls.amount - plan.unapplied, lines: plan.lines, unapplied: plan.unapplied }, data);
}

// A preview card: the text is drawn from the pending data (see cards.js).
function card(pending, data) {
  return { text: renderPending(pending, data), pending };
}

function summary(data, now) {
  const fy = financialYear(now);
  const period = { start: fy.start, end: fy.end, label: fy.label };
  const today = { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) };
  const t = A.salesSummary(data.invoices, today);
  const s = A.salesSummary(data.invoices, period);
  const p = A.profitSummary(data.invoices, data.expenses, period);
  const due = A.receivables(data.invoices, now);
  const overdue = A.overdueInvoices(data.invoices, now);
  const top = A.productSales(data.invoices, period)[0];
  return {
    topic: { intent: "summary" },
    text:
      `### 🤖 ${data.companyName || "Business"} summary (${fy.label})\n\n` +
      `• **Today**: ${money(t.billed)} in ${plural(t.count, "invoice")}\n` +
      `• **This year**: ${money(s.billed)} billed · ${money(s.collected)} collected\n` +
      `• **Owed to you**: ${money(due.reduce((x, r) => x + r.balance, 0))} by ${plural(due.length, "customer")}${overdue.length ? ` (${plural(overdue.length, "invoice")} overdue)` : ""}\n` +
      `• **Profit**: ${money(p.profit)} after GST and expenses\n` +
      (top ? `• **Best seller**: ${top.name} (${money(top.revenue)})\n` : "") +
      `\nAsk me anything, or say **help**.`,
    stats: [
      { label: "Today", value: short(t.billed), color: "text-emerald-600" },
      { label: "This FY", value: short(s.billed), color: "text-blue-600" },
      { label: "Profit", value: short(p.profit), color: "text-indigo-600" },
      { label: "Owed", value: short(due.reduce((x, r) => x + r.balance, 0)), color: "text-rose-600" },
    ],
  };
}

function unknown(cls) {
  return {
    text:
      `I'm not sure what you mean by "${cls.raw}".\n\nTry one of these:\n` +
      `• sales this month\n• who owes me money?\n• create invoice for <customer>, 2 <product>\n• <customer> paid 5000 by UPI\n\nSay **help** for the full list.`,
  };
}

export const pagePath = (label) => PAGES.find((p) => p.label === label)?.path;
