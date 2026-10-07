// GSTR-1 and GSTR-3B from saved vouchers, Tally style. GSTR-1 is produced in
// the GST portal's offline-tool JSON layout (b2b, b2cl, b2cs, cdnr, cdnur,
// hsn, doc_issue) so it can be uploaded after checking in the offline tool.
import { invoiceTotalsInr as invoiceTotals, partyStateCode, round2, stateName, isExport, isSez } from "./gst.js";
import { toDateKey } from "./accounting.js";
import { advanceTables } from "./advances.js";

export const B2CL_LIMIT = 100000; // inter-state B2C invoices above this go to B2CL

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const buyerGstin = (party) => {
  const g = String(party?.gstin || party?.taxId || party?.gst || party?.company || "").trim().toUpperCase();
  return GSTIN_RE.test(g) ? g : "";
};

const ddmmyyyy = (iso) => {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}-${m}-${y}` : "";
};

export function monthPeriod(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}`, fp: `${String(m).padStart(2, "0")}${y}` };
}

const isLive = (doc) => !/^(draft|cancelled)$/i.test(String(doc?.status || ""));
const inRange = (d, p) => d && d >= p.from && d <= p.to;

// Rate-wise item details of a voucher, in the portal's itm_det shape.
function rateItems(t, inter) {
  return (t.taxBreakup.length ? t.taxBreakup : [{ gstRate: 0, taxable: t.taxableAmount, cgst: 0, sgst: 0, igst: 0 }]).map((b, i) => ({
    num: i + 1,
    itm_det: inter
      ? { txval: round2(b.taxable), rt: b.gstRate, iamt: round2(b.igst), csamt: round2(b.cess || 0) }
      : { txval: round2(b.taxable), rt: b.gstRate, camt: round2(b.cgst), samt: round2(b.sgst), csamt: round2(b.cess || 0) },
  }));
}

// Zero-rated lines are not in taxBreakup; add them back for complete taxable value.
function withZeroRated(t) {
  const taxedTaxable = t.taxBreakup.reduce((s, b) => s + b.taxable, 0);
  if (t.zeroRated) return t;
  const zero = round2(t.taxableAmount - taxedTaxable);
  return zero > 0.005 ? { ...t, taxBreakup: [...t.taxBreakup, { gstRate: 0, taxable: zero, cgst: 0, sgst: 0, igst: 0 }] } : t;
}

function voucherInfo(doc, company, kind) {
  const t = withZeroRated(invoiceTotals(doc));
  const party = kind === "invoice" ? doc.client : doc.party;
  const ctin = buyerGstin(party);
  const pos = doc.placeOfSupply?.code || partyStateCode(party) || partyStateCode(company) || "";
  const inter = isExport(doc) || isSez(doc) || Boolean(doc.isInterState ?? (pos && pos !== partyStateCode(company)));
  return { t, party, ctin, pos: isExport(doc) ? "96" : pos, inter };
}

