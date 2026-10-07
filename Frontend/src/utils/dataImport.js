// Bring existing books in: Tally masters (XML export) and Excel / CSV lists of
// customers, suppliers and products. Everything here is pure so it can be
// tested; the Settings → Data screen previews the result and writes it.
import { GROUPS } from "./accounting.js";

const num = (v) => {
  const x = Number.parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/* ─── Minimal XML reader (enough for Tally exports) ─────────────────────── */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      // Tally writes control characters like &#4; — drop them.
      return code < 32 && code !== 9 && code !== 10 && code !== 13 ? "" : String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

export function parseXml(text) {
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[3]) {
      if (m[2] === "/") {
        // Close the nearest matching tag (tolerates stray closers).
        for (let i = stack.length - 1; i > 0; i--)
          if (stack[i].name === m[3].toUpperCase()) {
            stack.length = i;
            break;
          }
      } else {
        const attrs = {};
        m[4].replace(/([\w.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, k, __, a, b) => {
          attrs[k.toUpperCase()] = decode(a ?? b ?? "");
        });
        const node = { name: m[3].toUpperCase(), attrs, children: [], text: "" };
        top.children.push(node);
        if (!m[5]) stack.push(node);
      }
    } else if (m[6] !== undefined) top.text += decode(m[6]);
  }
  return root;
}

const kids = (node, name) => (node?.children || []).filter((c) => c.name === name);
const kid = (node, name) => kids(node, name)[0];
const textOf = (node, path) => {
  let cur = node;
  for (const part of path.split("/")) {
    cur = kid(cur, part);
    if (!cur) return "";
  }
  return clean(cur.text);
};
function findAll(node, name, out = []) {
  for (const c of node.children || []) {
    if (c.name === name) out.push(c);
    else findAll(c, name, out);
  }
  return out;
}

