// E-invoice (IRP schema 1.1) and e-way bill (NIC bulk-upload JSON) payloads
// built from a saved invoice. The e-way bill file can be uploaded on
// ewaybillgst.gov.in today; the e-invoice payload is what a GSP sends to the IRP.
import { invoiceTotalsInr as invoiceTotals, isItemwise, upgradeToItemwise, partyStateCode, sellerFor, round2, isExport } from "./gst.js";

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Units -> GST Unit Quantity Codes (UQC).
const UQC = {
  piece: "PCS", pieces: "PCS", pcs: "PCS", nos: "NOS", no: "NOS", number: "NOS", box: "BOX", boxes: "BOX",
  kilogram: "KGS", kg: "KGS", kgs: "KGS", gram: "GMS", g: "GMS", gms: "GMS", meter: "MTR", metre: "MTR", m: "MTR", mtr: "MTR",
  litre: "LTR", liter: "LTR", l: "LTR", ltr: "LTR", bag: "BAG", bags: "BAG", dozen: "DOZ", set: "SET", sets: "SET",
  pair: "PRS", roll: "ROL", ton: "TON", tonne: "TON", "sq ft": "SQF", sqft: "SQF", "sq m": "SQM", unit: "UNT", units: "UNT", hour: "OTH", mile: "OTH",
};
export const uqcFor = (unit) => UQC[String(unit || "").trim().toLowerCase()] || "OTH";

const ddmmyyyy = (v) => {
  const iso = typeof v === "string" ? v.slice(0, 10) : v?.toDate ? v.toDate().toISOString().slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};
const pin = (v) => {
  const p = String(v || "").replace(/\D/g, "");
  return p.length === 6 ? Number(p) : null;
};
const isService = (hsn) => String(hsn || "").startsWith("99");
const gstinOf = (party) => String(party?.gstin || party?.taxId || party?.gst || "").trim().toUpperCase();
const cityFromAddress = (address) => String(address || "").split(",").map((x) => x.trim()).filter(Boolean).slice(-1)[0] || "";

function prepared(invoice) {
  const inv = isItemwise(invoice) ? invoice : upgradeToItemwise(invoice);
  return { inv, t: invoiceTotals(inv) };
}

