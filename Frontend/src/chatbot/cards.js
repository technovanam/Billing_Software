// Text of a preview card, drawn from its pending data. Used for the first
// preview and again after every follow-up edit, so the card always shows
// exactly what will be saved.
import * as A from "./analytics.js";
import { formatDate, toDate } from "./dates.js";
import { checkGstin } from "./gstin.js";
import { similarity } from "./text.js";

const money = (v) => {
  const n = A.num(v);
  return `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const FIELD_NAMES = {
  name: "Name", phone: "Phone", email: "Email", gstin: "GSTIN", city: "City", address: "Address",
  price: "Price", purchasePrice: "Purchase price", hsn: "HSN", unit: "Unit", category: "Category", brand: "Brand",
};
const fieldName = (k) => FIELD_NAMES[k] || k;
const line = (label, value) => (value === undefined || value === null || value === "" ? "" : `• **${label}**: ${value}\n`);
const EDIT_HINT = {
  customer: 'Change anything first, e.g. "phone 98765 43210", "gstin …", "city Chennai", "change name to …". Say "yes" to save.',
  product: 'Change anything first, e.g. "price 450", "unit kg", "hsn 2523", "purchase price 300". Say "yes" to save.',
  expense: 'Change anything first, e.g. "make it 2000", "category rent", "yesterday", "paid by upi". Say "yes" to save.',
  payment: 'Change anything first, e.g. "make it 3000", "by cash". Say "yes" to save.',
};

export function renderPending(p, data = {}) {
  switch (p.kind) {
    case "customer": {
      const c = p.payload;
      const dup = (data.customers || []).find((x) => similarity(A.customerDisplayName(x), c.name) > 0.85);
      const gst = c.gstin ? checkGstin(c.gstin) : null;
      return (
        `### 👤 Add customer\n\n` +
        line("Name", c.name) + line("Phone", c.phone) + line("Email", c.email) +
        line("GSTIN", c.gstin ? `\`${c.gstin}\`${gst && !gst.valid ? ` ⚠️ ${gst.problems.join("; ")}` : ""}` : "") +
        line("Address", c.address) +
        (dup ? `\n⚠️ You already have **${A.customerDisplayName(dup)}**. Save anyway?\n` : "") +
        `\n${EDIT_HINT.customer}`
      );
    }
    case "customer_update": {
      const before = p.before || {};
      const rows = Object.entries(p.patch)
        .filter(([k]) => !["displayName", "companyName", "mobile", "taxId", "customerType"].includes(k))
        .map(([k, v]) => `• **${fieldName(k)}**: ${before[k] ? `${before[k]} → ` : ""}${v}`);
      return `### ✏️ Update customer ${p.name}\n\n${rows.join("\n") || "• (no changes yet)"}\n\n${EDIT_HINT.customer}`;
    }
    case "product": {
      const pr = p.payload;
      const dup = (data.products || []).find((x) => similarity(x.name, pr.name) > 0.85);
      return (
        `### 📦 Add product\n\n` +
        line("Name", pr.name) + line("Price", `${money(pr.price)}${pr.unit ? ` per ${pr.unit}` : ""}`) +
        line("Purchase price", pr.purchasePrice ? money(pr.purchasePrice) : "") + line("HSN", pr.hsn) +
        line("Category", pr.category) + line("Brand", pr.brand) +
        (dup ? `\n⚠️ You already have **${dup.name}** (${money(dup.price)}). Save anyway?\n` : "") +
        `\n${EDIT_HINT.product}`
      );
    }
    case "product_update": {
      const before = p.before || {};
      const show = (k, v) => (["price", "purchasePrice"].includes(k) ? money(v) : v);
      const rows = Object.entries(p.patch).map(([k, v]) => `• **${fieldName(k)}**: ${before[k] !== undefined && before[k] !== "" ? `${show(k, before[k])} → ` : ""}${show(k, v)}`);
      return `### ✏️ Update product ${p.name}\n\n${rows.join("\n") || "• (no changes yet)"}\n\n${EDIT_HINT.product}`;
    }
    case "product_deactivate":
      return `### 🗄️ Deactivate ${p.name}?\n\nIt will be hidden from new bills. Old bills keep it, and you can reactivate it from the Products page.`;
    case "expense": {
      const e = p.payload;
      return (
        `### 💸 Add expense\n\n` +
        line("Amount", money(e.amount)) + line("Category", e.category) + line("For", e.title) +
        line("Date", formatDate(toDate(e.expenseDate))) +
        line("Paid by", (String(e.notes).match(/^Paid by (\S+( \S+)?) \(/) || [])[1]) +
        `\n${EDIT_HINT.expense}`
      );
    }
    case "payment":
      return (
        `### 💵 Record payment from ${p.customerName}\n\n**${money(p.amount)}** by **${p.mode}**, applied oldest bill first:\n\n` +
        p.lines
          .map((l) => `• #${l.invoice.invoiceNumber} (${formatDate(A.invoiceDate(l.invoice))}): ${money(l.amount)}${l.clears ? " → fully paid" : ` → ${money(A.invoiceBalance(l.invoice) - l.amount)} left`}`)
          .join("\n") +
        (p.unapplied ? `\n\n⚠️ ${money(p.unapplied)} is more than ${p.customerName} owes and will not be recorded.` : "") +
        `\n\n${EDIT_HINT.payment}`
      );
    default:
      return "";
  }
}