export function buildGstr1({ invoices = [], creditNotes = [], advances = [], company, ym }) {
  const period = monthPeriod(ym);
  const b2b = new Map();
  const b2cl = new Map();
  const b2cs = new Map();
  const cdnr = new Map();
  const cdnur = [];
  const exp = new Map(); // WPAY / WOPAY
  const hsn = new Map();
  const docs = { invoices: [], creditNotes: [], cancelled: 0 };
  const b2clInvoiceNumbers = new Set();

  const addB2cs = (pos, inter, b, sign) => {
    const key = `${inter ? "INTER" : "INTRA"}|${pos}|${b.gstRate}`;
    const cur = b2cs.get(key) || { sply_ty: inter ? "INTER" : "INTRA", pos, typ: "OE", rt: b.gstRate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    cur.txval = round2(cur.txval + sign * b.taxable);
    cur.iamt = round2(cur.iamt + sign * b.igst);
    cur.camt = round2(cur.camt + sign * b.cgst);
    cur.samt = round2(cur.samt + sign * b.sgst);
    cur.csamt = round2(cur.csamt + sign * (b.cess || 0));
    b2cs.set(key, cur);
  };

  const addHsn = (doc, sign) => {
    const t = invoiceTotals(doc);
    for (const l of t.lines) {
      const code = String(l.hsnCode || l.hsn || "").trim() || "NA";
      const key = `${code}|${l.gstRate}`;
      const cur = hsn.get(key) || { hsn_sc: code, desc: (l.description || "").slice(0, 30), uqc: "OTH", rt: l.gstRate, qty: 0, val: 0, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
      cur.qty = round2(cur.qty + sign * (Number(l.quantity) || 0));
      cur.txval = round2(cur.txval + sign * l.taxable);
      cur.iamt = round2(cur.iamt + sign * l.igst);
      cur.camt = round2(cur.camt + sign * l.cgst);
      cur.samt = round2(cur.samt + sign * l.sgst);
      cur.csamt = round2(cur.csamt + sign * (l.cess || 0));
      cur.val = round2(cur.txval + cur.iamt + cur.camt + cur.samt + cur.csamt);
      hsn.set(key, cur);
    }
  };

  for (const inv of invoices) {
    const date = toDateKey(inv.invoiceDate);
    if (!inRange(date, period)) continue;
    if (String(inv.status).toLowerCase() === "cancelled") docs.cancelled += 1;
    if (!isLive(inv)) continue;
    if (inv.isGstEnabled === false) continue;
    docs.invoices.push(inv.invoiceNumber);
    const { t, ctin, pos, inter } = voucherInfo(inv, company, "invoice");
    addHsn(inv, 1);
    if (isExport(inv)) {
      const typ = inv.supplyType === "EXPWP" ? "WPAY" : "WOPAY";
      const cur = exp.get(typ) || { exp_typ: typ, inv: [] };
      cur.inv.push({
        inum: inv.invoiceNumber,
        idt: ddmmyyyy(date),
        val: round2(t.total),
        sbpcode: inv.portCode || "",
        sbnum: inv.shippingBillNo || "",
        sbdt: inv.shippingBillDate ? ddmmyyyy(inv.shippingBillDate) : "",
        itms: t.taxBreakup.map((b) => ({ txval: round2(b.taxable), rt: b.gstRate, iamt: round2(b.igst), csamt: round2(b.cess || 0) })),
      });
      exp.set(typ, cur);
    } else if (ctin) {
      const invTyp = inv.supplyType === "SEZWP" ? "SEWP" : inv.supplyType === "SEZWOP" ? "SEWOP" : inv.supplyType === "DEXP" ? "DE" : "R";
      const cur = b2b.get(ctin) || { ctin, inv: [] };
      cur.inv.push({ inum: inv.invoiceNumber, idt: ddmmyyyy(date), val: round2(t.total), pos, rchrg: inv.reverseCharge ? "Y" : "N", inv_typ: invTyp, itms: rateItems(t, inter) });
      b2b.set(ctin, cur);
    } else if (inter && t.total > B2CL_LIMIT) {
      b2clInvoiceNumbers.add(inv.invoiceNumber);
      const cur = b2cl.get(pos) || { pos, inv: [] };
      cur.inv.push({ inum: inv.invoiceNumber, idt: ddmmyyyy(date), val: round2(t.total), itms: rateItems(t, true) });
      b2cl.set(pos, cur);
    } else {
      for (const b of t.taxBreakup) addB2cs(pos, inter, b, 1);
    }
  }

  for (const cn of creditNotes) {
    const date = toDateKey(cn.voucherDate);
    if (!inRange(date, period)) continue;
    docs.creditNotes.push(cn.voucherNumber);
    const { t, ctin, pos, inter } = voucherInfo(cn, company, "note");
    addHsn(cn, -1);
    const note = { ntty: "C", nt_num: cn.voucherNumber, nt_dt: ddmmyyyy(date), val: round2(t.total), pos, rchrg: "N", inv_typ: "R", itms: rateItems(t, inter) };
    if (ctin) {
      const cur = cdnr.get(ctin) || { ctin, nt: [] };
      cur.nt.push(note);
      cdnr.set(ctin, cur);
    } else if (inter && b2clInvoiceNumbers.has(cn.linkedNumber)) {
      cdnur.push({ typ: "B2CL", ...note, inv_typ: undefined, rchrg: undefined });
    } else {
      // Small B2C returns reduce the B2CS figures directly.
      for (const b of t.taxBreakup) addB2cs(pos, inter, b, -1);
    }
  }

  const range = (list) => {
    const sorted = [...list].sort();
    return sorted.length ? { from: sorted[0], to: sorted[sorted.length - 1], totnum: sorted.length } : null;
  };
  const docDet = [];
  const invRange = range(docs.invoices);
  if (invRange) docDet.push({ doc_num: 1, docs: [{ num: 1, from: invRange.from, to: invRange.to, totnum: invRange.totnum + docs.cancelled, cancel: docs.cancelled, net_issue: invRange.totnum }] });
  const cnRange = range(docs.creditNotes);
  if (cnRange) docDet.push({ doc_num: 5, docs: [{ num: 1, from: cnRange.from, to: cnRange.to, totnum: cnRange.totnum, cancel: 0, net_issue: cnRange.totnum }] });

  const json = {
    gstin: (company?.gstin || "").toUpperCase(),
    fp: period.fp,
    b2b: [...b2b.values()],
    b2cl: [...b2cl.values()],
    b2cs: [...b2cs.values()].filter((r) => Math.abs(r.txval) >= 0.005),
    cdnr: [...cdnr.values()],
    cdnur: cdnur.map(({ inv_typ, rchrg, ...rest }) => rest), // eslint-disable-line no-unused-vars
    exp: [...exp.values()],
    at: [],
    txpd: [],
    hsn: { data: [...hsn.values()].map((h, i) => ({ num: i + 1, ...h })) },
    doc_issue: { doc_det: docDet },
  };

  const adv = advanceTables(advances, period, company);
  json.at = adv.at;
  json.txpd = adv.txpd;

  const sum = (rows, key) => round2(rows.reduce((s, r) => s + (r[key] || 0), 0));
  const b2bInvoices = json.b2b.flatMap((c) => c.inv.map((i) => ({ ...i, ctin: c.ctin })));
  const b2clInvoices = json.b2cl.flatMap((c) => c.inv.map((i) => ({ ...i, pos: c.pos })));
  const notes = json.cdnr.flatMap((c) => c.nt.map((nt) => ({ ...nt, ctin: c.ctin })));
  const expInvoices = json.exp.flatMap((e) => e.inv.map((i) => ({ ...i, exp_typ: e.exp_typ })));
  const itemTotals = (list) => {
    const out = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    for (const d of list) for (const it of d.itms) for (const k of Object.keys(out)) out[k] = round2(out[k] + (it.itm_det[k] || 0));
    return out;
  };

  return {
    period,
    json,
    summary: {
      b2b: { count: b2bInvoices.length, value: sum(b2bInvoices, "val"), ...itemTotals(b2bInvoices) },
      b2cl: { count: b2clInvoices.length, value: sum(b2clInvoices, "val"), ...itemTotals(b2clInvoices) },
      b2cs: { count: json.b2cs.length, txval: sum(json.b2cs, "txval"), iamt: sum(json.b2cs, "iamt"), camt: sum(json.b2cs, "camt"), samt: sum(json.b2cs, "samt") },
      cdnr: { count: notes.length, value: sum(notes, "val"), ...itemTotals(notes) },
      cdnur: { count: json.cdnur.length, value: sum(json.cdnur, "val"), ...itemTotals(json.cdnur) },
      hsn: { count: json.hsn.data.length, txval: sum(json.hsn.data, "txval") },
      at: { count: adv.at.length, ...adv.atTotals },
      txpd: { count: adv.txpd.length, ...adv.txpdTotals },
      exp: {
        count: expInvoices.length,
        value: sum(expInvoices, "val"),
        txval: round2(expInvoices.reduce((s, i) => s + i.itms.reduce((a, it) => a + it.txval, 0), 0)),
        iamt: round2(expInvoices.reduce((s, i) => s + i.itms.reduce((a, it) => a + it.iamt, 0), 0)),
      },
    },
    expInvoices,
    b2bInvoices,
    b2clInvoices,
    notes,
  };
}

// ITC set-off in the order the law requires (rule 88A): IGST credit first
// against IGST, then CGST, then SGST; CGST credit against CGST then IGST;
// SGST credit against SGST then IGST.
export function setOffItc(output, itc) {
  const due = { igst: Math.max(0, output.igst), cgst: Math.max(0, output.cgst), sgst: Math.max(0, output.sgst) };
  const credit = { igst: Math.max(0, itc.igst), cgst: Math.max(0, itc.cgst), sgst: Math.max(0, itc.sgst) };
  const used = (from, to) => {
    const amt = Math.min(credit[from], due[to]);
    credit[from] = round2(credit[from] - amt);
    due[to] = round2(due[to] - amt);
  };
  used("igst", "igst");
  used("igst", "cgst");
  used("igst", "sgst");
  used("cgst", "cgst");
  used("cgst", "igst");
  used("sgst", "sgst");
  used("sgst", "igst");
  return { cash: due, carryForward: credit, totalCash: round2(due.igst + due.cgst + due.sgst) };
}

export function buildGstr3b({ invoices = [], creditNotes = [], purchases = [], debitNotes = [], advances = [], company, ym }) {
  const period = monthPeriod(ym);
  const outward = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 }; // 3.1(a)
  const zeroRated = { txval: 0, iamt: 0 }; // 3.1(b) exports & SEZ
  const nil = { txval: 0 }; // 3.1(c)
  const rcmOutward = { txval: 0 }; // tax paid by the buyers under reverse charge
  const inwardRcm = { txval: 0, iamt: 0, camt: 0, samt: 0 }; // 3.1(d)
  const interUnreg = new Map();
  const itc = { iamt: 0, camt: 0, samt: 0, csamt: 0 }; // 4(A)(5) all other ITC
  const itcRcm = { iamt: 0, camt: 0, samt: 0 }; // 4(A)(3) inward supplies liable to RCM

  const addOut = (doc, sign, kind) => {
    const { t, ctin, pos, inter } = voucherInfo(doc, company, kind);
    if (doc.reverseCharge) {
      rcmOutward.txval = round2(rcmOutward.txval + sign * t.taxableAmount);
      return;
    }
    if (isExport(doc) || isSez(doc)) {
      zeroRated.txval = round2(zeroRated.txval + sign * t.taxableAmount);
      zeroRated.iamt = round2(zeroRated.iamt + sign * t.igstAmount);
      return;
    }
    const taxed = t.taxBreakup.filter((b) => b.gstRate > 0);
    const taxedVal = taxed.reduce((s, b) => s + b.taxable, 0);
    outward.txval = round2(outward.txval + sign * taxedVal);
    outward.iamt = round2(outward.iamt + sign * t.igstAmount);
    outward.camt = round2(outward.camt + sign * t.cgstAmount);
    outward.samt = round2(outward.samt + sign * t.sgstAmount);
    outward.csamt = round2(outward.csamt + sign * (t.cessAmount || 0));
    nil.txval = round2(nil.txval + sign * (t.taxableAmount - taxedVal));
    if (!ctin && inter && pos) {
      const cur = interUnreg.get(pos) || { pos, name: stateName(pos), txval: 0, iamt: 0 };
      cur.txval = round2(cur.txval + sign * taxedVal);
      cur.iamt = round2(cur.iamt + sign * t.igstAmount);
      interUnreg.set(pos, cur);
    }
  };

  for (const inv of invoices) {
    if (!isLive(inv) || inv.isGstEnabled === false || !inRange(toDateKey(inv.invoiceDate), period)) continue;
    addOut(inv, 1, "invoice");
  }
  for (const cn of creditNotes) {
    if (!inRange(toDateKey(cn.voucherDate), period)) continue;
    addOut(cn, -1, "note");
  }
  // Advances: tax on advances received is added to 3.1(a); adjusted ones come off.
  const adv = advanceTables(advances, period, company);
  for (const [tot, sign] of [[adv.atTotals, 1], [adv.txpdTotals, -1]]) {
    outward.txval = round2(outward.txval + sign * tot.txval);
    outward.iamt = round2(outward.iamt + sign * tot.iamt);
    outward.camt = round2(outward.camt + sign * tot.camt);
    outward.samt = round2(outward.samt + sign * tot.samt);
  }
  const addItc = (doc, sign) => {
    const t = invoiceTotals(doc);
    const bucket = doc.reverseCharge ? itcRcm : itc;
    bucket.iamt = round2(bucket.iamt + sign * t.igstAmount);
    bucket.camt = round2(bucket.camt + sign * t.cgstAmount);
    bucket.samt = round2(bucket.samt + sign * t.sgstAmount);
    if (!doc.reverseCharge) itc.csamt = round2(itc.csamt + sign * (t.cessAmount || 0));
    if (doc.reverseCharge) {
      inwardRcm.txval = round2(inwardRcm.txval + sign * t.taxableAmount);
      inwardRcm.iamt = round2(inwardRcm.iamt + sign * t.igstAmount);
      inwardRcm.camt = round2(inwardRcm.camt + sign * t.cgstAmount);
      inwardRcm.samt = round2(inwardRcm.samt + sign * t.sgstAmount);
    }
  };
  for (const p of purchases) if (inRange(toDateKey(p.voucherDate), period)) addItc(p, 1);
  for (const d of debitNotes) if (inRange(toDateKey(d.voucherDate), period)) addItc(d, -1);

  // Forward-charge liability (incl. exports with IGST) is set off against all ITC;
  // reverse-charge tax must be paid in cash.
  const fwd = { igst: round2(outward.iamt + zeroRated.iamt), cgst: outward.camt, sgst: outward.samt };
  const allItc = { igst: round2(itc.iamt + itcRcm.iamt), cgst: round2(itc.camt + itcRcm.camt), sgst: round2(itc.samt + itcRcm.samt) };
  const setOff = setOffItc(fwd, allItc);
  const rcmCash = { igst: inwardRcm.iamt, cgst: inwardRcm.camt, sgst: inwardRcm.samt };
  setOff.rcmCash = rcmCash;
  // Cess credit can only pay cess.
  setOff.cess = { due: outward.csamt, credit: itc.csamt, cash: round2(Math.max(0, outward.csamt - itc.csamt)), carryForward: round2(Math.max(0, itc.csamt - outward.csamt)) };
  setOff.totalCash = round2(setOff.totalCash + rcmCash.igst + rcmCash.cgst + rcmCash.sgst + setOff.cess.cash);

  return { period, outward, zeroRated, nil, rcmOutward, inwardRcm, interUnregistered: [...interUnreg.values()], itc, itcRcm, setOff };
}
