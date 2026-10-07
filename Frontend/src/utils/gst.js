// GST engine shared by the invoice form, printed invoice, PDF and reports.
//
// Works like Tally: every line carries its own GST rate (from the product's
// HSN), the place of supply decides CGST+SGST (same state) or IGST (other
// state), and the bill prints an HSN-wise tax summary.
//
// Invoices saved before item-wise GST (no `gstVersion`) keep their original
// maths: one CGST/SGST/IGST percentage applied to the whole subtotal.

import { GST_STATE_CODES } from "../chatbot/gstin.js";

export const GST_VERSION = 2;
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

export const STATES = Object.entries(GST_STATE_CODES)
  .filter(([code]) => code !== "97" && code !== "99")
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const n = (v) => {
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

// Round to paise, avoiding binary float drift (1.005 -> 1.01).
export const round2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;

const normalise = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

export function stateCodeFromGstin(gstin) {
  const code = String(gstin || "").trim().slice(0, 2);
  return /^\d{2}$/.test(code) && GST_STATE_CODES[code] ? code : null;
}

export function stateCodeFromName(name) {
  const key = normalise(name);
  if (!key) return null;
  const hit = Object.entries(GST_STATE_CODES).find(([, label]) => normalise(label) === key);
  if (hit) return hit[0];
  const aliases = { orissa: "21", pondicherry: "34", jammuandkashmir: "01", andhra: "37", newdelhi: "07", tamilnadu: "33" };
  return aliases[key] || null;
}

export const stateName = (code) => (code === "96" ? "Other Country" : GST_STATE_CODES[code] || "");

// State code of a party: GSTIN first (authoritative), then the state field.
export function partyStateCode(party) {
  if (!party) return null;
  return (
    stateCodeFromGstin(party.gstin || party.taxId || party.gst) ||
    (party.stateCode && GST_STATE_CODES[party.stateCode] ? party.stateCode : null) ||
    stateCodeFromName(party.state)
  );
}

// Place of supply for a sale: the customer's state, else the seller's own
// state (an unregistered walk-in buyer is treated as local).
export function placeOfSupply(seller, customer) {
  const sellerCode = partyStateCode(seller);
  const posCode = partyStateCode(customer) || sellerCode;
  return {
    sellerStateCode: sellerCode,
    code: posCode,
    name: stateName(posCode),
    isInterState: Boolean(sellerCode && posCode && sellerCode !== posCode),
  };
}

// One invoice line: taxable value after discount and its tax split.
export function computeLine(item, { isInterState, isGstEnabled = true, defaultRate = 0, zeroRated = false } = {}) {
  const qty = n(item.quantity);
  const rate = n(item.rate ?? item.price);
  const gross = round2(qty * rate);
  const discountPct = Math.min(100, Math.max(0, n(item.discount)));
  const discountAmount = round2((gross * discountPct) / 100);
  const taxable = round2(gross - discountAmount);
  const gstRate = isGstEnabled ? (item.gstRate === undefined || item.gstRate === "" || item.gstRate === null ? n(defaultRate) : n(item.gstRate)) : 0;
  // Compensation cess (tobacco, aerated drinks, motor vehicles…): ad valorem % on taxable value.
  const cessRate = isGstEnabled && !zeroRated ? Math.max(0, n(item.cessRate)) : 0;
  const cess = round2((taxable * cessRate) / 100);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (gstRate > 0 && !zeroRated) {
    if (isInterState) {
      igst = round2((taxable * gstRate) / 100);
    } else {
      cgst = round2((taxable * gstRate) / 2 / 100);
      sgst = cgst;
    }
  }
  return { gross, discountPct, discountAmount, taxable, gstRate, cessRate, cgst, sgst, igst, cess, tax: round2(cgst + sgst + igst + cess), total: round2(taxable + cgst + sgst + igst + cess) };
}

// Whole invoice, item-wise (Tally style).
// taxMode: "normal"; "rcm" = reverse charge (tax shown, paid by the recipient,
// not added to the bill); "zero" = zero-rated export/SEZ supply under LUT
// (rates shown, no tax charged).
// tcsRate: income-tax TCS (section 206C) collected on the bill value incl. GST.
export function computeInvoice({ items, isInterState = false, isGstEnabled = true, isRoundOff = false, defaultRate = 0, taxMode = "normal", tcsRate = 0 }) {
  const zeroRated = taxMode === "zero";
  const lines = (items || []).map((item) => ({ ...item, ...computeLine(item, { isInterState, isGstEnabled, defaultRate, zeroRated }) }));

  const sum = (key) => round2(lines.reduce((s, l) => s + l[key], 0));
  const grossAmount = sum("gross");
  const discountAmount = sum("discountAmount");
  const taxableAmount = sum("taxable");
  const cgstAmount = sum("cgst");
  const sgstAmount = sum("sgst");
  const igstAmount = sum("igst");
  const cessAmount = sum("cess");
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount + cessAmount);
  const reverseCharge = taxMode === "rcm";

  const beforeTcs = round2(taxableAmount + (reverseCharge ? 0 : totalTax));
  const tcsAmount = round2((beforeTcs * Math.max(0, n(tcsRate))) / 100);
  let total = round2(beforeTcs + tcsAmount);
  let roundOffAmount = 0;
  if (isRoundOff) {
    const rounded = Math.round(total);
    roundOffAmount = round2(rounded - total);
    total = rounded;
  }

  // Tax split by rate (for the totals box) and by HSN + rate (for the summary table).
  const group = (keyOf) => {
    const map = new Map();
    for (const l of lines) {
      const key = keyOf(l);
      const g = map.get(key) || { hsn: l.hsnCode || l.hsn || "", gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      g.taxable = round2(g.taxable + l.taxable);
      g.cgst = round2(g.cgst + l.cgst);
      g.sgst = round2(g.sgst + l.sgst);
      g.igst = round2(g.igst + l.igst);
      g.cess = round2(g.cess + l.cess);
      map.set(key, g);
    }
    return [...map.values()].map((g) => ({ ...g, tax: round2(g.cgst + g.sgst + g.igst + g.cess) }));
  };
  const taxBreakup = group((l) => String(l.gstRate))
    .filter((g) => g.gstRate > 0)
    .sort((a, b) => a.gstRate - b.gstRate);
  // Lines still carry their own (pre-RCM) totals; the bill total excludes RCM tax.
  if (reverseCharge) for (const l of lines) l.total = l.taxable;
  const hsnSummary = group((l) => `${l.hsnCode || l.hsn || "—"}|${l.gstRate}`);

  return {
    lines,
    grossAmount,
    discountAmount,
    subtotal: taxableAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTax,
    tcsRate: n(tcsRate),
    tcsAmount,
    roundOffAmount,
    total,
    taxBreakup,
    hsnSummary,
    taxMode,
    reverseCharge,
    zeroRated,
    // Tax actually collected on this bill (0 under reverse charge / LUT).
    taxCharged: reverseCharge || zeroRated ? 0 : totalTax,
  };
}

// Pre-item-wise invoices: one CGST/SGST/IGST % on the whole subtotal.
export function computeLegacyInvoice({ items, cgst, sgst, igst, isGstEnabled, isRoundOff }) {
  const subtotal = (items || []).reduce((s, it) => s + n(it.quantity) * n(it.rate ?? it.price), 0);
  const cgstAmount = isGstEnabled ? (subtotal * n(cgst)) / 100 : 0;
  const sgstAmount = isGstEnabled ? (subtotal * n(sgst)) / 100 : 0;
  const igstAmount = isGstEnabled ? (subtotal * n(igst)) / 100 : 0;
  let total = subtotal + cgstAmount + sgstAmount + igstAmount;
  let roundOffAmount = 0;
  if (isRoundOff) {
    const rounded = Math.round(total);
    roundOffAmount = rounded - total;
    total = rounded;
  }
  const taxBreakup = [];
  const rate = n(cgst) + n(sgst) || n(igst);
  if (isGstEnabled && rate) taxBreakup.push({ gstRate: rate, taxable: subtotal, cgst: cgstAmount, sgst: sgstAmount, igst: igstAmount });
  return {
    lines: (items || []).map((it) => ({ ...it, taxable: n(it.quantity) * n(it.rate ?? it.price), gstRate: rate })),
    grossAmount: subtotal,
    discountAmount: 0,
    subtotal,
    taxableAmount: subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount: 0,
    totalTax: cgstAmount + sgstAmount + igstAmount,
    tcsAmount: 0,
    roundOffAmount,
    total,
    taxBreakup,
    hsnSummary: [],
  };
}

export const isItemwise = (inv) => n(inv?.gstVersion) >= GST_VERSION;

// Supply types (as on the e-invoice): B2B/B2C (regular), exports and SEZ with
// or without payment of IGST, and deemed exports.
export const SUPPLY_TYPES = [
  { value: "REGULAR", label: "Regular (B2B / B2C)" },
  { value: "EXPWP", label: "Export with payment of IGST" },
  { value: "EXPWOP", label: "Export under LUT / bond (no IGST)" },
  { value: "SEZWP", label: "Supply to SEZ with payment of IGST" },
  { value: "SEZWOP", label: "Supply to SEZ under LUT (no IGST)" },
  { value: "DEXP", label: "Deemed export" },
];
export const isExport = (inv) => /^EXPW/.test(inv?.supplyType || "");
export const isSez = (inv) => /^SEZW/.test(inv?.supplyType || "");
// Exports and SEZ supplies are always inter-state (IGST).
export const forcesInterState = (inv) => isExport(inv) || isSez(inv);

export function taxModeOf(inv) {
  if (inv?.reverseCharge) return "rcm";
  if (/WOP$/.test(inv?.supplyType || "")) return "zero";
  return "normal";
}

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY", "SAR", "CNY"];

// Rupees per unit of the invoice currency (1 for INR).
export function inrFactor(inv) {
  const cur = inv?.currency || "INR";
  if (cur === "INR") return 1;
  const r = n(inv?.exchangeRate);
  return r > 0 ? r : 1;
}

// Totals for any saved or in-progress invoice, choosing the right maths.
export function invoiceTotals(inv) {
  const items = inv?.items || inv?.products || [];
  const isGstEnabled = inv?.isGstEnabled !== false;
  if (isItemwise(inv)) {
    return computeInvoice({
      items,
      isInterState: forcesInterState(inv) || Boolean(inv.isInterState),
      isGstEnabled,
      isRoundOff: Boolean(inv.isRoundOff),
      taxMode: taxModeOf(inv),
      tcsRate: inv.tcsRate,
    });
  }
  return computeLegacyInvoice({ items, cgst: inv?.cgst, sgst: inv?.sgst, igst: inv?.igst, isGstEnabled, isRoundOff: Boolean(inv?.isRoundOff) });
}

const MONEY_KEYS = ["gross", "discountAmount", "taxable", "cgst", "sgst", "igst", "cess", "tax", "total"];
const TOTAL_KEYS = ["grossAmount", "discountAmount", "subtotal", "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "cessAmount", "tcsAmount", "totalTax", "roundOffAmount", "total", "taxCharged"];

// Totals converted to rupees (GST, books and returns are always in INR).
export function invoiceTotalsInr(inv) {
  const t = invoiceTotals(inv);
  const f = inrFactor(inv);
  if (f === 1) return t;
  const scale = (o, keys) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, keys.includes(k) && typeof v === "number" ? round2(v * f) : v]));
  const groupKeys = ["taxable", "cgst", "sgst", "igst", "cess", "tax"];
  const out = scale(t, TOTAL_KEYS);
  out.lines = t.lines.map((l) => ({ ...scale(l, MONEY_KEYS), rate: round2(n(l.rate ?? l.price) * f) }));
  out.taxBreakup = t.taxBreakup.map((g) => scale(g, groupKeys));
  out.hsnSummary = t.hsnSummary.map((g) => scale(g, groupKeys));
  return out;
}

