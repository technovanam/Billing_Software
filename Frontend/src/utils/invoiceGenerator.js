import { invoiceTotals, isItemwise, upgradeToItemwise, sellerFor, sellerAddressLines, partyStateCode, stateName, supplyNotes, supplyTypeLabel, isExport, inrFactor } from "./gst.js";

export const convertToWords = (num) => {
  if (num === 0) return "Zero";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const inWords = (n) => {
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else {
      str += a[n];
    }
    return str.trim();
  };

  let number = Math.floor(num);
  const fraction = Math.round((num - number) * 100);
  let words = "";

  if (number > 9999999) {
    words += inWords(Math.floor(number / 10000000)) + " Crore ";
    number %= 10000000;
  }
  if (number > 99999) {
    words += inWords(Math.floor(number / 100000)) + " Lakh ";
    number %= 100000;
  }
  if (number > 999) {
    words += inWords(Math.floor(number / 1000)) + " Thousand ";
    number %= 1000;
  }
  if (number > 0) {
    words += inWords(number);
  }

  if (fraction > 0) {
    words += " and " + inWords(fraction) + " Paise";
  }

  return words.trim() + " Only";
};


const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmt = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateVal) => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") return dateVal;
  if (dateVal?.toDate) return dateVal.toDate().toLocaleDateString("en-GB");
  if (dateVal instanceof Date) return dateVal.toLocaleDateString("en-GB");
  return String(dateVal);
};

