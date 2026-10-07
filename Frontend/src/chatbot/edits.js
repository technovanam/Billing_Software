// Follow-up edits to a preview card before it is saved: "phone 98765 43210",
// "price 450", "make it 2000", "category rent", "by cash". Also the words
// that confirm or cancel a card. Pure functions; tested in chatbot.test.js.
import { normalize, extractAmounts, titleCase } from "./text.js";
import { GSTIN_PATTERN, checkGstin } from "./gstin.js";
import { expenseCategoryIn, paymentModeIn } from "./intents.js";
import { parsePeriod, localISO } from "./dates.js";
import { allocatePayment, customerIdOf } from "./analytics.js";

export const isConfirmWord = (text) =>
  /^(yes|yeah|yep|ok|okay|confirm|confirmed|save|save it|do it|go ahead|create|create it|done|correct|haan|ha|aama|sari|seri)( please| it| now)?[.!]*$/.test(normalize(text));
export const isCancelWord = (text) =>
  /^(no|nope|cancel|cancel it|stop|discard|leave it|forget it|dont|vendam|nahi|mat karo)( please| it)?[.!]*$/.test(normalize(text));

const UNITS = { kg: "kg", kgs: "kg", kilo: "kg", gram: "gram", grams: "gram", g: "gram", litre: "litre", liter: "litre", ltr: "litre", l: "litre", ml: "ml", piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", nos: "piece", box: "box", bag: "bag", bags: "bag", packet: "packet", pack: "packet", metre: "metre", meter: "metre", m: "metre", dozen: "dozen", hour: "hour", hours: "hour", set: "set", pair: "pair" };

const after = (text, labels, pattern) => {
  const m = String(text).match(new RegExp(`\\b(?:${labels})\\b\\s*(?:is|to|as|=|:|-)?\\s*(${pattern})`, "i"));
  return m ? m[1].trim() : null;
};
const firstAmount = (text) => extractAmounts(text).find((a) => a.value > 0)?.value ?? null;
const rename = (text) => after(text, "change (?:the )?name|rename(?: it)?|name|call it|named", "[^,;]+");

// ---- per-kind field readers ---------------------------------------------------

function customerChanges(text) {
  const out = {};
  const phone = (String(text).match(/(?:\+91[\s-]?)?\b([6-9]\d{4}[\s-]?\d{5})\b/) || [])[1];
  if (phone) out.phone = phone.replace(/[\s-]/g, "");
  const email = (String(text).match(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/) || [])[0];
  if (email) out.email = email;
  const gstin = (String(text).match(GSTIN_PATTERN) || [])[1];
  if (gstin) out.gstin = gstin.toUpperCase();
  const city = after(text, "city|town|location", "[A-Za-z][A-Za-z ]{1,30}");
  if (city) out.city = titleCase(city);
  const address = after(text, "address", ".+");
  if (address) out.address = address;
  const name = rename(text);
  if (name && !/^\d/.test(name)) out.name = titleCase(name);
  return out;
}

function productChanges(text) {
  const out = {};
  const purchase = after(text, "purchase price|cost price|buying price|purchase", "(?:₹|rs\\.?\\s*)?\\d[\\d,]*(?:\\.\\d+)?");
  if (purchase) out.purchasePrice = firstAmount(purchase);
  const withoutPurchase = String(text).replace(/\b(purchase price|cost price|buying price|purchase)\b.*?\d[\d,.]*/i, "");
  const price = after(withoutPurchase, "price|rate|mrp|selling price|make it|change it to|set it to", "(?:₹|rs\\.?\\s*)?\\d[\\d,]*(?:\\.\\d+)?");
  if (price) out.price = firstAmount(price);
  else if (/^\s*(₹|rs\.?)?\s*\d[\d,]*(\.\d+)?\s*(rs|rupees)?\s*$/i.test(withoutPurchase) && !out.purchasePrice) out.price = firstAmount(withoutPurchase);
  const hsn = after(text, "hsn|hsn code|sac", "\\d{4,8}");
  if (hsn) out.hsn = hsn;
  const unitWord = after(text, "unit|per|sold per|sold in", "[a-zA-Z]+") || (normalize(text).match(/^(?:in |as )?([a-z]+)$/) || [])[1];
  if (unitWord && UNITS[unitWord.toLowerCase()]) out.unit = UNITS[unitWord.toLowerCase()];
  const category = after(text, "category", "[A-Za-z][A-Za-z &]{1,30}");
  if (category) out.category = titleCase(category);
  const brand = after(text, "brand", "[A-Za-z0-9][A-Za-z0-9 &]{0,30}");
  if (brand) out.brand = titleCase(brand);
  const name = rename(text);
  if (name && !/^\d/.test(name)) out.name = titleCase(name);
  return out;
}

function expenseChanges(text, now) {
  const out = {};
  const amt = after(text, "amount|make it|change it to|it was|it is|cost", "(?:₹|rs\\.?\\s*)?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*k)?") ||
    (/^\s*(₹|rs\.?)?\s*\d[\d,]*(\.\d+)?\s*(k|rs|rupees)?\s*$/i.test(text) ? text : null);
  if (amt) out.amount = firstAmount(amt);
  const cat = expenseCategoryIn(text);
  if (cat && (/\bcategory\b/i.test(text) || !out.amount)) out.category = cat;
  const period = parsePeriod(text, now);
  if (period && ["today", "yesterday"].includes(period.label)) out.expenseDate = localISO(period.start);
  const dateM = String(text).match(/\b(?:date|on)\s+(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/i);
  if (dateM) out.expenseDate = `${dateM[3]}-${dateM[2].padStart(2, "0")}-${dateM[1].padStart(2, "0")}`;
  const mode = paymentModeIn(text);
  if (mode && /\b(by|via|through|paid|using|mode)\b/i.test(text)) out.mode = mode;
  const title = after(text, "for|title|note|description", "[A-Za-z][^,;]{1,40}");
  if (title) out.title = titleCase(title);
  return out;
}

function paymentChanges(text) {
  const out = {};
  const amt = after(text, "amount|make it|change it to|it was|it is|paid|only", "(?:₹|rs\\.?\\s*)?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*k)?") ||
    (/^\s*(₹|rs\.?)?\s*\d[\d,]*(\.\d+)?\s*(k|rs|rupees)?\s*$/i.test(text) ? text : null);
  if (amt) out.amount = firstAmount(amt);
  const mode = paymentModeIn(text);
  if (mode) out.mode = mode;
  return out;
}

const LABELS = {
  name: "Name", phone: "Phone", email: "Email", gstin: "GSTIN", city: "City", address: "Address",
  price: "Price", purchasePrice: "Purchase price", hsn: "HSN", unit: "Unit", category: "Category", brand: "Brand",
  amount: "Amount", expenseDate: "Date", mode: "Paid by", title: "For",
};
const describe = (changes) => Object.entries(changes).map(([k, v]) => `${LABELS[k] || k} → ${v}`).join(", ");

/**
 * Applies a follow-up message to a pending card.
 * @returns {{ pending, changed: string } | { error: string } | null}  null = not an edit for this card
 */
export function applyEdit(pending, text, data = {}, now = new Date()) {
  if (!pending) return null;
  switch (pending.kind) {
    case "customer":
    case "customer_update": {
      const c = customerChanges(text);
      if (!Object.keys(c).length) return null;
      if (c.gstin && !checkGstin(c.gstin).valid) return { error: `That GSTIN looks wrong: ${checkGstin(c.gstin).problems.join("; ")}.` };
      const field = pending.kind === "customer" ? "payload" : "patch";
      const next = { ...pending[field] };
      if (c.name) Object.assign(next, { name: c.name, displayName: c.name, companyName: c.name });
      if (c.phone) Object.assign(next, { phone: c.phone, mobile: c.phone });
      if (c.email) next.email = c.email;
      if (c.gstin) Object.assign(next, { gstin: c.gstin, taxId: c.gstin, customerType: "Business" });
      if (c.city || c.address) next.address = [c.address || (pending[field].address || "").split(", ").filter((x) => x !== pending[field].city)[0], c.city].filter(Boolean).join(", ");
      if (c.city) next.city = c.city;
      return { pending: { ...pending, [field]: next }, changed: describe(c) };
    }
    case "product":
    case "product_update": {
      const c = productChanges(text);
      if (!Object.keys(c).length) return null;
      if (c.price !== undefined && !(c.price > 0)) return { error: "The price must be more than zero." };
      const field = pending.kind === "product" ? "payload" : "patch";
      return { pending: { ...pending, [field]: { ...pending[field], ...c } }, changed: describe(c) };
    }
    case "expense": {
      const c = expenseChanges(text, now);
      if (!Object.keys(c).length) return null;
      const payload = { ...pending.payload };
      if (c.amount) payload.amount = c.amount;
      if (c.category) payload.category = c.category;
      if (c.expenseDate) payload.expenseDate = c.expenseDate;
      if (c.title) payload.title = c.title;
      if (c.mode) payload.notes = `Paid by ${c.mode} (added from chat)`;
      return { pending: { ...pending, payload }, changed: describe(c) };
    }
    case "payment": {
      const c = paymentChanges(text);
      if (!Object.keys(c).length) return null;
      let next = { ...pending, mode: c.mode || pending.mode };
      if (c.amount) {
        const invoices = pending.customerId
          ? (data.invoices || []).filter((inv) => customerIdOf(inv) === pending.customerId)
          : pending.lines.map((l) => l.invoice);
        const plan = allocatePayment(invoices, c.amount);
        if (!plan.lines.length) return { error: "There is nothing left to pay on these invoices." };
        next = { ...next, amount: c.amount - plan.unapplied, lines: plan.lines, unapplied: plan.unapplied };
      }
      return { pending: next, changed: describe(c) };
    }
    default:
      return null;
  }
}
