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

export const generateInvoiceHTML = (invoice, settings = null) => {
  // Calculate totals if not present
  const itemsArray = invoice.items || invoice.products || [];
  const subtotal = itemsArray.reduce((sum, item) => sum + (item.amount || item.total || 0), 0);

  const cgstAmount = (subtotal * (invoice.cgst || 0)) / 100;
  const sgstAmount = (subtotal * (invoice.sgst || 0)) / 100;
  const igstAmount = (subtotal * (invoice.igst || 0)) / 100;

  const roundOffAmount = invoice.isRoundOff ? Math.round(invoice.amount) - invoice.amount : 0;
  const finalTotal = invoice.amount || (subtotal + cgstAmount + sgstAmount + igstAmount + roundOffAmount);

  const amountInWords = convertToWords(Math.floor(finalTotal));

  const origin = (typeof window !== "undefined" && window.location && window.location.origin)
    ? window.location.origin
    : "http://localhost:5173";

  const userId = invoice.userId || invoice.uid || settings?.userId || "";
  const rawId = invoice.id || invoice.docId || invoice.invoiceNumber || "";
  const invoiceId = invoice.id ? invoice.id : String(rawId).replace(/\//g, "_");

  let razorpayUrl = "";
  if (userId && invoiceId) {
    razorpayUrl = `${origin}/pay/${userId}/${encodeURIComponent(invoiceId)}`;
  } else if (invoice.razorpayLink || settings?.systemSettings?.value?.systemConfig?.razorpayLink) {
    const baseLink = invoice.razorpayLink || settings?.systemSettings?.value?.systemConfig?.razorpayLink;
    razorpayUrl = baseLink.includes("?")
      ? `${baseLink}&amount=${finalTotal.toFixed(2)}`
      : `${baseLink}?amount=${finalTotal.toFixed(2)}`;
  } else {
    razorpayUrl = `${origin}/pay/invoice/${encodeURIComponent(invoiceId || 'latest')}`;
  }

  const formatDate = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === 'string') return dateVal;
    if (dateVal?.toDate) return dateVal.toDate().toLocaleDateString('en-GB');
    if (dateVal instanceof Date) return dateVal.toLocaleDateString('en-GB');
    return dateVal;
  };

  // Determine filler rows to ensure A4 coverage (approx 25 rows fit nicely on A4 with this font size)
  const MIN_ROWS = 25;
  const fillerRowCount = Math.max(0, MIN_ROWS - itemsArray.length);

  const paidAmount = Number(invoice.paidAmount || invoice.received || 0);
  const isPaid = (invoice.status || "").toLowerCase() === "paid" || (paidAmount >= finalTotal && finalTotal > 0);
  const balanceDue = isPaid ? 0 : Math.max(0, finalTotal - paidAmount);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #fff; font-size: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .container { 
            border: 2px solid black; 
            width: 100%; 
            margin: 0 auto; 
            background: white;
            position: relative;
        }
        
        .header-top { display: flex; justify-content: space-between; padding: 5px 15px; font-weight: bold; font-size: 14px; }
        .header-main { text-align: center; padding-bottom: 5px; border-bottom: 1px solid black; }
        .logo-section { display: flex; padding-left: 20px; }
        .logo-img { height: 60px; margin-right: 10px; }
        .company-info { text-align: center; }
        .company-name { font-family: "Times New Roman", serif; font-size: 34px; font-weight: bold; color: #d00000; margin: 0; }
        .company-details p { margin: 2px 0; font-size: 14px; color: black; }
        
        .title-bar { display: flex; border-bottom: 1px solid black; }
        .title-no { width: 20%; border-right: 1px solid black; padding: 5px; display: flex; align-items: center; font-size: 14px; }
        .title-center { width: 60%; text-align: center; font-weight: bold; font-size: 24px; padding: 5px; }
        .title-date { width: 20%; border-left: 1px solid black; padding: 5px; display: flex; align-items: center; font-size: 14px; }
        
        .client-section { display: flex; border-bottom: 1px solid black; }
        .client-left { width: 70%; border-right: 1px solid black; display: flex; flex-direction: column; height: 130px; font-size: 14px; }
        .client-info { padding: 5px 10px; flex-grow: 1; }
        .gst-row { border-top: 1px solid black; padding: 5px 10px; height: 32px; display: flex; align-items: center; }
        
        .client-right { width: 30%; font-size: 14px; height: 130px; }
        .po-row { border-bottom: 1px solid black; padding: 5px 10px; height: 32px; display: flex; align-items: center; }
        .last-po-row { padding: 5px 10px; height: 32px; display: flex; align-items: center; }
        
        /* Standard Table grid for items */
        .items-table { width: 100%; border-collapse: collapse; font-size: 14px; table-layout: fixed; border-bottom: 1px solid black; }
        .items-table th { border-right: 1px solid black; border-bottom: 1px solid black; padding: 4px; text-align: center; font-weight: bold; }
        .items-table td { border-right: 1px solid black; padding: 4px; vertical-align: top; }
        .items-table td:last-child, .items-table th:last-child { border-right: none; }
        
        .col-sno { width: 5%; text-align: center; }
        .col-part { width: 50%; }
        .col-hsn { width: 10%; text-align: center; }
        .col-qty { width: 7%; text-align: center; }
        .col-rate { width: 10%; text-align: right; }
        .col-amt { width: 18%; text-align: right; }
        
        .footer-table { width: 100%; border-collapse: collapse; }
        .footer-row { border-bottom: 1px solid black; }
        .left-panel { width: 70%; border-right: 1px solid black; vertical-align: top; padding: 0 !important; }
        .right-panel { width: 30%; vertical-align: top; padding: 0 !important; }
        
        .font-bold { font-weight: bold; }
        .ml-2 { margin-left: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header-top">
          <div>☎ 98432 94464</div>
          <div>☎ 96984 87096</div>
        </div>

        <div class="header-main">
          <div class="logo-section">
            <img src="https://res.cloudinary.com/dnmvriw3e/image/upload/v1756868204/ESA_uggt8u.png" alt="ESA Logo" class="logo-img">
            <div class="company-info">
                <h1 class="company-name">ESA ENGINEERING WORKS</h1>
                <div class="company-details">
                  <p>All Kinds of Lathe and Milling Works</p>
                  <p>Specialist in : Press Tools, Die Casting Tools, Precision Components</p>
                  <p>1/100, Chettipalayam Road, E.B. Compound, Malumichampatti, CBE - 641 050.</p>
                  <p>E-Mail : esaengineeringworks@gmail.com | GSTIN : 33AMWPB2116Q1ZS</p>
                </div>
            </div>
          </div>
        </div>

        <div class="title-bar">
          <div class="title-no"><span class="font-bold">NO :</span> <span class="ml-2">${invoice.invoiceNumber}</span></div>
          <div class="title-center">INVOICE</div>
          <div class="title-date"><span class="font-bold">DATE :</span> <span class="ml-2">${formatDate(invoice.invoiceDate)}</span></div>
        </div>

        <div class="client-section">
          <div class="client-left">
            <div class="client-info">
              <div>To, M/s,</div>
              <div class="font-bold ml-4">${invoice.client?.name || ""}</div>
              <div class="ml-4">${invoice.client?.address || ""}</div>
            </div>
            <div class="gst-row">GSTIN : ${invoice.client?.taxId || invoice.client?.company || invoice.client?.gst || ""}</div>
          </div>
          <div class="client-right">
            <div class="po-row"><span class="font-bold">P.O. No :</span> <span class="ml-2">${invoice.poNumber || ""}</span></div>
            <div class="po-row"><span class="font-bold">P.O. Date :</span> <span class="ml-2">${formatDate(invoice.poDate) || ""}</span></div>
            <div class="po-row"><span class="font-bold">D.C. No :</span> <span class="ml-2">${invoice.dcNumber || ""}</span></div>
            <div class="last-po-row"><span class="font-bold">D.C. Date :</span> <span class="ml-2">${formatDate(invoice.dcDate) || ""}</span></div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="col-sno">S.No.</th>
              <th class="col-part">PARTICULARS</th>
              <th class="col-hsn">HSN CODE</th>
              <th class="col-qty">QTY.</th>
              <th class="col-rate">RATE</th>
              <th class="col-amt">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsArray.map((item, index) => `
              <tr>
                <td class="col-sno">${index + 1}</td>
                <td class="col-part">${item.description || item.name}</td>
                <td class="col-hsn">${item.hsnCode || item.hsn || ""}</td>
                <td class="col-qty">${item.quantity}</td>
                <td class="col-rate">${Number(item.rate || item.price || 0).toFixed(2)}</td>
                <td class="col-amt">${Number(item.amount || item.total || 0).toFixed(2)}</td>
              </tr>
            `).join("")}
            ${fillerRowCount > 0 ? new Array(fillerRowCount).fill(0).map((_, i) => `
              <tr class="empty-row">
                <td class="col-sno" style="height: 24px;">&nbsp;</td>
                <td class="col-part"></td>
                <td class="col-hsn"></td>
                <td class="col-qty"></td>
                <td class="col-rate"></td>
                <td class="col-amt"></td>
              </tr>
            `).join("") : ''}
             <tr>
                <td class="col-sno" style="height: 24px; border-bottom: none;"></td>
                <td class="col-part" style="border-bottom: none; font-size: 13px; padding-left: 10px;">Nil</td>
                <td class="col-hsn" style="border-bottom: none;"></td>
                <td class="col-qty" style="border-bottom: none;"></td>
                <td class="col-rate" style="border-bottom: none;"></td>
                <td class="col-amt" style="border-bottom: none;"></td>
             </tr>
          </tbody>
        </table>

        <table class="footer-table">
          <tr class="footer-row">
            <td class="left-panel">
               <div style="padding: 5px;">
                  ${invoice.invoiceNotes ? `<div style="font-weight: bold;">Notes:</div><div>${invoice.invoiceNotes}</div>` : ''}
                  <div style="margin-top: 5px; display: flex;">
                     <div style="width: 100px;">Bank Details :</div>
                     <div>Bank Name : State Bank Of India</div>
                  </div>
                  <div style="margin-left: 100px;">A/C No : 42455711572</div>
                  <div style="margin-left: 100px;">IFSC Code : SBIN0015017</div>
                  <div style="margin-left: 100px;">Branch : Malumichampatti</div>
               </div>
               <div style="padding: 6px 10px; border-top: 1px solid black; border-bottom: 1px solid black; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                     <strong>Rupees :</strong> <span style="font-weight: normal;">${amountInWords}</span>
                  </div>
                   <div>
                      ${isPaid ? `
                        <span style="display: inline-block; background-color: #10b981 !important; color: #ffffff !important; padding: 6px 14px; border-radius: 4px; font-weight: bold; font-size: 12px; border: 1px solid #059669; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                          ✓ PAID IN FULL
                        </span>
                      ` : `
                        <a href="${razorpayUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb !important; color: #ffffff !important; padding: 6px 16px; border-radius: 4px; text-decoration: none !important; font-weight: bold; font-size: 12px; border: 1px solid #1d4ed8; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                           ${paidAmount > 0 ? `Pay Balance (₹${balanceDue.toFixed(2)})` : 'Pay'}
                        </a>
                      `}
                   </div>
               </div>
            </td>
            <td class="right-panel">
               <table style="width: 100%; border-collapse: collapse;">
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px;">SUB TOTAL</td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right;">${subtotal.toFixed(2)}</td>
                   </tr>
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px;">CGST <span style="margin-left: 10px;">${invoice.cgst || 0}%</span></td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right;">${cgstAmount.toFixed(2)}</td>
                   </tr>
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px;">SGST <span style="margin-left: 10px;">${invoice.sgst || 0}%</span></td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right;">${sgstAmount.toFixed(2)}</td>
                   </tr>
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px;">IGST <span style="margin-left: 10px;">${invoice.igst || 0}%</span></td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right;">${igstAmount.toFixed(2)}</td>
                   </tr>
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px; font-weight: bold;">ROUND OFF</td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right;">${roundOffAmount.toFixed(2)}</td>
                   </tr>
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px; font-weight: bold;">NET TOTAL</td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right; font-weight: bold;">${finalTotal.toFixed(2)}</td>
                   </tr>
                   ${paidAmount > 0 ? `
                   <tr>
                       <td style="border-bottom: 1px solid black; padding: 4px; font-size: 13px; color: #047857; font-weight: bold;">PAID / RECEIVED</td>
                       <td style="border-bottom: 1px solid black; padding: 4px; text-align: right; font-size: 13px; color: #047857; font-weight: bold;">-${paidAmount.toFixed(2)}</td>
                   </tr>
                   <tr>
                       <td style="padding: 4px; font-weight: bold; font-size: 13px; color: #b91c1c;">BALANCE DUE</td>
                       <td style="padding: 4px; text-align: right; font-weight: bold; font-size: 13px; color: #b91c1c;">${balanceDue.toFixed(2)}</td>
                   </tr>
                   ` : ''}
               </table>
            </td>
          </tr>
          
          <tr style="height: 100px;">
             <td style="border-right: 1px solid black; vertical-align: top; padding: 5px;">
                <div class="font-bold">Declaration</div>
                <div style="font-size: 11px;">We declare that this invoice shows the actual price of the goods Described and that all Particulars are true and correct</div>
             </td>
             <td style="vertical-align: bottom; text-align: right; padding: 5px;">
               <div style="font-weight: bold; color: #d00000; margin-bottom: 40px; text-align: center;">For ESA Engineering Works</div>
               <div style="text-align: center;">Authorized Signatory</div>
             </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;
};