// Standalone HTML of a GST tax invoice, used for bulk PDF downloads. Mirrors
// the on-screen invoice: seller from the invoice snapshot (or `profile`),
// item-wise GST, HSN summary and the business's own bank details.
// `opts` reuses the layout for other GST vouchers: { title, numberLabel,
// dateLabel, partyHeading, refs: [[label, value]], showPay }.
export const generateInvoiceHTML = (invoice, settings = null, profile = null, opts = {}) => {
  const docTitle = opts.title || null;
  const numberLabel = opts.numberLabel || "Invoice No";
  const dateLabel = opts.dateLabel || "Date";
  const partyHeading = opts.partyHeading || "BILL TO";
  const showPay = opts.showPay !== false;
  const t = invoiceTotals(invoice);
  const itemwise = isItemwise(invoice);
  const gstOn = invoice.isGstEnabled !== false;
  const interState = itemwise ? Boolean(invoice.isInterState) : Number(invoice.igst) > 0 && !(Number(invoice.cgst) + Number(invoice.sgst));
  const seller = sellerFor(invoice, profile);
  const isTaxInvoice = gstOn && Boolean(seller.gstin);
  const lines = t.lines || [];
  const hasDiscount = lines.some((l) => Number(l.discount) > 0);
  const showGst = gstOn && itemwise;
  const hsnRows = gstOn ? (itemwise ? t.hsnSummary : invoiceTotals(upgradeToItemwise(invoice)).hsnSummary) : [];

  const client = invoice.client || {};
  const buyerGstin = client.gstin || client.taxId || client.gst || (/^\d{2}[A-Z0-9]{13}$/i.test(client.company || "") ? client.company : "");
  const buyerState = partyStateCode({ ...client, gstin: buyerGstin });
  const posCode = invoice.placeOfSupply?.code || buyerState || seller.stateCode;

  const finalTotal = t.total;
  const paidAmount = Number(invoice.paidAmount || invoice.received || 0);
  const isPaid = (invoice.status || "").toLowerCase() === "paid" || (paidAmount >= finalTotal && finalTotal > 0);
  const balanceDue = isPaid ? 0 : Math.max(0, finalTotal - paidAmount);

  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost:5173";
  const userId = invoice.userId || invoice.uid || settings?.userId || "";
  const invoiceId = invoice.id || String(invoice.docId || invoice.invoiceNumber || "").replace(/\//g, "_");
  const payUrl = userId && invoiceId ? `${origin}/pay/${userId}/${encodeURIComponent(invoiceId)}` : `${origin}/pay/invoice/${encodeURIComponent(invoiceId || "latest")}`;

  const totalRows = [["Taxable Value", fmt(t.taxableAmount)]];
  if (gstOn) {
    for (const b of t.taxBreakup || []) {
      if (interState) totalRows.push([`IGST @ ${b.gstRate}%`, fmt(b.igst)]);
      else totalRows.push([`CGST @ ${b.gstRate / 2}%`, fmt(b.cgst)], [`SGST @ ${b.gstRate / 2}%`, fmt(b.sgst)]);
    }
  }
  if (Number(t.cessAmount) > 0) totalRows.push(["Cess", fmt(t.cessAmount)]);
  if (Number(t.tcsAmount) > 0) totalRows.push([`TCS @ ${t.tcsRate}%`, fmt(t.tcsAmount)]);
  if (invoice.isRoundOff || Number(t.roundOffAmount)) totalRows.push(["Round Off", fmt(t.roundOffAmount)]);

  const bank = seller.bank || {};
  const bankLines = [
    ["Bank Name", bank.bankName],
    ["A/c Name", bank.accountName],
    ["A/c No", bank.accountNumber],
    ["IFSC Code", bank.ifsc],
    ["Branch", bank.branch],
    ["UPI ID", bank.upiId],
  ].filter(([, v]) => v);

  const colCount = 6 + (hasDiscount ? 1 : 0) + (showGst ? 1 : 0);
  const itemRows = lines
    .map(
      (it, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(it.description || it.name)}${it.batchNo || it.expiryDate ? `<div style="font-size:10px;color:#555">${[it.batchNo ? `Batch ${esc(it.batchNo)}` : "", it.expiryDate ? `Exp ${esc(formatDate(it.expiryDate))}` : ""].filter(Boolean).join(" · ")}</div>` : ""}</td>
        <td class="c">${esc(it.hsnCode || it.hsn)}</td>
        <td class="c">${esc(it.quantity)} ${esc(it.unit || "")}</td>
        <td class="r">${fmt(it.rate ?? it.price)}</td>
        ${hasDiscount ? `<td class="c">${Number(it.discount || 0) ? `${esc(it.discount)}%` : ""}</td>` : ""}
        ${showGst ? `<td class="c">${esc(it.gstRate)}%</td>` : ""}
        <td class="r">${fmt(it.taxable ?? it.amount)}</td>
      </tr>`
    )
    .join("");
  const fillerRows = new Array(Math.max(0, 14 - lines.length))
    .fill(`<tr>${new Array(colCount).fill("<td>&nbsp;</td>").join("")}</tr>`)
    .join("");

  const hsnTable =
    isTaxInvoice && hsnRows.length
      ? `<table class="grid small">
          <thead><tr>
            <th class="l">HSN/SAC</th><th class="r">Taxable Value</th>
            ${interState ? `<th class="r">IGST (Rate / Amt)</th>` : `<th class="r">CGST (Rate / Amt)</th><th class="r">SGST (Rate / Amt)</th>`}
            <th class="r">Total Tax</th>
          </tr></thead>
          <tbody>${hsnRows
            .map(
              (h) => `<tr>
                <td>${esc(h.hsn || "—")}</td><td class="r">${fmt(h.taxable)}</td>
                ${interState ? `<td class="r">${h.gstRate}% / ${fmt(h.igst)}</td>` : `<td class="r">${h.gstRate / 2}% / ${fmt(h.cgst)}</td><td class="r">${h.gstRate / 2}% / ${fmt(h.sgst)}</td>`}
                <td class="r">${fmt(h.cgst + h.sgst + h.igst)}</td>
              </tr>`
            )
            .join("")}</tbody>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${esc(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; font-size: 13px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { border: 2px solid #000; width: 100%; }
    .head { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #000; }
    .head img { height: 60px; width: 60px; object-fit: contain; }
    .head .info { flex: 1; text-align: center; }
    .name { font-family: "Times New Roman", serif; font-size: 30px; font-weight: bold; color: #d00000; margin: 0; }
    .head p { margin: 2px 0; }
    .bar { display: flex; border-bottom: 1px solid #000; }
    .bar > div { padding: 5px 8px; }
    .bar .t { flex: 1; text-align: center; font-weight: bold; font-size: 22px; border-left: 1px solid #000; border-right: 1px solid #000; }
    .party { display: flex; border-bottom: 1px solid #000; }
    .party .bill { width: 60%; border-right: 1px solid #000; }
    .party .bill .top { padding: 5px 8px; min-height: 80px; }
    .party .bill .gst { border-top: 1px solid #000; padding: 5px 8px; }
    .party .refs { width: 40%; }
    .party .refs div { padding: 5px 8px; border-bottom: 1px solid #000; }
    .party .refs div:last-child { border-bottom: none; }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th, table.grid td { border-right: 1px solid #000; padding: 4px; vertical-align: top; }
    table.grid th:last-child, table.grid td:last-child { border-right: none; }
    table.grid thead th { border-bottom: 1px solid #000; font-size: 11px; }
    table.items { border-bottom: 1px solid #000; }
    table.small { font-size: 11px; border-bottom: 1px solid #000; }
    .c { text-align: center; } .r { text-align: right; } .l { text-align: left; } .b { font-weight: bold; }
    .foot { display: flex; border-bottom: 1px solid #000; }
    .foot .bank { width: 60%; padding: 6px 8px; }
    .foot .bank span { display: inline-block; width: 90px; }
    .foot .tot { width: 40%; border-left: 1px solid #000; }
    .foot .tot div { display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #000; }
    .foot .tot div:last-child { border-bottom: none; }
    .words { padding: 6px 8px; border-bottom: 1px solid #000; display: flex; justify-content: space-between; align-items: center; }
    .pay { background: #2563eb; color: #fff; padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-decoration: none; }
    .paid { background: #10b981; color: #fff; padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .sign { display: flex; }
    .sign .decl { width: 60%; padding: 6px 8px; }
    .sign .auth { width: 40%; border-left: 1px solid #000; padding: 6px 8px; height: 90px; display: flex; flex-direction: column; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      ${seller.logoURL ? `<img src="${esc(seller.logoURL)}" alt="logo" />` : ""}
      <div class="info">
        <h1 class="name">${esc(seller.companyName || "Your Business Name")}</h1>
        ${sellerAddressLines(seller).map((l) => `<p>${esc(l)}</p>`).join("")}
        <p>${[seller.phone && `Phone : ${esc(seller.phone)}`, seller.email && `E-Mail : ${esc(seller.email)}`].filter(Boolean).join(" | ")}</p>
        <p class="b">${seller.gstin ? `GSTIN : ${esc(seller.gstin)}` : "Unregistered"}${seller.stateCode ? ` | State : ${esc(stateName(seller.stateCode))} (${esc(seller.stateCode)})` : ""}</p>
      </div>
      ${seller.logoURL ? `<div style="width:60px"></div>` : ""}
    </div>
    <div class="bar">
      <div style="width:30%"><b>${esc(numberLabel)} :</b> ${esc(invoice.invoiceNumber)}</div>
      <div class="t">${esc(docTitle || (isTaxInvoice ? "TAX INVOICE" : "INVOICE"))}</div>
      <div style="width:30%"><b>${esc(dateLabel)} :</b> ${esc(formatDate(invoice.invoiceDate))}</div>
    </div>
    <div class="party">
      <div class="bill">
        <div class="top"><div style="font-size:11px" class="b">${esc(partyHeading)}</div><div class="b">${esc(client.name)}</div><div>${esc(client.address)}</div></div>
        <div class="gst"><b>GSTIN :</b> ${esc(buyerGstin || "Unregistered")}${buyerState ? ` &nbsp; <b>State :</b> ${esc(stateName(buyerState))} (${esc(buyerState)})` : ""}</div>
      </div>
      <div class="refs">
        <div><b>Place of Supply :</b> ${isExport(invoice) ? "96 – Outside India" : posCode ? `${esc(stateName(posCode))} (${esc(posCode)})` : ""}</div>
        ${invoice.supplyType && invoice.supplyType !== "REGULAR" ? `<div><b>Supply Type :</b> ${esc(supplyTypeLabel(invoice))}</div>` : ""}
        <div><b>Reverse Charge :</b> ${invoice.reverseCharge ? "Yes" : "No"}</div>
        ${isExport(invoice) ? `<div><b>Shipping Bill :</b> ${esc([invoice.shippingBillNo, formatDate(invoice.shippingBillDate)].filter(Boolean).join(" / "))}</div><div><b>Port / Country :</b> ${esc([invoice.portCode, invoice.countryCode].filter(Boolean).join(" / "))}</div>` : ""}
        ${(opts.refs || [
          ["Due Date", formatDate(invoice.dueDate)],
          ["P.O. No / Date", [invoice.poNumber, formatDate(invoice.poDate)].filter(Boolean).join(" / ")],
          ["D.C. No / Date", [invoice.dcNumber, formatDate(invoice.dcDate)].filter(Boolean).join(" / ")],
        ]).map(([k, v]) => `<div><b>${esc(k)} :</b> ${esc(v)}</div>`).join("")}
      </div>
    </div>
    <table class="grid items">
      <thead><tr>
        <th style="width:5%">S.No</th><th>PARTICULARS</th><th style="width:10%">HSN/SAC</th><th style="width:9%">QTY</th><th style="width:11%">RATE</th>
        ${hasDiscount ? `<th style="width:7%">DISC %</th>` : ""}${showGst ? `<th style="width:7%">GST %</th>` : ""}<th style="width:14%">TAXABLE VALUE</th>
      </tr></thead>
      <tbody>${itemRows}${fillerRows}</tbody>
    </table>
    ${hsnTable}
    ${invoice.invoiceNotes ? `<div style="padding:5px 8px;border-bottom:1px solid #000"><b>Note :</b> ${esc(invoice.invoiceNotes)}</div>` : ""}
    <div class="foot">
      <div class="bank"><div class="b" style="margin-bottom:3px">Bank Details</div>${
        bankLines.length ? bankLines.map(([k, v]) => `<div><span>${k}</span>: ${esc(v)}</div>`).join("") : "<div>—</div>"
      }</div>
      <div class="tot">${totalRows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join("")}</div>
    </div>
    <div class="words">
      <div><b>${(invoice.currency || "INR") === "INR" ? "Rupees" : esc(invoice.currency)} :</b> ${esc(convertToWords(Math.floor(finalTotal)))}${
        (invoice.currency || "INR") !== "INR" ? `<div style="font-size:11px">(${esc(invoice.currency)} 1 = ₹${esc(invoice.exchangeRate)}; invoice value ₹${fmt(finalTotal * inrFactor(invoice))})</div>` : ""
      }</div>
      <div style="text-align:right"><div class="b" style="font-size:15px">NET TOTAL : ${fmt(finalTotal)}</div>
        ${showPay && paidAmount > 0 ? `<div style="color:#047857">Paid : ${fmt(paidAmount)}</div><div style="color:#b91c1c" class="b">Balance Due : ${fmt(balanceDue)}</div>` : ""}
        ${showPay ? `<div style="margin-top:4px">${isPaid ? `<span class="paid">✓ PAID IN FULL</span>` : `<a class="pay" href="${esc(payUrl)}">Pay Now</a>`}</div>` : ""}
      </div>
    </div>
    <div class="sign">
      <div class="decl"><div class="b">Declaration</div>${supplyNotes(invoice).map((x) => `<div class="b">${esc(x)}</div>`).join("")}<div>${esc(invoice.declaration || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.")}</div></div>
      <div class="auth"><div class="b" style="color:#dc2626">For ${esc(seller.companyName || "Your Business")}</div><div style="text-align:right">Authorised Signatory</div></div>
    </div>
  </div>
</body>
</html>`;
};

// Print any GST voucher (credit note, purchase, debit note) in the invoice layout.
export const generateVoucherHTML = (voucher, type, profile = null) => {
  const asInvoice = {
    ...voucher,
    invoiceNumber: voucher.voucherNumber,
    invoiceDate: voucher.voucherDate,
    client: voucher.party || {},
    declaration: voucher.notes || `This ${type.label.toLowerCase()} is issued as per the details above.`,
  };
  const refs = [];
  if (voucher.linkedNumber) refs.push([type.linkKind === "invoice" ? "Original Invoice" : "Original Bill", `${voucher.linkedNumber}${voucher.linkedDate ? ` / ${formatDate(voucher.linkedDate)}` : ""}`]);
  if (voucher.supplierBillNumber) refs.push(["Supplier Bill No / Date", [voucher.supplierBillNumber, formatDate(voucher.supplierBillDate)].filter(Boolean).join(" / ")]);
  if (voucher.reason) refs.push(["Reason", voucher.reason]);
  if (type.dueLabel && voucher.dueDate) refs.push([type.dueLabel, formatDate(voucher.dueDate)]);
  return generateInvoiceHTML(asInvoice, null, profile, {
    title: type.printTitle,
    numberLabel: `${type.label} No`,
    partyHeading: type.partyKind === "supplier" ? "SUPPLIER" : "CUSTOMER",
    refs,
    showPay: false,
  });
};
