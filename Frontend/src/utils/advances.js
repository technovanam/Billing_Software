// Advance receipts (GST on advances). Money received before the invoice is
// issued: for services GST is due on the advance itself (section 13), shown in
// GSTR-1 table 11A ("at") and reversed in table 11B ("txpd") when the advance
// is adjusted against the invoice. A receipt voucher (rule 50) is issued.
//
// An advance is stored like a one-line voucher so the GST engine works out the
// tax: the amount received is treated as tax-inclusive.
import { GST_VERSION, invoiceTotalsInr as totals, placeOfSupply, partyStateCode, round2, stateName } from "./gst.js";
import { toDateKey } from "./accounting.js";
import { nextVoucherNumber } from "./vouchers.js";

export const ADVANCE_TYPE = {
  key: "advance",
  collection: "advanceReceipts",
  label: "Receipt Voucher",
  plural: "Advance Receipts",
  prefix: "RV",
  partyKind: "customer",
  partyLabel: "Customer",
  printTitle: "RECEIPT VOUCHER",
};

// Gross received -> one tax-inclusive line.
export function advanceItems(gross, gstRate, { description = "Advance received against supply", hsnCode = "" } = {}) {
  const rate = Math.max(0, Number(gstRate) || 0);
  const taxable = round2((Number(gross) || 0) * 100 / (100 + rate));
  return [{ id: 1, description, hsnCode, quantity: 1, rate: taxable, gstRate: rate, amount: taxable }];
}

export function newAdvance({ advances = [], today = new Date() } = {}) {
  return {
    voucherType: "advance",
    voucherNumber: nextVoucherNumber(advances, ADVANCE_TYPE.prefix, today),
    voucherDate: today.toISOString().slice(0, 10),
    partyId: "",
    party: null,
    received: "",
    gstRate: 18,
    hsnCode: "",
    method: "Bank Transfer",
    account: "",
    transactionId: "",
    notes: "",
    gstVersion: GST_VERSION,
    isGstEnabled: true,
    isRoundOff: false,
    isInterState: false,
    placeOfSupply: null,
    items: [],
    status: "Open",
  };
}

// Document to save: items and place of supply from the entered amount and customer.
export function advanceForSave(adv, company) {
  const pos = placeOfSupply(company, adv.party);
  const items = advanceItems(adv.received, adv.gstRate, { hsnCode: adv.hsnCode });
  const doc = { ...adv, items, isInterState: pos.isInterState, placeOfSupply: pos.code ? { code: pos.code, name: stateName(pos.code) } : null };
  const t = totals(doc);
  return { ...doc, received: Number(adv.received) || 0, taxableAmount: t.taxableAmount, cgstAmount: t.cgstAmount, sgstAmount: t.sgstAmount, igstAmount: t.igstAmount, totalTax: t.totalTax, amount: t.total };
}

const inRange = (d, p) => d && d >= p.from && d <= p.to;

// GSTR-1 table 11A (advances received this period and not adjusted in it) and
// 11B (advances of earlier periods adjusted this period).
export function advanceTables(advances = [], period, company) {
  const at = new Map();
  const txpd = new Map();
  const add = (map, a) => {
    const t = totals(a);
    const pos = a.placeOfSupply?.code || partyStateCode(a.party) || partyStateCode(company) || "";
    const inter = Boolean(a.isInterState);
    const key = `${pos}|${inter}`;
    const row = map.get(key) || { pos, sply_ty: inter ? "INTER" : "INTRA", itms: [] };
    for (const b of t.taxBreakup) {
      let it = row.itms.find((x) => x.rt === b.gstRate);
      if (!it) {
        it = inter ? { rt: b.gstRate, ad_amt: 0, iamt: 0, csamt: 0 } : { rt: b.gstRate, ad_amt: 0, camt: 0, samt: 0, csamt: 0 };
        row.itms.push(it);
      }
      it.ad_amt = round2(it.ad_amt + b.taxable);
      if (inter) it.iamt = round2(it.iamt + b.igst);
      else {
        it.camt = round2(it.camt + b.cgst);
        it.samt = round2(it.samt + b.sgst);
      }
    }
    map.set(key, row);
  };
  for (const a of advances) {
    const got = toDateKey(a.voucherDate);
    const adj = toDateKey(a.adjustedDate);
    if (inRange(got, period) && !inRange(adj, period)) add(at, a);
    if (inRange(adj, period) && got < period.from) add(txpd, a);
  }
  const rows = (m) => [...m.values()].filter((r) => r.itms.length);
  const sumOf = (list) => {
    const out = { txval: 0, iamt: 0, camt: 0, samt: 0 };
    for (const r of list)
      for (const it of r.itms) {
        out.txval = round2(out.txval + it.ad_amt);
        out.iamt = round2(out.iamt + (it.iamt || 0));
        out.camt = round2(out.camt + (it.camt || 0));
        out.samt = round2(out.samt + (it.samt || 0));
      }
    return out;
  };
  const atRows = rows(at);
  const txpdRows = rows(txpd);
  return { at: atRows, txpd: txpdRows, atTotals: sumOf(atRows), txpdTotals: sumOf(txpdRows) };
}

// Customer's open (unadjusted) advances.
export const openAdvances = (advances = [], partyId) => advances.filter((a) => !a.adjustedInvoiceId && a.status !== "Cancelled" && (!partyId || a.partyId === partyId));
