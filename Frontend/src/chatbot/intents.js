// Works out what a chat message is asking for, and pulls out the customer,
// product, period, amount and other details. Rule-based and offline: the
// "knowledge" is this business's own customer and product lists.
import { normalize, findEntityInText, extractAmounts, hasAny } from "./text.js";
import { parsePeriod } from "./dates.js";
import { GSTIN_PATTERN } from "./gstin.js";
import { customerDisplayName } from "./analytics.js";

export const PAGES = [
  { path: "/invoices/create", label: "Create Invoice", words: ["new invoice", "create invoice", "invoice form", "billing page"] },
  { path: "/recurring-invoices", label: "Recurring Invoices", words: ["recurring", "recurring invoices", "subscriptions"] },
  { path: "/challans", label: "Delivery Challans", words: ["challan", "challans", "delivery challan", "delivery challans", "dc"] },
  { path: "/fy-archives", label: "FY Archives", words: ["archive", "archives", "old invoices", "previous year invoices"] },
  { path: "/invoices", label: "Invoices", words: ["invoices", "invoice list", "bills"] },
  { path: "/clients", label: "Customers", words: ["customers", "clients", "customer list", "parties"] },
  { path: "/products", label: "Products", words: ["products", "items", "catalogue", "catalog", "product list"] },
  { path: "/payments", label: "Payments", words: ["payments", "payment page", "collections"] },
  { path: "/expenses", label: "Expenses", words: ["expenses", "expense page"] },
  { path: "/reports", label: "Reports", words: ["reports", "report", "charts", "analytics"] },
  { path: "/settings", label: "Settings", words: ["settings", "profile", "company profile"] },
  { path: "/dashboard", label: "Dashboard", words: ["dashboard", "home"] },
];

export const PAYMENT_MODES = [
  ["UPI", ["upi", "gpay", "google pay", "phonepe", "phone pe", "paytm", "bhim"]],
  ["Cash", ["cash", "rokda", "kaasu"]],
  ["Card", ["card", "credit card", "debit card", "swipe"]],
  ["Bank Transfer", ["bank", "neft", "rtgs", "imps", "transfer", "bank transfer", "account transfer"]],
  ["Cheque", ["cheque", "check", "chq"]],
];

export const EXPENSE_CATEGORIES = [
  ["Rent Expense", ["rent", "lease", "vaadagai"]],
  ["Salaries and Employee Wages", ["salary", "salaries", "wages", "wage", "staff pay", "sambalam"]],
  ["Utilities", ["electricity", "eb bill", "current bill", "power", "water", "gas", "utility", "utilities"]],
  ["Telephone Expense", ["phone bill", "mobile bill", "recharge", "telephone"]],
  ["IT and Internet Expenses", ["internet", "wifi", "broadband", "hosting", "domain"]],
  ["Automobile Expense", ["petrol", "diesel", "fuel", "vehicle", "bike", "car service"]],
  ["Travel Expense", ["travel", "taxi", "cab", "auto", "bus", "train", "flight", "uber", "ola"]],
  ["Printing and Stationery", ["stationery", "printing", "print", "paper", "pens"]],
  ["Postage & Delivery", ["courier", "postage", "delivery charge", "shipping", "parcel"]],
  ["Repairs and Maintenance", ["repair", "repairs", "maintenance", "service charge", "plumber", "electrician"]],
  ["Advertising & Marketing", ["ads", "advertising", "marketing", "promotion", "banner", "flex"]],
  ["Software", ["software", "subscription", "app"]],
  ["Office Supplies", ["office supplies", "supplies", "cleaning"]],
  ["Bank Fees and Charges", ["bank charges", "bank fee", "bank fees", "charges"]],
  ["Consultant Expense", ["consultant", "auditor", "ca fees", "lawyer", "legal"]],
  ["General & Administrative Expenses", ["tea", "coffee", "snacks", "food", "lunch", "refreshment", "general", "misc", "miscellaneous"]],
];