// Tally text exports are usually UTF-16 with a BOM.
export function decodeExport(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

/* ─── Tally masters ─────────────────────────────────────────────────────── */

// Tally group -> where it lands here. Debtors/creditors become parties; bank,
// cash, capital, loans and assets become chart-of-accounts ledgers. Sales,
// purchase, tax and expense ledgers are created automatically, so they're skipped.
const GROUP_MAP = {
  "sundry debtors": "customer",
  "sundry creditors": "supplier",
  "bank accounts": "Bank Accounts",
  "bank od a/c": "Bank Accounts",
  "bank occ a/c": "Bank Accounts",
  "cash-in-hand": "Cash-in-Hand",
  "capital account": "Capital Account",
  "reserves & surplus": "Capital Account",
  "loans (liability)": "Loans (Liability)",
  "secured loans": "Loans (Liability)",
  "unsecured loans": "Loans (Liability)",
  "current liabilities": "Current Liabilities",
  provisions: "Current Liabilities",
  "current assets": "Current Assets",
  "loans & advances (asset)": "Current Assets",
  deposits: "Current Assets",
  "deposits (asset)": "Current Assets",
  "fixed assets": "Fixed Assets",
  investments: "Fixed Assets",
};

const nameOfMaster = (node) => clean(node.attrs.NAME) || textOf(node, "NAME") || textOf(node, "LANGUAGENAME.LIST/NAME.LIST/NAME");

// Tally signs opening balances: negative = Debit, positive = Credit.
const drCr = (v) => {
  const x = num(v);
  return { amount: Math.abs(x), side: x < 0 ? "Dr" : "Cr" };
};

function address(node) {
  const list = kid(node, "ADDRESS.LIST") || kid(node, "LEDMAILINGDETAILS.LIST")?.children?.find((c) => c.name === "ADDRESS.LIST");
  return list ? kids(list, "ADDRESS").map((a) => clean(a.text)).filter(Boolean).join(", ") : "";
}

function gstinOf(node) {
  return (textOf(node, "PARTYGSTIN") || findAll(node, "GSTIN").map((g) => clean(g.text))[0] || "").toUpperCase();
}

function gstRateOf(item) {
  for (const rd of findAll(item, "RATEDETAILS.LIST")) {
    if (/igst/i.test(textOf(rd, "GSTRATEDUTYHEAD"))) return num(textOf(rd, "GSTRATE"));
  }
  const direct = findAll(item, "GSTRATE")[0];
  return direct ? num(direct.text) : null;
}

export function parseTallyMasters(xmlText) {
  const root = parseXml(xmlText);
  const groupsByName = new Map();
  for (const g of findAll(root, "GROUP")) groupsByName.set(nameOfMaster(g).toLowerCase(), textOf(g, "PARENT"));
  // Follow a custom group up to a primary Tally group (e.g. "Chennai Debtors" -> Sundry Debtors).
  const primary = (group) => {
    let cur = clean(group).toLowerCase();
    for (let i = 0; i < 10 && cur && !GROUP_MAP[cur] && groupsByName.has(cur); i++) cur = clean(groupsByName.get(cur)).toLowerCase();
    return cur;
  };

  const out = { customers: [], suppliers: [], accounts: [], products: [], skipped: [] };
  for (const l of findAll(root, "LEDGER")) {
    const name = nameOfMaster(l);
    if (!name) continue;
    const group = textOf(l, "PARENT");
    const target = GROUP_MAP[primary(group)];
    const ob = drCr(textOf(l, "OPENINGBALANCE"));
    if (target === "customer" || target === "supplier") {
      const party = {
        name,
        gstin: gstinOf(l),
        address: address(l),
        state: textOf(l, "LEDSTATENAME") || textOf(l, "STATENAME") || findAll(l, "STATE").map((s) => clean(s.text))[0] || "",
        pincode: textOf(l, "PINCODE"),
        email: textOf(l, "EMAIL"),
        phone: textOf(l, "LEDGERMOBILE") || textOf(l, "LEDGERPHONE"),
      };
      if (target === "customer") out.customers.push({ ...party, taxId: party.gstin, openingBalance: ob.side === "Dr" ? ob.amount : -ob.amount });
      else out.suppliers.push({ ...party, openingBalance: ob.side === "Cr" ? ob.amount : -ob.amount });
    } else if (target && GROUPS[target]) {
      out.accounts.push({ name, group: target, openingBalance: ob.amount, openingSide: ob.side, ...(target === "Bank Accounts" ? { accountNumber: textOf(l, "BANKDETAILS"), ifsc: textOf(l, "IFSCODE") } : {}) });
    } else out.skipped.push({ name, group: group || "—", reason: "Created automatically" });
  }

  for (const s of findAll(root, "STOCKITEM")) {
    const name = nameOfMaster(s);
    if (!name) continue;
    const unit = textOf(s, "BASEUNITS");
    const openingQty = num(textOf(s, "OPENINGBALANCE"));
    const openingRate = num(textOf(s, "OPENINGRATE"));
    const price = num(findAll(s, "STANDARDPRICELIST.LIST").map((p) => textOf(p, "RATE"))[0]) || num(textOf(s, "RATEOFMRP"));
    const hsn = findAll(s, "HSNCODE").map((h) => clean(h.text)).find(Boolean) || "";
    const rate = gstRateOf(s);
    out.products.push({
      name,
      unit,
      hsn,
      price: price || openingRate || 0,
      gstRate: rate ?? 18,
      openingStock: openingQty || "",
      openingRate: openingRate || "",
      purchasePrice: openingRate || "",
    });
  }
  return out;
}

/* ─── Excel / CSV lists ─────────────────────────────────────────────────── */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// Column headings accepted for each field (first match wins).
export const IMPORT_COLUMNS = {
  customers: {
    name: ["name", "customer", "customer name", "party", "party name", "ledger name"],
    gstin: ["gstin", "gst no", "gst number", "gstin/uin"],
    phone: ["phone", "mobile", "contact", "phone number"],
    email: ["email", "e-mail", "email id"],
    address: ["address", "billing address"],
    state: ["state"],
    pincode: ["pincode", "pin", "pin code"],
    openingBalance: ["opening balance", "opening", "balance", "outstanding"],
  },
  suppliers: {
    name: ["name", "supplier", "supplier name", "vendor", "party", "party name", "ledger name"],
    gstin: ["gstin", "gst no", "gst number", "gstin/uin"],
    phone: ["phone", "mobile", "contact"],
    email: ["email", "e-mail"],
    address: ["address"],
    state: ["state"],
    contactPerson: ["contact person"],
    openingBalance: ["opening balance", "opening", "balance", "payable"],
  },
  products: {
    name: ["name", "product", "item", "item name", "product name", "stock item"],
    hsn: ["hsn", "hsn code", "hsn/sac", "sac"],
    price: ["price", "rate", "selling price", "sale price", "mrp"],
    unit: ["unit", "uom", "units"],
    gstRate: ["gst", "gst rate", "gst %", "tax rate", "igst rate"],
    cessRate: ["cess", "cess %", "cess rate"],
    openingStock: ["opening stock", "opening qty", "stock", "quantity", "qty"],
    purchasePrice: ["purchase price", "cost", "cost price", "purchase rate"],
    sku: ["sku", "item code", "code"],
    category: ["category", "group", "stock group"],
  },
};

const NUMERIC = new Set(["openingBalance", "price", "gstRate", "cessRate", "openingStock", "purchasePrice"]);

// rows[0] is the heading row. Returns { records, unknownColumns, missingName }.
export function rowsToRecords(rows, kind) {
  const spec = IMPORT_COLUMNS[kind];
  if (!rows?.length || !spec) return { records: [], unknownColumns: [], missingName: true };
  const heads = rows[0].map((h) => clean(h).toLowerCase().replace(/[*:]/g, "").trim());
  const colOf = {};
  for (const [field, names] of Object.entries(spec)) {
    const i = heads.findIndex((h) => names.includes(h));
    if (i >= 0) colOf[field] = i;
  }
  const used = new Set(Object.values(colOf));
  const unknownColumns = heads.filter((h, i) => h && !used.has(i));
  if (colOf.name === undefined) return { records: [], unknownColumns, missingName: true };
  const records = [];
  for (const r of rows.slice(1)) {
    const rec = {};
    for (const [field, i] of Object.entries(colOf)) {
      const v = r[i];
      if (v === undefined || v === null || String(v).trim() === "") continue;
      rec[field] = NUMERIC.has(field) ? num(v) : field === "gstin" ? clean(v).toUpperCase() : clean(v instanceof Date ? v.toISOString().slice(0, 10) : v);
    }
    if (rec.name) records.push(rec);
  }
  if (kind === "customers") for (const r of records) r.taxId = r.gstin || "";
  if (kind === "products") for (const r of records) if (r.gstRate === undefined) r.gstRate = 18;
  return { records, unknownColumns, missingName: false };
}

// Split records into new ones and names that already exist (case-insensitive).
export function dedupe(records, existing, nameKey = "name") {
  const have = new Set((existing || []).map((e) => clean(e[nameKey] || e.displayName || e.companyName).toLowerCase()));
  const fresh = [];
  const duplicates = [];
  for (const r of records) {
    const key = clean(r.name).toLowerCase();
    if (have.has(key)) duplicates.push(r);
    else {
      have.add(key);
      fresh.push(r);
    }
  }
  return { fresh, duplicates };
}

/* ─── Backup ────────────────────────────────────────────────────────────── */

// Every per-business collection included in a full backup.
export const BACKUP_COLLECTIONS = [
  "customers",
  "products",
  "invoices",
  "payments",
  "expenses",
  "recurringInvoices",
  "deliveryChallans",
  "quotations",
  "salesOrders",
  "purchaseOrders",
  "creditNotes",
  "debitNotes",
  "purchases",
  "suppliers",
  "journals",
  "ledgers",
  "stockJournals",
  "advanceReceipts",
  "cheques",
  "priceLists",
  "budgets",
  "costCentres",
  "godowns",
  "employees",
  "payrollRuns",
  "settings",
  "auditTrail",
];
// Restored from a backup (the audit trail is append-only and stays as it is).
export const RESTORE_COLLECTIONS = BACKUP_COLLECTIONS.filter((c) => c !== "auditTrail");

// Firestore values -> JSON (Timestamps become { __ts: ISO }).
export function toPlain(value) {
  if (value == null) return value;
  if (typeof value?.toDate === "function") return { __ts: value.toDate().toISOString() };
  if (value instanceof Date) return { __ts: value.toISOString() };
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  return value;
}

// JSON -> values for Firestore; `makeTs(date)` builds a Timestamp.
export function fromPlain(value, makeTs) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => fromPlain(v, makeTs));
  if (typeof value === "object") {
    if (typeof value.__ts === "string" && Object.keys(value).length === 1) return makeTs(new Date(value.__ts));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromPlain(v, makeTs)]));
  }
  return value;
}

export function checkBackup(json) {
  if (!json || json.app !== "kanakku-desk" || typeof json.collections !== "object") return "This isn't a Kanakku Desk backup file.";
  return "";
}

// Flat rows for an Excel sheet: top-level values only, nested objects as JSON.
export function sheetRows(docs) {
  const keys = [];
  for (const d of docs) for (const k of Object.keys(d)) if (!keys.includes(k)) keys.push(k);
  const cell = (v) => {
    if (v == null) return null;
    if (typeof v === "object" && v.__ts) return v.__ts.slice(0, 10);
    if (typeof v === "object") return JSON.stringify(v).slice(0, 32000);
    return v;
  };
  return [keys, ...docs.map((d) => keys.map((k) => cell(d[k])))];
}
