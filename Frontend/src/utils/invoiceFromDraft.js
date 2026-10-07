// Turns an AI command draft into the same invoice document the Create Invoice
// form saves, so a bill made from the chat looks exactly like a manual one.
import { calculateInvoiceTotals } from "./invoiceTotals";
import { GST_VERSION, placeOfSupply, taxFieldsForSave, sellerSnapshot } from "./gst.js";

const DECLARATION =
  "We declare that this invoice shows the actual price of the goods Described and that all Particulars are true and correct.";

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// "007/2026-27": next number in the current financial year (April to March).
export function nextInvoiceNumber(allInvoices, today = new Date()) {
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fy = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const max = (allInvoices || []).reduce((acc, inv) => {
    const match = String(inv.invoiceNumber || "").match(/(\d+)\/(\d{4}-\d{2})$/);
    return match && match[2] === fy ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
  }, 0);
  return `${String(max + 1).padStart(3, "0")}/${fy}`;
}

// Same line shape the form uses when a product is picked manually.
export function draftToInvoiceItems(draft, defaultGstRate = 18) {
  return (draft?.items || [])
    .filter((it) => it.status === "matched" && it.qty > 0)
    .map((it, idx) => {
      const rate = it.product.pricePaise / 100;
      return {
        id: Date.now() + idx,
        productId: it.product.id,
        description: it.product.name,
        hsnCode: it.product.hsn,
        quantity: it.qty,
        unit: it.product.unit || "",
        rate,
        discount: 0,
        gstRate: it.product.gstRate ?? defaultGstRate,
        amount: it.qty * rate,
      };
    });
}

// GST / round-off switches saved from the Create Invoice page.
export function invoiceTaxSettings(settings) {
  const value = settings?.systemSettings?.value || {};
  const features = value.systemFeatures || {};
  const defaultGstRate = Number(value.systemConfig?.defaultGstRate ?? 18);
  return {
    gstVersion: GST_VERSION,
    isGstEnabled: features.gstCalculation ?? true,
    isRoundOff: features.roundOff ?? true,
    defaultGstRate: Number.isFinite(defaultGstRate) ? defaultGstRate : 18,
  };
}

// CGST+SGST or IGST for this customer, from the seller's and customer's states.
function supplyFields(seller, customer) {
  const pos = placeOfSupply(seller, customer);
  return {
    isInterState: pos.isInterState,
    placeOfSupply: pos.code ? { code: pos.code, name: pos.name } : null,
  };
}

export function draftTotals(draft, settings, seller = null, customer = null) {
  const tax = invoiceTaxSettings(settings);
  return calculateInvoiceTotals({ items: draftToInvoiceItems(draft, tax.defaultGstRate), ...tax, ...supplyFields(seller, customer) });
}

// The invoice document to pass to addInvoice(). `customer` is the full customer
// record, `seller` the business's company profile.
export function buildInvoiceFromDraft({ draft, customer, allInvoices, settings, seller = null, today = new Date() }) {
  const { defaultGstRate, ...tax } = invoiceTaxSettings(settings);
  const items = draftToInvoiceItems(draft, defaultGstRate);
  const base = { items, ...tax, ...supplyFields(seller, customer) };
  const due = new Date(today);
  due.setDate(due.getDate() + (Number(draft.dueInDays) || 0));

  return {
    invoiceNumber: nextInvoiceNumber(allInvoices, today),
    invoiceDate: isoDate(today),
    dueDate: isoDate(due),
    poNumber: "",
    poDate: "",
    dcNumber: "",
    dcDate: "",
    clientId: customer.id,
    client: customer,
    ...base,
    ...taxFieldsForSave(base),
    seller: sellerSnapshot(seller),
    status: "Unpaid",
    declaration: DECLARATION,
    isAutoInvoice: true,
    invoiceNotes: draft.notes || "",
    source: "AI Chat",
  };
}

// "DC-004/2026-27": next delivery challan number, as the challan form numbers them.
export function nextChallanNumber(allChallans, today = new Date()) {
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fy = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const max = (allChallans || []).reduce((acc, c) => {
    const m = String(c.challanNumber || c.dcNumber || "").match(/DC-(\d+)\/(\d{4}-\d{2})/i);
    return m && m[2] === fy ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `DC-${String(max + 1).padStart(3, "0")}/${fy}`;
}

// The challan document the Create Delivery Challan form saves.
export function buildChallanFromDraft({ draft, customer, allChallans, settings, seller = null, today = new Date() }) {
  const { defaultGstRate, ...tax } = invoiceTaxSettings(settings);
  const items = draftToInvoiceItems(draft, defaultGstRate);
  const base = { items, ...tax, ...supplyFields(seller, customer), isRoundOff: false };
  const number = nextChallanNumber(allChallans, today);
  return {
    challanNumber: number,
    dcNumber: number,
    challanDate: isoDate(today),
    referenceNumber: "",
    poNumber: "",
    poDate: "",
    challanType: "Others",
    vehicleNumber: "",
    clientId: customer.id,
    client: customer,
    ...base,
    ...taxFieldsForSave(base),
    seller: sellerSnapshot(seller),
    status: "Sent",
    declaration: "We declare that this delivery challan shows the actual price of the goods Described and that all Particulars are true and correct.",
    notes: draft.notes || "",
    invoiceNotes: "",
    source: "AI Chat",
  };
}