const QUESTION_START = /^(how|what|whats|when|which|who|did|does|has|have|is|are|show|list|tell|give me|get)\b/;

export function isBillCommand(text) {
  const q = String(text || "").toLowerCase();
  return (
    /\b(create|make|generate|raise|prepare|new)\b[\w\s]{0,20}\b(invoice|bill|challan|dc)\b\s+\S/.test(q) ||
    /\b(invoice|bill|challan|dc)\s+(for|to)\s+\S/.test(q) ||
    /\s(ku|ki|ko|ke liye)\s+\d/.test(q)
  );
}

export const paymentModeIn = (text) => (PAYMENT_MODES.find(([, words]) => hasAny(text, words)) || [null])[0];
export const expenseCategoryIn = (text) => (EXPENSE_CATEGORIES.find(([, words]) => hasAny(text, words)) || [null])[0];

function pageIn(text) {
  const q = normalize(text);
  if (!/^(open|go to|goto|take me to|navigate to|show page|switch to)\b/.test(q)) return null;
  const rest = q.replace(/^(open|go to|goto|take me to|navigate to|show page|switch to)\s+(the\s+)?/, "").replace(/\s+page$/, "");
  return PAGES.find((p) => p.words.some((w) => rest === w || rest.startsWith(`${w} `) || rest.endsWith(` ${w}`))) || null;
}

// Value after a label: "phone 98765 43210", "gstin: 33ABC...", "price 400".
function valueAfter(text, labels, pattern) {
  const re = new RegExp(`\\b(?:${labels.join("|")})\\b\\s*(?:is|:|=|-)?\\s*(${pattern})`, "i");
  const m = String(text).match(re);
  return m ? m[1].trim() : null;
}

const FIELD_WORDS = ["phone", "mobile", "ph", "contact", "number", "email", "mail", "gst", "gstin", "address", "city", "price", "rate", "mrp", "at", "hsn", "unit", "per", "cost", "purchase", "category", "brand", "sku", "barcode", "with"];

// The name in "add customer Ravi Traders phone 98...": words up to the first field label.
function nameAfter(text, leadRe) {
  const rest = String(text).replace(leadRe, "").trim();
  const words = rest.split(/\s+/);
  const out = [];
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FIELD_WORDS.includes(clean) || /^[₹]/.test(w) || /^\d{6,}$/.test(clean) || /^[,;]$/.test(w)) break;
    out.push(w.replace(/[,;:]$/, ""));
    if (/[,;]$/.test(w)) break;
  }
  return out.join(" ").replace(/^(named|called|name)\s+/i, "").trim();
}

function parseCustomerFields(text) {
  const phone = (String(text).match(/(?:\+91[\s-]?)?\b([6-9]\d{4}[\s-]?\d{5})\b/) || [])[1];
  const email = (String(text).match(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/) || [])[0];
  const gstin = (String(text).match(GSTIN_PATTERN) || [])[1];
  const city = valueAfter(text, ["city", "from city", "location"], "[A-Za-z][A-Za-z ]{1,30}?(?=\\s+(?:phone|mobile|email|gst|gstin|address)\\b|$|,)");
  const address = valueAfter(text, ["address"], "[^,;]+(?:,[^,;]+)*?(?=\\s+(?:phone|mobile|email|gst|gstin|city)\\b|$)");
  return {
    name: nameAfter(text, /^.*?\b(customer|client|party)\b\s*/i),
    phone: phone ? phone.replace(/[\s-]/g, "") : "",
    email: email || "",
    gstin: gstin ? gstin.toUpperCase() : "",
    city: city || "",
    address: address || "",
  };
}

