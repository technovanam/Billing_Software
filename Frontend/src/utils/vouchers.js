// Tally-style GST vouchers other than the sales invoice: Credit Note (sales
// return), Purchase and Debit Note (purchase return). They share the invoice's
// item-wise GST engine, so taxes are calculated exactly like a sales bill.
import { GST_VERSION, placeOfSupply, stateName, partyStateCode, taxFieldsForSave, sellerSnapshot, isItemwise, upgradeToItemwise } from "./gst.js";

export const VOUCHER_TYPES = {
  creditNote: {
    key: "creditNote",
    collection: "creditNotes",
    label: "Credit Note",
    plural: "Credit Notes",
    prefix: "CN",
    partyKind: "customer",
    partyLabel: "Customer",
    linkKind: "invoice",
    linkLabel: "Against invoice",
    direction: "sale",
    printTitle: "CREDIT NOTE",
    route: "/credit-notes",
    blurb: "Sales returns and post-sale reductions. Reduces your GST liability and the customer's balance.",
  },
  purchase: {
    key: "purchase",
    collection: "purchases",
    label: "Purchase Bill",
    plural: "Purchases",
    prefix: "PUR",
    partyKind: "supplier",
    partyLabel: "Supplier",
    linkKind: null,
    direction: "purchase",
    printTitle: "PURCHASE VOUCHER",
    route: "/purchases",
    blurb: "Bills from your suppliers. GST paid on them is your input tax credit (ITC).",
  },
  debitNote: {
    key: "debitNote",
    collection: "debitNotes",
    label: "Debit Note",
    plural: "Debit Notes",
    prefix: "DN",
    partyKind: "supplier",
    partyLabel: "Supplier",
    linkKind: "purchase",
    linkLabel: "Against purchase",
    direction: "purchase",
    printTitle: "DEBIT NOTE",
    route: "/debit-notes",
    blurb: "Goods returned to suppliers. Reverses the input tax credit you claimed.",
  },
  // Orders (Tally "order vouchers"): no accounting or stock effect until converted.
  quotation: {
    key: "quotation",
    collection: "quotations",
    label: "Quotation",
    plural: "Quotations",
    prefix: "QT",
    partyKind: "customer",
    partyLabel: "Customer",
    linkKind: null,
    direction: "sale",
    isOrder: true,
    dueLabel: "Valid until",
    printTitle: "QUOTATION",
    route: "/quotations",
    convertTo: ["salesOrder", "invoice"],
    blurb: "Price quotes for customers. Convert an accepted quote into a sales order or an invoice.",
  },
  salesOrder: {
    key: "salesOrder",
    collection: "salesOrders",
    label: "Sales Order",
    plural: "Sales Orders",
    prefix: "SO",
    partyKind: "customer",
    partyLabel: "Customer",
    linkKind: null,
    direction: "sale",
    isOrder: true,
    dueLabel: "Delivery by",
    printTitle: "SALES ORDER",
    route: "/sales-orders",
    convertTo: ["invoice"],
    blurb: "Confirmed customer orders. Convert to an invoice when you bill them.",
  },
  purchaseOrder: {
    key: "purchaseOrder",
    collection: "purchaseOrders",
    label: "Purchase Order",
    plural: "Purchase Orders",
    prefix: "PO",
    partyKind: "supplier",
    partyLabel: "Supplier",
    linkKind: null,
    direction: "purchase",
    isOrder: true,
    dueLabel: "Expected by",
    printTitle: "PURCHASE ORDER",
    route: "/purchase-orders",
    convertTo: ["purchase"],
    blurb: "Orders you place with suppliers. Convert to a purchase bill when the goods and bill arrive.",
  },
};

// Where a converted order lands.
export const CONVERT_LABELS = { salesOrder: "Sales order", invoice: "Invoice", purchase: "Purchase bill" };

// A new voucher of `type` filled from an order/quotation: party, tax treatment and items.
export function voucherFromOrder(type, order, { vouchers = [], company, today = new Date() } = {}) {
  const base = newVoucher(type, { vouchers, today });
  return {
    ...base,
    partyId: order.partyId,
    party: order.party,
    items: itemsFromLinked(order),
    isGstEnabled: order.isGstEnabled !== false,
    isRoundOff: order.isRoundOff !== false,
    ...voucherSupply(type, { company, party: order.party }),
    supplyType: order.supplyType || "REGULAR",
    currency: order.currency || "INR",
    exchangeRate: order.exchangeRate || 1,
    notes: order.notes || "",
    orderRef: orderRefOf(order),
  };
}

export const orderRefOf = (order) => ({ collection: VOUCHER_TYPES[order.voucherType]?.collection || "", id: order.id, number: order.voucherNumber, date: order.voucherDate });

// Invoice-form patch from a quotation / sales order.
export function invoicePatchFromOrder(order) {
  return {
    clientId: order.partyId,
    items: itemsFromLinked(order),
    isGstEnabled: order.isGstEnabled !== false,
    isRoundOff: order.isRoundOff !== false,
    supplyType: order.supplyType || "REGULAR",
    currency: order.currency || "INR",
    exchangeRate: order.exchangeRate || 1,
    poNumber: order.voucherNumber,
    poDate: order.voucherDate,
    orderRef: orderRefOf(order),
  };
}

// Reasons accepted on GST credit/debit notes.
export const NOTE_REASONS = [
  "Sales Return",
  "Purchase Return",
  "Post Sale Discount",
  "Deficiency in Services",
  "Correction in Invoice",
  "Change in POS",
  "Finalization of Provisional Assessment",
  "Others",
];