// IRP e-invoice JSON (INV-01, version 1.1). `docType`: INV | CRN | DBN.
export function buildEinvoicePayload(invoice, profile, { docType = "INV" } = {}) {
  const { inv, t } = prepared(invoice);
  const seller = sellerFor(invoice, profile);
  const buyer = invoice.client || invoice.party || {};
  const exportBill = isExport(inv);
  const supTyp = ["EXPWP", "EXPWOP", "SEZWP", "SEZWOP", "DEXP"].includes(inv.supplyType) ? inv.supplyType : "B2B";
  // Exports go to an unregistered overseas buyer: GSTIN "URP", state/POS 96.
  const buyerGstin = exportBill ? "URP" : gstinOf(buyer);
  const sellerState = seller.stateCode || partyStateCode(seller);
  const buyerState = exportBill ? "96" : partyStateCode({ ...buyer, gstin: buyerGstin });
  const pos = exportBill ? "96" : inv.placeOfSupply?.code || buyerState || sellerState;
  const problems = [];

  if (!GSTIN_RE.test(seller.gstin || "")) problems.push("Your GSTIN is missing or invalid (Settings → Business).");
  if (!pin(seller.pincode)) problems.push("Your 6-digit pincode is missing (Settings → Business).");
  if (!seller.address) problems.push("Your address is missing (Settings → Business).");
  if (!exportBill && !GSTIN_RE.test(buyerGstin)) problems.push("E-invoice is only for registered buyers — the customer has no valid GSTIN (B2C bills don't need an IRN).");
  if (!exportBill && !pin(buyer.pincode) && !pin(String(buyer.address || "").match(/\b\d{6}\b/)?.[0])) problems.push("Customer's 6-digit pincode is missing — add it to their address.");
  if (exportBill && !inv.countryCode) problems.push("Export: add the buyer's country code (e.g. US) on the invoice.");
  t.lines.forEach((l, i) => {
    const hsn = String(l.hsnCode || l.hsn || "");
    if (!/^\d{4,8}$/.test(hsn)) problems.push(`Line ${i + 1}: HSN/SAC must be 4–8 digits.`);
  });
  if (inv.isGstEnabled === false) problems.push("GST is switched off on this bill.");

  const buyerPin = exportBill ? 999999 : pin(buyer.pincode) || pin(String(buyer.address || "").match(/\b\d{6}\b/)?.[0]);
  const payload = {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: supTyp, RegRev: inv.reverseCharge ? "Y" : "N", EcmGstin: null, IgstOnIntra: "N" },
    DocDtls: { Typ: docType, No: String(invoice.invoiceNumber || invoice.voucherNumber || "").slice(0, 16), Dt: ddmmyyyy(invoice.invoiceDate || invoice.voucherDate) },
    SellerDtls: {
      Gstin: seller.gstin,
      LglNm: seller.companyName,
      TrdNm: seller.companyName,
      Addr1: String(seller.address || "").slice(0, 100),
      Loc: seller.city || cityFromAddress(seller.address),
      Pin: pin(seller.pincode),
      Stcd: sellerState,
      Ph: String(seller.phone || "").replace(/\D/g, "").slice(-12) || null,
      Em: seller.email || null,
    },
    BuyerDtls: {
      Gstin: buyerGstin,
      LglNm: buyer.companyName || buyer.name || "",
      TrdNm: buyer.name || buyer.companyName || "",
      Pos: pos,
      Addr1: String(buyer.address || "").slice(0, 100),
      Loc: buyer.city || cityFromAddress(buyer.address),
      Pin: buyerPin,
      Stcd: buyerState,
      Ph: String(buyer.phone || buyer.mobile || "").replace(/\D/g, "").slice(-12) || null,
      Em: buyer.email || null,
    },
    ItemList: t.lines.map((l, i) => ({
      SlNo: String(i + 1),
      PrdDesc: String(l.description || l.name || "").slice(0, 300),
      IsServc: isService(l.hsnCode || l.hsn) ? "Y" : "N",
      HsnCd: String(l.hsnCode || l.hsn || ""),
      Qty: Number(l.quantity) || 0,
      Unit: uqcFor(l.unit),
      UnitPrice: round2(Number(l.rate ?? l.price) || 0),
      TotAmt: l.gross,
      Discount: l.discountAmount,
      AssAmt: l.taxable,
      GstRt: l.gstRate,
      IgstAmt: l.igst,
      CgstAmt: l.cgst,
      SgstAmt: l.sgst,
      CesRt: l.cessRate || 0,
      CesAmt: l.cess || 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: l.total,
    })),
    ValDtls: {
      AssVal: t.taxableAmount,
      CgstVal: t.cgstAmount,
      SgstVal: t.sgstAmount,
      IgstVal: t.igstAmount,
      CesVal: t.cessAmount || 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: t.tcsAmount || 0,
      RndOffAmt: t.roundOffAmount,
      TotInvVal: t.total,
    },
  };
  if (exportBill) {
    payload.ExpDtls = {
      ShipBNo: inv.shippingBillNo || null,
      ShipBDt: inv.shippingBillDate ? ddmmyyyy(inv.shippingBillDate) : null,
      Port: inv.portCode || null,
      RefClm: "N",
      ForCur: inv.currency && inv.currency !== "INR" ? inv.currency : null,
      CntCode: (inv.countryCode || "").toUpperCase() || null,
    };
  }
  return { payload, problems };
}

