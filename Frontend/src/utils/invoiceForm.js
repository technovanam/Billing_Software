// State helpers for the invoice form, shared by Create Invoice and Edit Invoice
// so both build exactly the same document.
import { GST_VERSION, computeLine, placeOfSupply, stateName, partyStateCode, sellerSnapshot, taxFieldsForSave, upgradeToItemwise, isExport, forcesInterState } from "./gst.js";
import { priceFor } from "./priceLists.js";

export function newInvoiceItem(defaultGstRate = 18) {
  return {
    id: Date.now() + Math.random(),
    productId: null,
    description: "",
    hsnCode: "",
    unit: "",
    quantity: 1,
    rate: 0,
    discount: 0,
    gstRate: defaultGstRate,
    amount: 0,
  };
}

// Fields every new invoice starts with for item-wise GST.
export const ITEMWISE_DEFAULTS = { gstVersion: GST_VERSION, isInterState: false, placeOfSupply: null };

export function applyItemChange(item, field, value) {
  const next = { ...item, [field]: value };
  next.amount = computeLine(next, { isInterState: false }).taxable;
  return next;
}

// Fill a line from a catalogue product (rate, HSN, unit, GST rate).
export function applyProduct(item, product, defaultGstRate = 18, priceList = null) {
  const rate = priceFor(product, priceList);
  return applyItemChange(
    {
      ...item,
      description: product.name,
      hsnCode: product.hsn || "",
      unit: product.unit || item.unit || "",
      productId: product.id || null,
      gstRate: product.gstRate ?? defaultGstRate,
      cessRate: Number(product.cessRate) || 0,
      ...(product.trackBatches ? { trackBatches: true } : {}),
    },
    "rate",
    rate
  );
}

function supply(seller, customer, overrideCode) {
  const pos = placeOfSupply(seller, customer);
  const code = overrideCode || pos.code;
  const sellerCode = pos.sellerStateCode;
  return {
    placeOfSupply: code ? { code, name: stateName(code) } : null,
    isInterState: Boolean(sellerCode && code && sellerCode !== code),
  };
}

// Exports keep POS 96; SEZ supplies keep IGST but take the SEZ unit's state.
function keepSupplyType(invoice, next) {
  if (isExport(invoice)) return { ...next, isInterState: true, placeOfSupply: { code: "96", name: "Other Country" } };
  if (forcesInterState(invoice)) return { ...next, isInterState: true };
  return next;
}

export function withClient(invoice, client, seller) {
  if (!client) return keepSupplyType(invoice, { ...invoice, clientId: "", client: null, ...supply(seller, null) });
  return keepSupplyType(invoice, { ...invoice, clientId: client.id, client, ...supply(seller, client) });
}

export function withPlaceOfSupply(invoice, code, seller) {
  return keepSupplyType(invoice, { ...invoice, ...supply(seller, invoice.client, code) });
}

// Ready an existing invoice for the form. Older invoices become item-wise but
// keep the CGST/SGST-or-IGST choice they were saved with, so totals don't move.
export function prepareForEdit(invoice, seller) {
  const copy = JSON.parse(JSON.stringify(invoice));
  const wasLegacy = copy.gstVersion === undefined;
  const up = upgradeToItemwise(copy);
  if (up.placeOfSupply?.code) return up;
  const auto = supply(seller, up.client);
  if (!wasLegacy || auto.isInterState === up.isInterState) return { ...up, ...auto };
  const sellerCode = partyStateCode(seller);
  const code = up.isInterState ? partyStateCode(up.client) : sellerCode;
  return { ...up, placeOfSupply: code ? { code, name: stateName(code) } : null };
}

// The document written to Firestore: tax amounts, HSN summary and the seller
// details stored on the invoice so reports and reprints never recompute them.
export function invoiceForSave(invoice, seller, extra = {}) {
  const base = { ...invoice, ...extra };
  return {
    ...base,
    ...taxFieldsForSave(base),
    seller: base.seller?.companyName ? base.seller : sellerSnapshot(seller),
  };
}

export const sellerHasState = (seller) => Boolean(partyStateCode(seller));

// Change the supply type. Exports and SEZ supplies are inter-state (IGST);
// exports have place of supply 96 (outside India) and no reverse charge.
export function withSupplyType(invoice, supplyType, seller) {
  const next = { ...invoice, supplyType };
  if (forcesInterState(next)) {
    next.isInterState = true;
    next.reverseCharge = false;
    if (isExport(next)) next.placeOfSupply = { code: "96", name: "Other Country" };
    return next;
  }
  next.currency = "INR";
  next.exchangeRate = 1;
  return { ...next, ...supply(seller, next.client) };
}