export function financialYearLabel(today = new Date()) {
  const start = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

// "CN-004/2026-27": next number of this voucher type in the financial year.
export function nextVoucherNumber(vouchers, prefix, today = new Date()) {
  const fy = financialYearLabel(today);
  const re = new RegExp(`^${prefix}-(\\d+)\\/(\\d{4}-\\d{2})$`, "i");
  const max = (vouchers || []).reduce((acc, v) => {
    const m = String(v.voucherNumber || "").match(re);
    return m && m[2] === fy ? Math.max(acc, Number.parseInt(m[1], 10)) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}/${fy}`;
}

const toCode = (code) => (code ? { code, name: stateName(code) } : null);

// CGST+SGST vs IGST for a voucher. Sales-side notes follow the original
// invoice's place of supply; purchases compare the supplier's state with ours.
export function voucherSupply(type, { company, party, linked } = {}) {
  if (type.direction === "purchase") {
    const pos = placeOfSupply(party, company); // supplier -> us
    const ours = partyStateCode(company);
    return { placeOfSupply: toCode(ours || pos.code), isInterState: pos.isInterState };
  }
  if (linked?.placeOfSupply?.code || linked?.isInterState !== undefined) {
    const linkedInter = isItemwise(linked) ? Boolean(linked.isInterState) : Number(linked.igst) > 0 && !(Number(linked.cgst) + Number(linked.sgst));
    return { placeOfSupply: linked.placeOfSupply || toCode(partyStateCode(party) || partyStateCode(company)), isInterState: linkedInter };
  }
  const pos = placeOfSupply(company, party);
  return { placeOfSupply: toCode(pos.code), isInterState: pos.isInterState };
}

// Fresh voucher of a type.
export function newVoucher(type, { vouchers = [], today = new Date() } = {}) {
  const iso = today.toISOString().slice(0, 10);
  return {
    voucherType: type.key,
    voucherNumber: nextVoucherNumber(vouchers, type.prefix, today),
    voucherDate: iso,
    partyId: "",
    party: null,
    linkedId: "",
    linkedNumber: "",
    linkedDate: "",
    reason: type.key === "creditNote" ? "Sales Return" : type.key === "debitNote" ? "Purchase Return" : "",
    supplierBillNumber: "",
    supplierBillDate: "",
    items: [],
    gstVersion: GST_VERSION,
    isGstEnabled: true,
    isRoundOff: true,
    isInterState: false,
    placeOfSupply: null,
    notes: "",
    status: type.isOrder ? "Open" : type.key === "purchase" ? "Unpaid" : "Issued",
    dueDate: "",
    paidAmount: 0,
  };
}

// Items copied from the original bill (returned quantities can then be edited).
export function itemsFromLinked(linked) {
  const src = isItemwise(linked) ? linked : upgradeToItemwise(linked);
  return (src?.items || []).map((it, i) => ({
    id: Date.now() + i,
    productId: it.productId || null,
    description: it.description || it.name || "",
    hsnCode: it.hsnCode || it.hsn || "",
    unit: it.unit || "",
    quantity: Number(it.quantity) || 0,
    rate: Number(it.rate ?? it.price) || 0,
    discount: Number(it.discount) || 0,
    gstRate: Number(it.gstRate) || 0,
    amount: Number(it.taxable ?? it.amount) || 0,
  }));
}

// Attach the original bill: party, place of supply and its items.
export function withLinked(voucher, type, linked, { company, parties = [] } = {}) {
  if (!linked) return { ...voucher, linkedId: "", linkedNumber: "", linkedDate: "" };
  const partyId = linked.partyId || linked.clientId || voucher.partyId;
  const party = linked.party || linked.client || parties.find((p) => p.id === partyId) || voucher.party;
  return {
    ...voucher,
    linkedId: linked.id,
    linkedNumber: linked.voucherNumber || linked.invoiceNumber || "",
    linkedDate: linked.voucherDate || linked.invoiceDate || "",
    partyId,
    party,
    items: itemsFromLinked(linked),
    ...voucherSupply(type, { company, party, linked }),
    // A note follows the original bill's tax treatment.
    reverseCharge: Boolean(linked.reverseCharge),
    supplyType: linked.supplyType || "REGULAR",
    currency: linked.currency || "INR",
    exchangeRate: linked.exchangeRate || 1,
  };
}

export function withParty(voucher, type, party, company) {
  return {
    ...voucher,
    partyId: party?.id || "",
    party: party || null,
    linkedId: "",
    linkedNumber: "",
    linkedDate: "",
    ...voucherSupply(type, { company, party }),
  };
}

// Document written to Firestore.
export function voucherForSave(voucher, company) {
  const base = { ...voucher };
  return {
    ...base,
    ...taxFieldsForSave(base),
    seller: base.seller?.companyName ? base.seller : sellerSnapshot(company),
  };
}

// Problems that stop a voucher from being saved.
export function voucherProblems(voucher, type) {
  const out = [];
  if (!voucher.voucherNumber) out.push("Voucher number");
  if (!voucher.voucherDate) out.push("Date");
  if (!voucher.partyId) out.push(type.partyLabel);
  if (type.linkKind && !voucher.linkedId && voucher.reason !== "Others") out.push(type.linkLabel);
  if (type.key === "purchase" && !voucher.supplierBillNumber) out.push("Supplier bill number");
  if (!(voucher.items || []).some((it) => Number(it.quantity) > 0 && Number(it.rate) > 0)) out.push("At least one item with quantity and rate");
  return out;
}