const UNIT_WORDS = { kg: "kg", kgs: "kg", kilo: "kg", gram: "gram", grams: "gram", g: "gram", litre: "litre", liter: "litre", ltr: "litre", l: "litre", ml: "ml", piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", nos: "piece", box: "box", bag: "bag", bags: "bag", packet: "packet", pack: "packet", metre: "metre", meter: "metre", m: "metre", dozen: "dozen", hour: "hour", hours: "hour", set: "set", pair: "pair" };

function parseProductFields(text) {
  const price = valueAfter(text, ["price", "rate", "mrp", "at", "selling price", "cost", "for"], "(?:₹|rs\\.?\\s*)?\\d[\\d,]*(?:\\.\\d+)?");
  const purchase = valueAfter(text, ["purchase price", "buying price", "cost price"], "(?:₹|rs\\.?\\s*)?\\d[\\d,]*(?:\\.\\d+)?");
  const rupee = (String(text).match(/₹\s*(\d[\d,]*(?:\.\d+)?)/) || [])[1];
  const hsn = valueAfter(text, ["hsn", "hsn code", "sac"], "\\d{4,8}");
  const unitWord = valueAfter(text, ["unit", "per", "\\/"], "[a-zA-Z]+");
  const toNum = (s) => (s ? Number(String(s).replace(/[₹rs.\s,]/gi, (c) => (c === "." ? "." : ""))) : null);
  return {
    name: nameAfter(text, /^.*?\b(product|item)\b\s*/i),
    price: toNum(price) ?? toNum(rupee),
    purchasePrice: toNum(purchase) || "",
    hsn: hsn || "",
    unit: UNIT_WORDS[String(unitWord || "").toLowerCase()] || "",
  };
}

function parseExpenseFields(text) {
  const amounts = extractAmounts(text).filter((a) => a.value > 0);
  const category = expenseCategoryIn(text) || "Other Expenses";
  const title = String(text)
    .replace(/^.*?\b(expense|expenses|spent|spend|paid|kharcha|selavu)\b\s*(of|for|on)?/i, "")
    .replace(/(?:₹|rs\.?\s*|inr\s*)?\d[\d,]*(?:\.\d+)?\s*(k|thousand|lakh)?/gi, "")
    .replace(/\b(rupees|rs|inr|for|on|of|to|by|via|in|cash|upi|today|yesterday)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { amount: amounts[0]?.value ?? null, category, title: title || category, mode: paymentModeIn(text) };
}

function findCustomer(text, customers) {
  return findEntityInText(text, customers, customerDisplayName);
}

function findProduct(text, products) {
  return findEntityInText(text, (products || []).filter((p) => p.isActive !== false), (p) => p.name);
}

/**
 * @param {string} text
 * @param {{ customers?: any[], products?: any[], last?: { intent, period, customer, product }, now?: Date }} ctx
 * @returns {{ intent: string, period, customer, product, ... }}
 */
export function classify(text, ctx = {}) {
  const raw = String(text || "").trim();
  const q = normalize(raw);
  const base = { intent: "unknown", raw, period: parsePeriod(raw, ctx.now), customer: null, product: null };
  if (!q) return { ...base, intent: "empty" };

  const customerHit = findCustomer(raw, ctx.customers);
  const productHit = findProduct(raw, ctx.products);
  // When both match the same words, keep the better one.
  const customer = customerHit && (!productHit || customerHit.score >= productHit.score || customerHit.matched !== productHit.matched) ? customerHit.item : null;
  const product = productHit && (!customerHit || productHit.score > customerHit.score || customerHit.matched !== productHit.matched) ? productHit.item : null;
  const withEntities = { ...base, customer, product };
  const isQuestion = QUESTION_START.test(q) || raw.endsWith("?");
  const amounts = extractAmounts(raw).filter((a) => a.value > 0);

  // --- conversation -------------------------------------------------------
  if (/^(hi|hello|hey|hii+|vanakkam|namaste|namaskar|good (morning|afternoon|evening))\b/.test(q) && q.split(" ").length <= 4) return { ...base, intent: "greeting" };
  if (/^(thanks|thank you|thx|ok thanks|nandri|dhanyavad|super|great|cool)\b/.test(q) && q.split(" ").length <= 4) return { ...base, intent: "thanks" };
  if (/\b(help|what can you do|what all can you do|commands|how to use|features|capabilities)\b/.test(q) && q.split(" ").length <= 8) return { ...base, intent: "help" };

  // --- GSTIN --------------------------------------------------------------
  const gstinInText = raw.match(GSTIN_PATTERN);
  const looseGstin = /\b(gstin|gst no|gst number|validate gst|verify gst|check gst)\b/.test(q) ? raw.match(/\b([0-9A-Z]{13,17})\b/i) : null;
  if ((gstinInText || looseGstin) && !/^(add|create|new)\b/.test(q)) return { ...base, intent: "gstin_check", gstin: (gstinInText || looseGstin)[1] };

  // --- navigation ---------------------------------------------------------
  const page = pageIn(raw);
  if (page && !isBillCommand(raw)) return { ...base, intent: "navigate", page };

  // --- actions ------------------------------------------------------------
  if (isBillCommand(raw)) return { ...withEntities, intent: /\b(challan|challans|dc)\b/i.test(raw) ? "create_challan" : "create_invoice" };

  // Changing an existing customer or product: "change price of cement to 450",
  // "update phone of Ravi Traders to 98765 43210", "set Ravi's gstin to 33…".
  const update = parseUpdate(raw);
  if (update) {
    const target = findEntityInText(update.entity, ctx.customers, customerDisplayName);
    const targetProduct = findEntityInText(update.entity, (ctx.products || []), (p) => p.name);
    const isProductField = PRODUCT_FIELDS.test(update.field);
    const isCustomerField = CUSTOMER_FIELDS.test(update.field);
    const pickProduct = targetProduct && (isProductField || !target || targetProduct.score > target.score) && !(isCustomerField && !isProductField);
    const fieldText = `${update.field} ${update.value}`;
    if (pickProduct) return { ...base, intent: "update_product", product: targetProduct.item, fieldText };
    if (target) return { ...base, intent: "update_customer", customer: target.item, fieldText };
    return { ...base, intent: isProductField ? "update_product" : "update_customer", fieldText };
  }
  const deactivate = q.match(/^(?:deactivate|disable|archive|hide|stop selling)\s+(?:the\s+)?(?:product|item)?\s*(.+)$/);
  if (deactivate) return { ...base, intent: "deactivate_product", product: findEntityInText(deactivate[1], (ctx.products || []), (p) => p.name)?.item || null };

  const markPaid = q.match(/\bmark\s+(?:invoice|bill|inv)?\s*(?:no|number)?\s*([a-z0-9/-]*\d[a-z0-9/-]*)\s+(?:as\s+)?(?:fully\s+)?paid\b/) || q.match(/^(?:invoice|bill|inv)\s*(?:no|number)?\s*([a-z0-9/-]*\d[a-z0-9/-]*)\s+(?:is\s+)?(?:fully\s+)?paid\b/);
  if (markPaid) return { ...withEntities, intent: "mark_paid", invoiceRef: rawInvoiceRef(raw) || markPaid[1], mode: paymentModeIn(raw) };

  if (/^(add|create|new|save|register)\s+(a\s+|new\s+)*(customer|client|party)\b/.test(q)) return { ...base, intent: "add_customer", fields: parseCustomerFields(raw) };
  if (/^(add|create|new|save)\s+(a\s+|new\s+)*(product|item)\b/.test(q)) return { ...base, intent: "add_product", fields: parseProductFields(raw) };

  const expenseLead = /^(add|record|log|new|enter|save)\s+(an?\s+|new\s+)*(expense|expenses|kharcha|selavu)\b|^(expense|kharcha|selavu)\b|^(spent|spend)\b/.test(q);
  const paidForThing = /^(i\s+)?paid\b/.test(q) && amounts.length && expenseCategoryIn(raw) && !customer;
  if ((expenseLead || paidForThing) && !isQuestion) return { ...base, intent: "add_expense", fields: parseExpenseFields(raw) };

  const paymentWords = /\b(paid|pays|received|receive|got|collected|payment|deposited|sent|gave|kuduthar|koduthaar|diya|diye)\b/.test(q);
  if (paymentWords && amounts.length && customer && !isQuestion) {
    return { ...withEntities, intent: "record_payment", amount: amounts[0].value, mode: paymentModeIn(raw) || "Cash" };
  }
  if (paymentWords && amounts.length && !isQuestion && /\b(from|by|paid|received)\b/.test(q)) {
    return { ...withEntities, intent: "record_payment", amount: amounts[0].value, mode: paymentModeIn(raw) || "Cash", customerText: raw };
  }

  // --- questions ----------------------------------------------------------
  const invRef = rawInvoiceRef(raw);
  if (invRef && !/\b(how many|count|number of)\b/.test(q)) return { ...withEntities, intent: "invoice_lookup", invoiceRef: invRef };

  if (/\b(overdue|late payment|late payments|past due|delayed)\b/.test(q)) return { ...withEntities, intent: "overdue" };
  // "did Ravi pay?", "has ABC paid 5000?" are questions about the balance.
  if (customer && isQuestion && /\b(pay|paid|payment|payments)\b/.test(q)) return { ...withEntities, intent: "customer_balance" };
  const owesWords = /\b(owe|owes|owed|owing|dues?|pending|outstanding|receivables?|balance|unpaid|kaasu|baki|baaki|bakaya|udhaar|udhar|kadan|credit)\b/.test(q) || /\b(not|havent|hasnt|didnt|yet to) (paid|pay)\b/.test(q);
  if (owesWords && !/\bexpense/.test(q)) {
    return { ...withEntities, intent: customer ? "customer_balance" : "receivables" };
  }
  if (/\b(gst|tax|taxes|cgst|sgst|igst|gstr)\b/.test(q)) return { ...withEntities, intent: "gst" };
  if (/\b(collect|collected|collection|collections|received|receipts?|came in|got paid|payments? received|money in)\b/.test(q)) return { ...withEntities, intent: "collections" };
  if (/\b(expense|expenses|spent|spending|spend|kharcha|selavu|cost of running|outgoing)\b/.test(q)) return { ...withEntities, intent: "expenses" };
  if (/\b(profit|profits|loss|margin|earning|earnings|earned|net income|labh|laabam)\b/.test(q)) return { ...withEntities, intent: "profit" };
  if (/\b(stock|inventory|reorder|re order|run out|running out|out of stock|godown|quantity left|how many left)\b/.test(q)) return { ...withEntities, intent: product ? "product_info" : "stock" };
  if (/\b(top|best|most|highest|biggest|leading|fast moving|popular)\b/.test(q) && /\b(product|products|item|items|selling|seller|sellers|sold|moving)\b/.test(q)) return { ...withEntities, intent: "top_products" };
  if (/\b(top|best|biggest|highest|vip|loyal|regular|most valuable)\b/.test(q) && /\b(customer|customers|client|clients|buyer|buyers|party|parties)\b/.test(q)) return { ...withEntities, intent: "top_customers" };
  if (/\b(price|rate|mrp|cost of|how much is|how much for)\b/.test(q) && product) return { ...withEntities, intent: "product_info" };
  if (/\b(sales|sale|sold|revenue|turnover|business|billed|billing|invoiced|vyapar|vyabaram|how many (invoices|bills)|invoice count|number of (invoices|bills))\b/.test(q)) {
    if (product && !customer) return { ...withEntities, intent: "product_info" };
    if (customer) return { ...withEntities, intent: "customer_info" };
    return { ...withEntities, intent: "sales" };
  }
  if (/\b(summary|overview|snapshot|how is (my )?business|how am i doing|report|status)\b/.test(q)) return { ...withEntities, intent: "summary" };
  if (/\b(recent|latest|last)\s+(\d+\s+)?(invoices|bills|invoice|bill)\b/.test(q)) return { ...withEntities, intent: "recent_invoices", limit: Number((q.match(/\b(\d+)\s+(invoices|bills)/) || [])[1]) || 5 };

  // --- entity on its own, or a follow-up ------------------------------------
  if (customer) return { ...withEntities, intent: ctx.last?.intent && FOLLOWS_CUSTOMER.has(ctx.last.intent) ? ctx.last.intent : "customer_info" };
  if (product) return { ...withEntities, intent: "product_info" };
  if (base.period && ctx.last?.intent && FOLLOWS_PERIOD.has(ctx.last.intent)) {
    return { ...withEntities, intent: ctx.last.intent, customer: ctx.last.customer || null, product: ctx.last.product || null };
  }
  if (base.period) return { ...withEntities, intent: "sales" };
  return withEntities;
}

const PRODUCT_FIELDS = /^(price|rate|mrp|selling price|purchase price|cost price|hsn|hsn code|unit|category|brand)$/i;
const CUSTOMER_FIELDS = /^(phone|mobile|phone number|mobile number|number|contact|email|mail|gst|gstin|gst number|city|address|location)$/i;
const FIELD_WORDS_RE = "price|rate|mrp|selling price|purchase price|cost price|hsn code|hsn|unit|category|brand|phone number|mobile number|phone|mobile|contact|email|mail|gst number|gstin|gst|city|address|location|name";

// { field, entity, value } from an update sentence, or null.
export function parseUpdate(text) {
  const s = String(text || "").trim().replace(/[?.!]+$/, "");
  const verb = "(?:update|change|set|edit|make|correct|fix)";
  let m = s.match(new RegExp(`^${verb}\\s+(?:the\\s+)?(${FIELD_WORDS_RE})\\s+(?:of|for)\\s+(.+?)\\s+(?:to|as|=|is)\\s+(.+)$`, "i"));
  if (m) return { field: m[1].toLowerCase(), entity: m[2], value: m[3] };
  m = s.match(new RegExp(`^${verb}\\s+(.+?)['’]s\\s+(${FIELD_WORDS_RE})\\s+(?:to|as|=|is)\\s+(.+)$`, "i"));
  if (m) return { field: m[2].toLowerCase(), entity: m[1], value: m[3] };
  m = s.match(new RegExp(`^${verb}\\s+(.+?)\\s+(${FIELD_WORDS_RE})\\s+(?:to|as|=|is)\\s+(.+)$`, "i"));
  if (m) return { field: m[2].toLowerCase(), entity: m[1], value: m[3] };
  m = s.match(new RegExp(`^(.+?)\\s+(${FIELD_WORDS_RE})\\s+(?:is now|should be|changed to|now)\\s+(.+)$`, "i"));
  if (m) return { field: m[2].toLowerCase(), entity: m[1], value: m[3] };
  return null;
}

const FOLLOWS_PERIOD = new Set(["sales", "collections", "gst", "expenses", "profit", "top_products", "top_customers", "customer_info", "product_info", "summary"]);
const FOLLOWS_CUSTOMER = new Set(["customer_balance", "customer_info"]);

// "invoice 005", "bill no 12", "inv #005/2026-27", "005/2026-27"
export function rawInvoiceRef(text) {
  const s = String(text || "");
  const full = s.match(/\b(\d{1,6}\/\d{4}-\d{2})\b/);
  if (full) return full[1];
  const m = s.match(/\b(?:invoice|bill|inv)\s*(?:no\.?|number|num|#)?\s*#?\s*([A-Z]*-?\d{1,6})\b/i);
  if (m && !/^\d{5,}$/.test(m[1])) return m[1];
  const hash = s.match(/#\s*(\d{1,6})\b/);
  return hash ? hash[1] : null;
}
