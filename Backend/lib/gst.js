// Server copy of the GST engine in Frontend/src/utils/gst.js (CommonJS, so the
// backend can be deployed on its own). test/gst/parity.test.js checks that both
// give identical results — change them together.

const GST_VERSION = 2;

const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

const n = (v) => {
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const normalise = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');

function stateCodeFromGstin(gstin) {
  const code = String(gstin || '').trim().slice(0, 2);
  return /^\d{2}$/.test(code) && STATE_CODES[code] ? code : null;
}

function stateCodeFromName(name) {
  const key = normalise(name);
  if (!key) return null;
  const hit = Object.entries(STATE_CODES).find(([, label]) => normalise(label) === key);
  if (hit) return hit[0];
  const aliases = { orissa: '21', pondicherry: '34', jammuandkashmir: '01', andhra: '37', newdelhi: '07', tamilnadu: '33' };
  return aliases[key] || null;
}

const stateName = (code) => STATE_CODES[code] || '';

function partyStateCode(party) {
  if (!party) return null;
  return (
    stateCodeFromGstin(party.gstin || party.taxId || party.gst) ||
    (party.stateCode && STATE_CODES[party.stateCode] ? party.stateCode : null) ||
    stateCodeFromName(party.state)
  );
}

function placeOfSupply(seller, customer) {
  const sellerCode = partyStateCode(seller);
  const posCode = partyStateCode(customer) || sellerCode;
  return { sellerStateCode: sellerCode, code: posCode, name: stateName(posCode), isInterState: Boolean(sellerCode && posCode && sellerCode !== posCode) };
}

function computeLine(item, { isInterState, isGstEnabled = true, defaultRate = 0 } = {}) {
  const qty = n(item.quantity);
  const rate = n(item.rate ?? item.price);
  const gross = round2(qty * rate);
  const discountPct = Math.min(100, Math.max(0, n(item.discount)));
  const discountAmount = round2((gross * discountPct) / 100);
  const taxable = round2(gross - discountAmount);
  const gstRate = isGstEnabled ? (item.gstRate === undefined || item.gstRate === '' || item.gstRate === null ? n(defaultRate) : n(item.gstRate)) : 0;
  const cessRate = isGstEnabled ? Math.max(0, n(item.cessRate)) : 0;
  const cess = round2((taxable * cessRate) / 100);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (gstRate > 0) {
    if (isInterState) igst = round2((taxable * gstRate) / 100);
    else {
      cgst = round2((taxable * gstRate) / 2 / 100);
      sgst = cgst;
    }
  }
  return { gross, discountPct, discountAmount, taxable, gstRate, cessRate, cgst, sgst, igst, cess, tax: round2(cgst + sgst + igst + cess), total: round2(taxable + cgst + sgst + igst + cess) };
}

function computeInvoice({ items, isInterState = false, isGstEnabled = true, isRoundOff = false, defaultRate = 0, tcsRate = 0 }) {
  const lines = (items || []).map((item) => ({ ...item, ...computeLine(item, { isInterState, isGstEnabled, defaultRate }) }));
  const sum = (key) => round2(lines.reduce((s, l) => s + l[key], 0));
  const taxableAmount = sum('taxable');
  const cgstAmount = sum('cgst');
  const sgstAmount = sum('sgst');
  const igstAmount = sum('igst');
  const cessAmount = sum('cess');
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount + cessAmount);
  const tcsAmount = round2(((taxableAmount + totalTax) * Math.max(0, n(tcsRate))) / 100);
  let total = round2(taxableAmount + totalTax + tcsAmount);
  let roundOffAmount = 0;
  if (isRoundOff) {
    const rounded = Math.round(total);
    roundOffAmount = round2(rounded - total);
    total = rounded;
  }
  const group = (keyOf) => {
    const map = new Map();
    for (const l of lines) {
      const key = keyOf(l);
      const g = map.get(key) || { hsn: l.hsnCode || l.hsn || '', gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      g.taxable = round2(g.taxable + l.taxable);
      g.cgst = round2(g.cgst + l.cgst);
      g.sgst = round2(g.sgst + l.sgst);
      g.igst = round2(g.igst + l.igst);
      g.cess = round2(g.cess + l.cess);
      map.set(key, g);
    }
    return [...map.values()].map((g) => ({ ...g, tax: round2(g.cgst + g.sgst + g.igst + g.cess) }));
  };
  return {
    lines,
    grossAmount: sum('gross'),
    discountAmount: sum('discountAmount'),
    subtotal: taxableAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTax,
    tcsAmount,
    roundOffAmount,
    total,
    taxBreakup: group((l) => String(l.gstRate)).filter((g) => g.gstRate > 0).sort((a, b) => a.gstRate - b.gstRate),
    hsnSummary: group((l) => `${l.hsnCode || l.hsn || '—'}|${l.gstRate}`),
  };
}

// Older single-rate documents: every line gets the old CGST+SGST (or IGST) rate.
function upgradeToItemwise(doc) {
  if (!doc || n(doc.gstVersion) >= GST_VERSION) return doc;
  const igst = n(doc.igst);
  const rate = n(doc.cgst) + n(doc.sgst) || igst;
  return {
    ...doc,
    gstVersion: GST_VERSION,
    isInterState: igst > 0 && n(doc.cgst) + n(doc.sgst) === 0,
    items: (doc.items || doc.products || []).map((it) => ({ ...it, discount: n(it.discount), gstRate: it.gstRate ?? rate })),
  };
}

function sellerSnapshot(profile) {
  if (!profile) return null;
  const bank = profile.bank || {};
  return {
    companyName: profile.companyName || '',
    gstin: String(profile.gstin || '').toUpperCase(),
    address: profile.address || '',
    city: profile.city || '',
    state: profile.state || '',
    stateCode: partyStateCode(profile) || '',
    pincode: profile.pincode || '',
    phone: profile.phone || '',
    email: profile.email || '',
    logoURL: profile.logoURL || '',
    bank: {
      bankName: bank.bankName || '',
      accountName: bank.accountName || '',
      accountNumber: bank.accountNumber || '',
      ifsc: bank.ifsc || '',
      branch: bank.branch || '',
      upiId: bank.upiId || '',
    },
  };
}

// "007/2026-27": next invoice number in the financial year of `date`.
function nextInvoiceNumber(invoices, date = new Date()) {
  const fyStart = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const fy = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const max = (invoices || []).reduce((acc, inv) => {
    const m = String(inv.invoiceNumber || '').match(/(\d+)\/(\d{4}-\d{2})$/);
    return m && m[2] === fy ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `${String(max + 1).padStart(3, '0')}/${fy}`;
}

// Invoice document produced from a recurring profile on its run date.
function invoiceFromRecurringProfile({ profile, customer, sellerProfile, invoiceNumber, runDate }) {
  const up = upgradeToItemwise(profile);
  const discount = n(up.discount);
  const items = (up.items || [])
    .filter((it) => n(it.quantity) > 0)
    .map((it) => ({ ...it, discount: it.discount !== undefined && n(it.discount) ? n(it.discount) : discount }));
  const client = customer || up.client || { name: up.customerName || 'Customer' };
  const legacy = up !== profile; // profile pre-dates item-wise GST
  const pos = placeOfSupply(sellerProfile, client);
  const isInterState = legacy ? up.isInterState : profile.placeOfSupply?.code ? Boolean(profile.isInterState) : pos.isInterState;
  const posCode = profile.placeOfSupply?.code || (isInterState ? partyStateCode(client) : pos.sellerStateCode) || pos.code;
  const isGstEnabled = up.isGstEnabled !== false;
  const t = computeInvoice({ items, isInterState, isGstEnabled, isRoundOff: up.isRoundOff !== false });
  return {
    invoiceNumber,
    invoiceDate: runDate,
    dueDate: runDate,
    clientId: up.customerId || client.id || '',
    customerId: up.customerId || client.id || '',
    customerName: client.name || up.customerName || 'Customer',
    client,
    gstVersion: GST_VERSION,
    isGstEnabled,
    isRoundOff: up.isRoundOff !== false,
    isInterState,
    placeOfSupply: posCode ? { code: posCode, name: stateName(posCode) } : null,
    items: t.lines.map(({ gross, discountPct, tax, total, ...rest }) => ({ ...rest, amount: rest.taxable })), // eslint-disable-line no-unused-vars
    taxableAmount: t.taxableAmount,
    discountAmount: t.discountAmount,
    cgstAmount: t.cgstAmount,
    sgstAmount: t.sgstAmount,
    igstAmount: t.igstAmount,
    totalTax: t.totalTax,
    roundOffAmount: t.roundOffAmount,
    taxBreakup: t.taxBreakup,
    hsnSummary: t.hsnSummary,
    amount: t.total,
    seller: sellerSnapshot(sellerProfile),
    status: 'Unpaid',
    invoiceNotes: up.customerNotes || '',
    termsAndConditions: up.termsAndConditions || '',
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  };
}

module.exports = {
  GST_VERSION,
  STATE_CODES,
  round2,
  stateName,
  stateCodeFromGstin,
  partyStateCode,
  placeOfSupply,
  computeLine,
  computeInvoice,
  upgradeToItemwise,
  sellerSnapshot,
  nextInvoiceNumber,
  invoiceFromRecurringProfile,
};