// NIC e-way bill bulk-upload JSON (one bill). Transport details are optional
// here; Part-B (vehicle) can be added on the portal.
export function buildEwayBillJson(invoice, profile, transport = {}) {
  const { inv, t } = prepared(invoice);
  const seller = sellerFor(invoice, profile);
  const buyer = invoice.client || {};
  const buyerGstin = gstinOf(buyer);
  const sellerState = Number(seller.stateCode || partyStateCode(seller)) || null;
  const buyerState = Number(partyStateCode({ ...buyer, gstin: buyerGstin }) || inv.placeOfSupply?.code) || sellerState;
  const problems = [];
  if (!GSTIN_RE.test(seller.gstin || "")) problems.push("Your GSTIN is missing or invalid (Settings → Business).");
  if (!pin(seller.pincode)) problems.push("Your 6-digit pincode is missing (Settings → Business).");
  const buyerPin = pin(buyer.pincode) || pin(String(buyer.address || "").match(/\b\d{6}\b/)?.[0]);
  if (!buyerPin) problems.push("Customer's 6-digit pincode is missing — add it to their address.");
  if (t.total < 50000) problems.push("Note: an e-way bill is generally needed only when the consignment value exceeds ₹50,000.");
  const goods = t.lines.filter((l) => !isService(l.hsnCode || l.hsn));
  if (!goods.length) problems.push("This bill has only services (SAC 99…) — no e-way bill is needed.");
  const main = [...goods].sort((a, b) => b.taxable - a.taxable)[0];

  const bill = {
    userGstin: seller.gstin,
    supplyType: "O",
    subSupplyType: 1,
    subSupplyDesc: "",
    docType: "INV",
    docNo: String(invoice.invoiceNumber || "").slice(0, 16),
    docDate: ddmmyyyy(invoice.invoiceDate),
    transType: 1,
    fromGstin: seller.gstin,
    fromTrdName: seller.companyName,
    fromAddr1: String(seller.address || "").slice(0, 120),
    fromAddr2: "",
    fromPlace: seller.city || cityFromAddress(seller.address),
    fromPincode: pin(seller.pincode),
    fromStateCode: sellerState,
    actFromStateCode: sellerState,
    toGstin: GSTIN_RE.test(buyerGstin) ? buyerGstin : "URP",
    toTrdName: buyer.companyName || buyer.name || "",
    toAddr1: String(buyer.address || "").slice(0, 120),
    toAddr2: "",
    toPlace: buyer.city || cityFromAddress(buyer.address),
    toPincode: buyerPin,
    toStateCode: buyerState,
    actToStateCode: buyerState,
    totalValue: round2(goods.reduce((s, l) => s + l.taxable, 0)),
    cgstValue: round2(goods.reduce((s, l) => s + l.cgst, 0)),
    sgstValue: round2(goods.reduce((s, l) => s + l.sgst, 0)),
    igstValue: round2(goods.reduce((s, l) => s + l.igst, 0)),
    cessValue: 0,
    cessNonAdvolValue: 0,
    otherValue: t.roundOffAmount,
    totInvValue: t.total,
    transMode: transport.mode || 1,
    transDistance: String(transport.distance || 0),
    transporterName: transport.transporterName || "",
    transporterId: transport.transporterId || "",
    transDocNo: transport.docNo || "",
    transDocDate: transport.docDate ? ddmmyyyy(transport.docDate) : "",
    vehicleNo: String(transport.vehicleNo || invoice.vehicleNumber || "").replace(/\s|-/g, "").toUpperCase(),
    vehicleType: "R",
    mainHsnCode: Number(main?.hsnCode || main?.hsn) || null,
    itemList: goods.map((l, i) => ({
      itemNo: i + 1,
      productName: String(l.description || "").slice(0, 100),
      productDesc: String(l.description || "").slice(0, 100),
      hsnCode: Number(l.hsnCode || l.hsn) || null,
      quantity: Number(l.quantity) || 0,
      qtyUnit: uqcFor(l.unit),
      taxableAmount: l.taxable,
      sgstRate: inv.isInterState ? 0 : l.gstRate / 2,
      cgstRate: inv.isInterState ? 0 : l.gstRate / 2,
      igstRate: inv.isInterState ? l.gstRate : 0,
      cessRate: 0,
      cessNonAdvol: 0,
    })),
  };
  return { json: { version: "1.0.0621", billLists: [bill] }, problems };
}
