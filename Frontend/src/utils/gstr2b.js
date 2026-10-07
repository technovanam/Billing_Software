// GSTR-2B reconciliation: match the purchase invoices your suppliers uploaded
// (GSTR-2B JSON downloaded from the GST portal) against the purchase bills in
// your books, so input tax credit is claimed only where it is safe.
import { invoiceTotalsInr, round2 } from "./gst.js";
import { toDateKey } from "./accounting.js";

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// "INV/0042-A" and "inv 42 a" both become "INV42A".
export function normaliseInvoiceNo(no) {
  return String(no || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(^|[A-Z])0+(\d)/g, "$1$2");
}

const isoFromDdMmYyyy = (s) => {
  const m = String(s || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s || "").slice(0, 10);
};

// The portal's GSTR-2B JSON -> flat list of supplier documents.
export function parseGstr2b(json) {
  const root = json?.data || json || {};
  const docdata = root.docdata || {};
  const out = [];
  const add = (supplier, doc, kind) => {
    const items = doc.items || doc.itms || [];
    const sum = (k) => round2(items.reduce((s, it) => s + n(it[k] ?? it.itm_det?.[k]), 0));
    out.push({
      kind,
      ctin: String(supplier.ctin || "").toUpperCase(),
      supplierName: supplier.trdnm || "",
      number: doc.inum || doc.ntnum || doc.nt_num || "",
      date: isoFromDdMmYyyy(doc.dt || doc.idt || doc.nt_dt),
      value: round2(n(doc.val)),
      taxable: sum("txval"),
      igst: sum("igst") || sum("iamt"),
      cgst: sum("cgst") || sum("camt"),
      sgst: sum("sgst") || sum("samt"),
      reverseCharge: doc.rev === "Y",
      itcAvailable: doc.itcavl !== "N",
      reason: doc.rsn || "",
    });
  };
  for (const s of docdata.b2b || []) for (const inv of s.inv || []) add(s, inv, "Invoice");
  for (const s of docdata.cdnr || []) for (const nt of s.nt || []) add(s, nt, nt.typ === "D" || nt.ntty === "D" ? "Debit note" : "Credit note");
  return { gstin: root.gstin || "", period: root.rtnprd || "", docs: out };
}

const TOLERANCE = 1; // rupees

// Reconcile 2B documents with purchase bills recorded in the books.
export function reconcile2b(docs2b, purchases, suppliers = [], period = {}) {
  const supplierGstin = new Map(suppliers.map((s) => [s.id, String(s.gstin || "").toUpperCase()]));
  const books = (purchases || [])
    .filter((p) => {
      const d = toDateKey(p.supplierBillDate || p.voucherDate);
      return (!period.from || d >= period.from) && (!period.to || d <= period.to);
    })
    .map((p) => {
      const t = invoiceTotalsInr(p);
      return {
        id: p.id,
        ctin: String(p.party?.gstin || supplierGstin.get(p.partyId) || "").toUpperCase(),
        supplierName: p.party?.name || "",
        number: p.supplierBillNumber || "",
        voucherNumber: p.voucherNumber,
        date: toDateKey(p.supplierBillDate || p.voucherDate),
        value: t.total,
        taxable: t.taxableAmount,
        igst: t.igstAmount,
        cgst: t.cgstAmount,
        sgst: t.sgstAmount,
      };
    });

  const key = (d) => `${d.ctin}|${normaliseInvoiceNo(d.number)}`;
  const bookByKey = new Map(books.map((b) => [key(b), b]));
  const used = new Set();
  const rows = [];

  for (const d of docs2b.filter((x) => x.kind === "Invoice")) {
    const b = bookByKey.get(key(d));
    if (!b) {
      rows.push({ status: "Missing in books", portal: d, books: null, itc: round2(d.igst + d.cgst + d.sgst) });
      continue;
    }
    used.add(b.id);
    const diffs = [];
    for (const f of ["taxable", "igst", "cgst", "sgst"]) if (Math.abs(d[f] - b[f]) > TOLERANCE) diffs.push({ field: f, portal: d[f], books: b[f] });
    if (b.date !== d.date) diffs.push({ field: "date", portal: d.date, books: b.date });
    const taxDiff = diffs.some((x) => x.field !== "date");
    rows.push({
      status: taxDiff ? "Mismatch" : !d.itcAvailable ? "ITC not available" : "Matched",
      portal: d,
      books: b,
      diffs,
      itc: round2(d.igst + d.cgst + d.sgst),
    });
  }
  for (const b of books) {
    if (used.has(b.id)) continue;
    rows.push({ status: "Missing in 2B", portal: null, books: b, itc: round2(b.igst + b.cgst + b.sgst) });
  }

  const totals = {};
  for (const r of rows) {
    const t = totals[r.status] || { count: 0, itc: 0 };
    t.count += 1;
    t.itc = round2(t.itc + r.itc);
    totals[r.status] = t;
  }
  return { rows, totals, notes: docs2b.filter((x) => x.kind !== "Invoice") };
}