// Fields written onto the invoice document so reports and GSTR exports never
// have to recompute tax.
export function taxFieldsForSave(inv) {
  const t = invoiceTotals(inv);
  const inr = invoiceTotalsInr(inv);
  const foreign = inrFactor(inv) !== 1;
  return {
    gstVersion: inv?.gstVersion,
    items: isItemwise(inv)
      ? t.lines.map((l) => ({
          ...Object.fromEntries(Object.entries(l).filter(([k]) => !["gross", "discountPct", "tax", "total"].includes(k))),
          discountAmount: l.discountAmount,
          amount: l.taxable,
        }))
      : inv.items,
    // Stored in rupees; the invoice-currency total is kept alongside.
    taxableAmount: inr.taxableAmount,
    discountAmount: inr.discountAmount,
    cgstAmount: inr.cgstAmount,
    sgstAmount: inr.sgstAmount,
    igstAmount: inr.igstAmount,
    cessAmount: inr.cessAmount || 0,
    tcsAmount: inr.tcsAmount || 0,
    totalTax: inr.totalTax,
    taxCharged: inr.taxCharged ?? inr.totalTax,
    roundOffAmount: inr.roundOffAmount,
    taxBreakup: inr.taxBreakup,
    hsnSummary: inr.hsnSummary,
    amount: inr.total,
    ...(foreign ? { foreignAmount: t.total } : {}),
  };
}

