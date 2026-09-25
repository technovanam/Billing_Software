// Bill total calculations shared by the invoice form, the POS counter and the
// AI draft preview. Moved here unchanged from CreateInvoicePage and POSPage so
// GST is calculated in one place per bill type.

// Invoice form (/invoices/create): one CGST/SGST/IGST rate for the whole invoice.
export function calculateInvoiceTotals({ items, cgst, sgst, igst, isGstEnabled, isRoundOff }) {
  const itemsArray = items || [];
  const subtotal = itemsArray.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.rate || item.price || 0),
    0
  );

  const cgstAmount = isGstEnabled ? (subtotal * cgst) / 100 : 0;
  const sgstAmount = isGstEnabled ? (subtotal * sgst) / 100 : 0;
  const igstAmount = isGstEnabled ? (subtotal * igst) / 100 : 0;

  let total = subtotal + cgstAmount + sgstAmount + igstAmount;
  let roundOffAmount = 0;
  if (isRoundOff) {
    const roundedTotal = Math.round(total);
    roundOffAmount = roundedTotal - total;
    total = roundedTotal;
  }
  return {
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    roundOffAmount,
    total,
  };
}

// POS counter (/pos/billing): subtotal, CGST, SGST, total, round-off, balance.
export function calculatePosCartSummary({ cart, cgstRate, sgstRate, cashReceived, paymentMode }) {
  const totalItems = cart.length;
  const totalQty = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const cgstAmount = (subtotal * cgstRate) / 100;
  const sgstAmount = (subtotal * sgstRate) / 100;
  const gstTotal = cgstAmount + sgstAmount;
  const exactTotalAmount = Math.max(0, subtotal + gstTotal);

  // Cash payments round off (>= .50 round up, < .50 round down: Math.round)
  // Online payments pay the exact full decimal amount (e.g. 142.50 or 142.47)
  const roundedTotalAmount = Math.round(exactTotalAmount);
  const roundOffDiff = roundedTotalAmount - exactTotalAmount;

  const payableTotal = paymentMode === "Cash" ? roundedTotalAmount : exactTotalAmount;

  const cashNum = parseFloat(cashReceived) || 0;
  const balancePaid = paymentMode === "Cash" ? Math.max(0, cashNum - payableTotal) : 0;
  const amountDue = paymentMode === "Cash" ? Math.max(0, payableTotal - cashNum) : 0;

  return {
    totalItems,
    totalQty,
    subtotal,
    cgstAmount,
    sgstAmount,
    gstTotal,
    exactTotalAmount,
    roundedTotalAmount,
    roundOffDiff,
    payableTotal,
    balancePaid,
    amountDue,
  };
}

// Builds a POS cart line exactly as the counter does when a product is added.
export function buildPosCartItem(product, qty = 1) {
  const priceNum =
    typeof product.price === "number"
      ? product.price
      : parseFloat(String(product.price || product.rate || "0").replace(/[^0-9.-]+/g, "")) || 0;

  const productIdentifier =
    product.productNo || product.hsn || product.barcode || product.id || `PRD-${Date.now().toString().slice(-4)}`;

  return {
    id: product.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    productNo: productIdentifier,
    name: product.name || "Custom Item",
    hsn: product.hsn || product.productNo || "151800",
    rate: priceNum,
    qty,
    total: qty * priceNum,
    unit: product.unit || "Nos",
  };
}