// The seller's details as printed on a bill. Saved on each invoice so an old
// bill still shows the address/GSTIN/bank that applied when it was issued.
export function sellerSnapshot(profile) {
  if (!profile) return null;
  const bank = profile.bank || {};
  return {
    companyName: profile.companyName || "",
    gstin: (profile.gstin || "").toUpperCase(),
    address: profile.address || "",
    city: profile.city || "",
    state: profile.state || "",
    stateCode: partyStateCode(profile) || "",
    pincode: profile.pincode || "",
    phone: profile.phone || "",
    email: profile.email || "",
    logoURL: profile.logoURL || "",
    bank: {
      bankName: bank.bankName || "",
      accountName: bank.accountName || "",
      accountNumber: bank.accountNumber || "",
      ifsc: bank.ifsc || "",
      branch: bank.branch || "",
      upiId: bank.upiId || "",
    },
  };
}

// Seller to print: the invoice's saved snapshot, else the current profile.
export function sellerFor(invoice, profile) {
  const snap = invoice?.seller;
  return snap?.companyName ? snap : sellerSnapshot(profile) || {};
}

export function sellerAddressLines(seller) {
  const s = seller || {};
  const cityLine = [s.city, s.state, s.pincode].filter(Boolean).join(", ").replace(/, (\d{6})$/, " - $1");
  return [s.address, cityLine].filter(Boolean);
}

// Turn a pre-item-wise invoice into an item-wise one with the same tax:
// every line gets the bill's old rate, and IGST bills become inter-state.
export function upgradeToItemwise(inv) {
  if (!inv || isItemwise(inv)) return inv;
  const igst = n(inv.igst);
  const rate = n(inv.cgst) + n(inv.sgst) || igst;
  return {
    ...inv,
    gstVersion: GST_VERSION,
    isInterState: igst > 0 && n(inv.cgst) + n(inv.sgst) === 0,
    items: (inv.items || inv.products || []).map((it) => ({
      ...it,
      discount: n(it.discount),
      gstRate: it.gstRate ?? rate,
    })),
  };
}

// Legal statements printed on special supplies.
export function supplyNotes(inv) {
  const notes = [];
  const st = inv?.supplyType || "REGULAR";
  if (st === "EXPWOP") notes.push("Supply meant for export under LUT / bond without payment of IGST.");
  if (st === "EXPWP") notes.push("Supply meant for export on payment of IGST.");
  if (st === "SEZWOP") notes.push("Supply to SEZ unit / developer for authorised operations under LUT without payment of IGST.");
  if (st === "SEZWP") notes.push("Supply to SEZ unit / developer for authorised operations on payment of IGST.");
  if (st === "DEXP") notes.push("Deemed export supply.");
  if (inv?.reverseCharge) notes.push("Tax is payable on reverse charge basis by the recipient.");
  return notes;
}

export const supplyTypeLabel = (inv) => SUPPLY_TYPES.find((t) => t.value === (inv?.supplyType || "REGULAR"))?.label || "Regular";
